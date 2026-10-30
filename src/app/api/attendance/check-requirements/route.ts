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
  });
}
