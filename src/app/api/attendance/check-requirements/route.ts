import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { getClassSettings } from '@/lib/classSettings';
import { closeClassAndMarkAbsent } from '@/lib/autoCloseClasses';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code')?.trim();

  if (!code) {
    return NextResponse.json({ error: 'Code is required' }, { status: 400 });
  }

  const nowIso = new Date().toISOString();

  // Try matching OTP or QR token on active classes
  let clsQuery = supabaseAdmin
    .from('classes')
    .select('id, subject_id, status, latitude, longitude, geofence_radius, otp_expires_at, qr_expires_at, created_at, subjects(name, code)')
    .eq('status', 'active');

  const isOtp = code.length <= 6;
  if (isOtp) {
    clsQuery = clsQuery.eq('otp', code);
  } else {
    clsQuery = clsQuery.eq('qr_code', code);
  }

  const { data: cls, error } = await clsQuery.maybeSingle();

  if (error || !cls) {
    return NextResponse.json({
      found: false,
      error: 'Active class session not found for this code. Please verify the code or ask teacher.',
    }, { status: 404 });
  }

  // Strict 10-Minute Maximum Limit Check
  if (cls.created_at) {
    const elapsedMs = Date.now() - new Date(cls.created_at).getTime();
    if (elapsedMs >= 10 * 60 * 1000) {
      await closeClassAndMarkAbsent(cls.id, cls.subject_id);
      return NextResponse.json({
        found: false,
        error: 'This class session has expired (10-minute maximum limit exceeded). Attendance is closed.',
      }, { status: 400 });
    }
  }

  // Check expiry
  if (isOtp && cls.otp_expires_at && new Date(cls.otp_expires_at) < new Date()) {
    return NextResponse.json({
      found: false,
      error: 'OTP code has expired. Please ask the teacher to regenerate it.',
    }, { status: 400 });
  }

  if (!isOtp && cls.qr_expires_at && new Date(cls.qr_expires_at) < new Date()) {
    return NextResponse.json({
      found: false,
      error: 'QR code has expired. Please ask the teacher to regenerate it.',
    }, { status: 400 });
  }

  const settings = await getClassSettings(cls.id);

  // Target Branch and Group verification for students
  if (session.user.role === 'student' && (settings.target_branch || settings.target_group)) {
    const studentId = session.user.userId || (session.user as any).id;
    const { data: studentUser } = await supabaseAdmin
      .from('users')
      .select('branch, section, signup_info')
      .eq('id', studentId)
      .single();

    if (studentUser) {
      const sBranch = (studentUser.signup_info?.branch || studentUser.branch || '').toUpperCase().trim();
      const sGroup = (studentUser.signup_info?.group || studentUser.section || '').toUpperCase().trim();
      const sSubGroup = (studentUser.signup_info?.sub_group || '').toUpperCase().trim();

      if (settings.target_branch && sBranch !== settings.target_branch.toUpperCase().trim()) {
        return NextResponse.json({
          found: false,
          error: `This attendance session is exclusively for ${settings.target_branch} branch students. (Your branch: ${sBranch || 'None'})`,
        }, { status: 403 });
      }

      if (settings.target_group) {
        const target = settings.target_group.toUpperCase().trim();
        let matchGroup = false;
        if (target === 'G1') {
          matchGroup = sGroup.startsWith('G1') || sSubGroup.startsWith('G1');
        } else if (target === 'G2') {
          matchGroup = sGroup.startsWith('G2') || sSubGroup.startsWith('G2');
        } else if (['G1A', 'G1B', 'G2A', 'G2B'].includes(target)) {
          matchGroup = sSubGroup === target || sGroup === target;
        } else {
          matchGroup = sGroup.includes(target) || sSubGroup.includes(target);
        }

        if (!matchGroup) {
          return NextResponse.json({
            found: false,
            error: `This attendance session is exclusively for Group ${settings.target_group}. (Your group: ${sGroup || sSubGroup || 'None'})`,
          }, { status: 403 });
        }
      }
    }
  }

  // Also verify if latitude/longitude are set; if not, geofence cannot be enforced anyway
  const hasCoordinates = !!(cls.latitude && cls.longitude);
  const requireGeofence = settings.require_geofence && hasCoordinates;

  const subjectInfo = Array.isArray(cls.subjects) ? cls.subjects[0] : cls.subjects;

  return NextResponse.json({
    found: true,
    classId: cls.id,
    subjectName: (subjectInfo as any)?.name || 'Subject',
    subjectCode: (subjectInfo as any)?.code || '',
    requireGeofence,
    requireFace: settings.require_face,
    targetBranch: settings.target_branch || null,
    targetGroup: settings.target_group || null,
  });
}
