import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'superadmin') {
    return NextResponse.json({ error: 'Unauthorized: SuperAdmin access required' }, { status: 403 });
  }

  // 1. Fetch all students who have proxy warnings or are suspended
  const { data: students, error: studentErr } = await supabaseAdmin
    .from('users')
    .select('id, name, email, roll_no, branch, section, is_active, verification_status, signup_info, last_seen_at')
    .eq('role', 'student');

  if (studentErr) {
    return NextResponse.json({ error: studentErr.message }, { status: 500 });
  }

  const flaggedStudents = (students || [])
    .filter((s: any) => {
      const warnings = Number(s.signup_info?.proxy_warnings || 0);
      const isSuspended = !!s.signup_info?.is_suspended || s.is_active === false;
      return warnings > 0 || isSuspended;
    })
    .map((s: any) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      roll_no: s.signup_info?.roll_no || s.roll_no || 'N/A',
      branch: (s.signup_info?.branch || s.branch || 'Unknown').toUpperCase(),
      section: (s.signup_info?.section || s.section || '—').toUpperCase(),
      warnings: Number(s.signup_info?.proxy_warnings || 0),
      is_suspended: !!s.signup_info?.is_suspended || s.is_active === false,
      suspended_at: s.signup_info?.suspended_at || null,
      last_proxy_at: s.signup_info?.last_proxy_at || null,
      last_seen_at: s.last_seen_at,
    }));

  // 2. Fetch latest proxy audit logs
  const { data: logs, error: logsErr } = await supabaseAdmin
    .from('audit_logs')
    .select('*')
    .in('action', ['PROXY_ATTENDANCE_FLAGGED', 'STUDENT_SUSPENDED_PROXY_FRAUD', 'MULTI_ACCOUNT_DEVICE_PROXY_FLAGGED'])
    .order('created_at', { ascending: false })
    .limit(100);

  // 3. Compute stats
  const totalIncidents = (logs || []).length;
  const level1Count = flaggedStudents.filter(s => s.warnings === 1 && !s.is_suspended).length;
  const level2Count = flaggedStudents.filter(s => s.warnings === 2 && !s.is_suspended).length;
  const suspendedCount = flaggedStudents.filter(s => s.is_suspended || s.warnings >= 3).length;

  return NextResponse.json({
    stats: {
      totalIncidents,
      level1Count,
      level2Count,
      suspendedCount,
      totalFlaggedStudents: flaggedStudents.length,
    },
    flaggedStudents,
    logs: logs || [],
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'superadmin') {
    return NextResponse.json({ error: 'Unauthorized: SuperAdmin access required' }, { status: 403 });
  }

  const body = await req.json();
  const { action, studentId, reason } = body;
  const adminId = session.user.userId || (session.user as any).id;

  if (!action || !studentId) {
    return NextResponse.json({ error: 'Action and studentId are required' }, { status: 400 });
  }

  // Fetch current student
  const { data: student, error: fetchErr } = await supabaseAdmin
    .from('users')
    .select('id, name, signup_info, is_active')
    .eq('id', studentId)
    .single();

  if (fetchErr || !student) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 });
  }

  const signupInfo = { ...(student.signup_info || {}) };

  if (action === 'reset_warnings') {
    signupInfo.proxy_warnings = 0;
    delete signupInfo.last_proxy_at;

    await supabaseAdmin
      .from('users')
      .update({ signup_info: signupInfo })
      .eq('id', studentId);

    await logAudit({
      userId: adminId,
      action: 'ADMIN_RESET_PROXY_WARNINGS',
      tableName: 'users',
      recordId: studentId,
      newValue: { studentName: student.name, previousWarnings: student.signup_info?.proxy_warnings },
      ipAddress: req.headers.get('x-forwarded-for') || 'admin_action',
    });

    return NextResponse.json({ success: true, message: `Reset proxy warnings to 0 for ${student.name}` });
  }

  if (action === 'unsuspend') {
    signupInfo.proxy_warnings = 0;
    signupInfo.is_suspended = false;
    delete signupInfo.suspended_at;
    delete signupInfo.suspension_reason;

    await supabaseAdmin
      .from('users')
      .update({
        signup_info: signupInfo,
        is_active: true,
        verification_status: 'approved',
      })
      .eq('id', studentId);

    await logAudit({
      userId: adminId,
      action: 'ADMIN_UNSUSPEND_STUDENT',
      tableName: 'users',
      recordId: studentId,
      newValue: { studentName: student.name, unSuspendedBy: adminId },
      ipAddress: req.headers.get('x-forwarded-for') || 'admin_action',
    });

    return NextResponse.json({ success: true, message: `Account unsuspended and warnings reset for ${student.name}` });
  }

  if (action === 'suspend') {
    signupInfo.proxy_warnings = 3;
    signupInfo.is_suspended = true;
    signupInfo.suspended_at = new Date().toISOString();
    signupInfo.suspension_reason = reason || 'Manually suspended by SuperAdmin for proxy attendance violation';

    await supabaseAdmin
      .from('users')
      .update({
        signup_info: signupInfo,
        is_active: false,
        verification_status: 'rejected',
      })
      .eq('id', studentId);

    await logAudit({
      userId: adminId,
      action: 'ADMIN_MANUALLY_SUSPENDED_STUDENT',
      tableName: 'users',
      recordId: studentId,
      newValue: { studentName: student.name, reason: signupInfo.suspension_reason },
      ipAddress: req.headers.get('x-forwarded-for') || 'admin_action',
    });

    return NextResponse.json({ success: true, message: `Suspended account for ${student.name}` });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
