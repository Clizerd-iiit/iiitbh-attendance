import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { autoCloseAbandonedClasses } from '@/lib/autoCloseClasses';
import { hasActiveDelegationForSubject } from '@/lib/delegation';
import { setClassSettings } from '@/lib/classSettings';

export const dynamic = 'force-dynamic';

// POST: CR starts a new class session — only allowed if an active delegation exists for that subject
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'student')
    return NextResponse.json({ error: 'Only students can use this endpoint' }, { status: 403 });

  const body = await req.json();
  const {
    subjectId,
    method,
    latitude,
    longitude,
    geofenceRadius,
    requireGeofence = true,
    requireFace = true,
    qrInterval = 60,
    otpInterval = 60,
    delegationId,
  } = body;

  if (!subjectId)
    return NextResponse.json({ error: 'subjectId required' }, { status: 400 });

  const userId = (session.user.userId || (session.user as any).id) as string;
  if (!userId) {
    return NextResponse.json({ error: 'User ID missing' }, { status: 401 });
  }

  const hasDelegation = await hasActiveDelegationForSubject(userId, subjectId);
  if (!hasDelegation)
    return NextResponse.json(
      { error: 'No active delegation found for this subject. Teacher permission required.' },
      { status: 403 }
    );

  // Auto-close any abandoned classes before creating a new one
  await autoCloseAbandonedClasses();

  const now = new Date();
  // Use IST for date/time columns
  const istString = now.toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' });
  const [istDate, istTime] = istString.split(' ');

  const qrCode = uuidv4();
  const otp = Math.floor(1000 + Math.random() * 9000).toString();

  const finalLat = requireGeofence ? latitude : null;
  const finalLon = requireGeofence ? longitude : null;
  const finalRadius = requireGeofence ? (geofenceRadius || 150) : 0;

  const { data: newClass, error } = await supabaseAdmin
    .from('classes')
    .insert({
      subject_id: subjectId,
      date: istDate,
      start_time: istTime,
      qr_code: qrCode,
      qr_expires_at: new Date(now.getTime() + qrInterval * 1000).toISOString(),
      otp,
      otp_expires_at: new Date(now.getTime() + otpInterval * 1000).toISOString(),
      status: 'active',
      created_by: session.user.userId,
      latitude: finalLat,
      longitude: finalLon,
      geofence_radius: finalRadius,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await setClassSettings(newClass.id, {
    require_geofence: !!requireGeofence,
    require_face: !!requireFace,
  });

  return NextResponse.json({ class: newClass, qrCode, otp });
}

// PATCH: CR closes their class session or regenerates tokens (after delegation check)
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'student')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const body = await req.json();
  const { classId, action, qrInterval = 60, otpInterval = 60, delegationId } = body;

  // Verify the CR created this class
  const { data: cls } = await supabaseAdmin
    .from('classes')
    .select('created_by, subject_id')
    .eq('id', classId)
    .single();

  if (!cls)
    return NextResponse.json({ error: 'Class not found' }, { status: 404 });

  const userId = (session.user.userId || (session.user as any).id) as string;
  if (!userId)
    return NextResponse.json({ error: 'User ID missing' }, { status: 401 });

  if (cls.created_by !== userId)
    return NextResponse.json({ error: 'Not your class' }, { status: 403 });

  // Verify their delegation is still active
  const hasDelegation = await hasActiveDelegationForSubject(userId, cls.subject_id);
  if (!hasDelegation)
    return NextResponse.json({ error: 'Delegation expired. Contact teacher.' }, { status: 403 });

  if (action === 'close') {
    // Close the class and auto-mark absent for all unenrolled students
    await supabaseAdmin.from('classes').update({ status: 'closed' }).eq('id', classId);

    const { data: enrolled } = await supabaseAdmin
      .from('enrollments')
      .select('student_id')
      .eq('subject_id', cls.subject_id);

    const { data: marked } = await supabaseAdmin
      .from('attendance')
      .select('student_id')
      .eq('class_id', classId);

    const markedIds = new Set(marked?.map((m: any) => m.student_id) || []);
    const absentStudents = (enrolled || [])
      .filter((e: any) => !markedIds.has(e.student_id))
      .map((e: any) => ({
        class_id: classId,
        student_id: e.student_id,
        status: 'A',
        method: 'auto',
      }));

    if (absentStudents.length > 0)
      await supabaseAdmin.from('attendance').insert(absentStudents);

    return NextResponse.json({ success: true });
  }

  if (action === 'regenerate_tokens') {
    const newQr = uuidv4();
    const newOtp = Math.floor(1000 + Math.random() * 9000).toString();
    await supabaseAdmin
      .from('classes')
      .update({
        qr_code: newQr,
        qr_expires_at: new Date(Date.now() + qrInterval * 1000).toISOString(),
        otp: newOtp,
        otp_expires_at: new Date(Date.now() + otpInterval * 1000).toISOString(),
      })
      .eq('id', classId);
    return NextResponse.json({ qrCode: newQr, otp: newOtp });
  }

  return NextResponse.json({ success: true });
}

// GET: CR fetches classes they've created (for history)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'student')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  await autoCloseAbandonedClasses();

  const { data } = await supabaseAdmin
    .from('classes')
    .select('id, date, start_time, status, subject_id, subjects!inner(name, code)')
    .eq('created_by', session.user.userId)
    .order('date', { ascending: false })
    .limit(100);

  return NextResponse.json({ classes: data || [] });
}
