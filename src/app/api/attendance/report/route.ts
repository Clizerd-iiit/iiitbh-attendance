import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['teacher','superadmin'].includes(session.user.role as string))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const subjectId = searchParams.get('subject_id');
  const branch = searchParams.get('branch');
  const group = searchParams.get('group');
  if (!subjectId) return NextResponse.json({ error: 'subject_id required' }, { status: 400 });

  // Verify teacher owns subject
  if (session.user.role === 'teacher') {
    const { data: sub } = await supabaseAdmin.from('subjects')
      .select('teacher_ids').eq('id', subjectId).single();
    if (!sub?.teacher_ids?.includes(session.user.userId))
      return NextResponse.json({ error: 'Not your subject' }, { status: 403 });
  }

  const { data: summary } = await supabaseAdmin
    .from('student_attendance_summary')
    .select('student_id, total_classes, attended, percentage')
    .eq('subject_id', subjectId);

  const { data: students } = await supabaseAdmin
    .from('enrollments')
    .select('student_id, student:users(name, roll_no, branch, section, signup_info)')
    .eq('subject_id', subjectId);

  const threshold = 75;
  const report = (students || [])
    .filter(e => {
      const student = e.student as any;
      const sBranch = (student?.signup_info?.branch || student?.branch || '').trim();
      const sGroup = (student?.signup_info?.group || student?.section || '').trim();
      if (branch && sBranch.toUpperCase() !== branch.toUpperCase()) return false;
      if (group && !sGroup.toUpperCase().includes(group.toUpperCase())) return false;
      return true;
    })
    .map(e => {
      const s = summary?.find(s => s.student_id === e.student_id);
      const student = e.student as any;
      const pct = s?.percentage || 0;
      const attended = s?.attended || 0;
      const total = s?.total_classes || 0;
      const canMiss = Math.floor((attended * 100 - threshold * total) / threshold);
      const sBranch = (student?.signup_info?.branch || student?.branch || '').trim();
      const sGroup = (student?.signup_info?.group || student?.section || '').trim();
      return {
        id: e.student_id,
        roll_no: student?.roll_no || '—',
        name: student?.name || '—',
        branch: sBranch,
        group: sGroup,
        total, attended, percentage: pct,
        safe_to_miss: Math.max(0, canMiss),
      };
    });

  return NextResponse.json({ report });
}
