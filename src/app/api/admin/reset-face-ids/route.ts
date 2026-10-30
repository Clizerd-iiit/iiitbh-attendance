import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

function matchStudent(s: any, branch?: string, group?: string) {
  const sBranch = (s.signup_info?.branch || s.branch || '').toUpperCase().trim();
  const sGroup = (s.signup_info?.group || s.section || '').toUpperCase().trim();
  const sSubGroup = (s.signup_info?.sub_group || '').toUpperCase().trim();

  if (branch && branch !== 'ALL' && sBranch !== branch.toUpperCase().trim()) {
    return false;
  }

  if (group && group !== 'ALL') {
    const g = group.toUpperCase().trim();
    if (g === 'G1' && !sGroup.startsWith('G1') && !sSubGroup.startsWith('G1')) return false;
    if (g === 'G2' && !sGroup.startsWith('G2') && !sSubGroup.startsWith('G2')) return false;
    if (g !== 'G1' && g !== 'G2' && sGroup !== g && sSubGroup !== g) return false;
  }

  return true;
}

// GET: Preview how many students match the filter and have Face ID
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'superadmin') {
    return NextResponse.json({ error: 'Unauthorized: Superadmin access required' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const branch = searchParams.get('branch') || 'ALL';
  const group = searchParams.get('group') || 'ALL';

  const { data: students, error } = await supabaseAdmin
    .from('users')
    .select('id, name, roll_no, branch, section, signup_info')
    .eq('role', 'student');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const matched = (students || []).filter(s => matchStudent(s, branch, group));
  const studentsWithFace = matched.filter(s => !!(s.signup_info?.face_descriptor));

  return NextResponse.json({
    totalMatched: matched.length,
    studentsWithFace: studentsWithFace.length,
    sample: studentsWithFace.slice(0, 5).map(s => ({
      id: s.id,
      name: s.name,
      roll_no: s.signup_info?.roll_no || s.roll_no,
      branch: (s.signup_info?.branch || s.branch || '').toUpperCase(),
      group: (s.signup_info?.group || s.section || '').toUpperCase(),
    })),
  });
}

// POST: Execute the Face ID reset
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'superadmin') {
    return NextResponse.json({ error: 'Unauthorized: Superadmin access required' }, { status: 403 });
  }

  const body = await req.json();
  const { branch = 'ALL', group = 'ALL', confirmText } = body;

  if (confirmText !== 'RESET') {
    return NextResponse.json({ error: 'Invalid confirmation: Please type "RESET" to confirm deletion.' }, { status: 400 });
  }

  const { data: students, error } = await supabaseAdmin
    .from('users')
    .select('id, name, roll_no, branch, section, signup_info')
    .eq('role', 'student');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const matched = (students || []).filter(s => matchStudent(s, branch, group));
  const targets = matched.filter(s => !!(s.signup_info?.face_descriptor));

  if (targets.length === 0) {
    return NextResponse.json({ success: true, count: 0, message: 'No students with Face ID found for the selected criteria.' });
  }

  let successCount = 0;
  // Update students in batches to clear face descriptor & last_face_update
  for (const student of targets) {
    const signupInfo = { ...(student.signup_info || {}) };
    delete signupInfo.face_descriptor;
    delete signupInfo.last_face_update;

    const { error: updateErr } = await supabaseAdmin
      .from('users')
      .update({ signup_info: signupInfo })
      .eq('id', student.id);

    if (!updateErr) {
      successCount++;
    }
  }

  // Record audit log entry
  const adminId = session.user.userId || (session.user as any).id;
  await logAudit({
    userId: adminId,
    action: 'RESET_FACE_IDS_BULK',
    tableName: 'users',
    newValue: {
      branch,
      group,
      resetCount: successCount,
      totalMatched: targets.length,
      timestamp: new Date().toISOString(),
    },
  });

  return NextResponse.json({
    success: true,
    count: successCount,
    message: `Successfully deleted and reset Face ID for ${successCount} student(s) in Branch: ${branch}, Group: ${group}.`,
  });
}
