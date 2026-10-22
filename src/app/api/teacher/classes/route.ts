import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { autoCloseAbandonedClasses } from '@/lib/autoCloseClasses';
import { setClassSettings } from '@/lib/classSettings';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await autoCloseAbandonedClasses();
  const { searchParams } = new URL(req.url);
  const subjectId = searchParams.get('subject_id');
  const limit = parseInt(searchParams.get('limit') || '500');

  let mySubjectIds: string[] = [];
  if (session.user.role === 'teacher') {
    const { data: subjects } = await supabaseAdmin
      .from('subjects')
      .select('id, teacher_ids, teacher_id');
    mySubjectIds = (subjects || [])
      .filter((s: any) => {
        const isArr = s.teacher_ids && Array.isArray(s.teacher_ids) && s.teacher_ids.includes(session.user.userId);
        const isSingle = s.teacher_id === session.user.userId;
        return isArr || isSingle;
      })
      .map((s: any) => s.id);
  }

  let query = supabaseAdmin.from('classes')
    .select('id, date, start_time, status, subject_id, created_by, subjects!inner(name, code)')
    .neq('status', 'scheduled')
    .order('date', { ascending: false })
    .limit(limit);

  if (subjectId) {
    if (session.user.role === 'teacher' && !mySubjectIds.includes(subjectId)) {
      return NextResponse.json({ classes: [] });
    }
    query = query.eq('subject_id', subjectId);
  } else if (session.user.role === 'teacher') {
    if (mySubjectIds.length === 0) {
      return NextResponse.json({ classes: [] });
    }
    query = query.in('subject_id', mySubjectIds);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich with creator info (to distinguish CR conducted classes vs Teacher conducted classes)
  const creatorIds = Array.from(new Set((data || []).map((c: any) => c.created_by).filter(Boolean)));
  let creatorMap: Record<string, { name: string; role: string }> = {};
  if (creatorIds.length > 0) {
    const { data: creators } = await supabaseAdmin
      .from('users')
      .select('id, name, role')
      .in('id', creatorIds);
    if (creators) {
      creatorMap = Object.fromEntries(creators.map((u: any) => [u.id, { name: u.name, role: u.role }]));
    }
  }

  const enriched = (data || []).map((c: any) => ({
    ...c,
    creator_name: creatorMap[c.created_by]?.name || null,
    creator_role: creatorMap[c.created_by]?.role || null,
    is_cr_conducted: !!c.created_by && c.created_by !== session.user.userId && creatorMap[c.created_by]?.role === 'student',
  }));

  return NextResponse.json({ classes: enriched });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['teacher','superadmin'].includes(session.user.role as string))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

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
  } = body;

  if (session.user.role === 'teacher') {
    const { data: subject } = await supabaseAdmin.from('subjects')
      .select('teacher_ids, teacher_id').eq('id', subjectId).single();
    const isTeacherOfSubject =
      (subject?.teacher_ids && Array.isArray(subject.teacher_ids) && subject.teacher_ids.includes(session.user.userId)) ||
      subject?.teacher_id === session.user.userId;
    if (!isTeacherOfSubject)
      return NextResponse.json({ error: 'Not your subject' }, { status: 403 });
  }

  const now = new Date();
  
  // Enforce IST (Indian Standard Time) for database date/start_time
  const istString = now.toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' });
  const [istDate, istTime] = istString.split(' ');

  // If method is kiosk, make tokens unguessable so students can't self-mark
  const qrCode = method === 'kiosk' ? uuidv4() + '-kiosk' : uuidv4();
  const otp = method === 'kiosk' ? 'KIOSK-' + Math.floor(Math.random()*10000) : Math.floor(1000 + Math.random() * 9000).toString();

  // If geofence is disabled, store null coordinates
  const finalLat = requireGeofence ? latitude : null;
  const finalLon = requireGeofence ? longitude : null;
  const finalRadius = requireGeofence ? (geofenceRadius || 150) : 0;

  const { data: newClass, error } = await supabaseAdmin.from('classes').insert({
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
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Store verification flags
  await setClassSettings(newClass.id, {
    require_geofence: !!requireGeofence,
    require_face: !!requireFace,
  });

  return NextResponse.json({ class: newClass, qrCode, otp });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['teacher', 'superadmin'].includes(session.user.role as string))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { classId, action } = body;

  const { data: cls } = await supabaseAdmin
    .from('classes')
    .select('id, created_by, subject_id')
    .eq('id', classId)
    .single();

  if (!cls) return NextResponse.json({ error: 'Class not found' }, { status: 404 });

  if (session.user.role === 'teacher') {
    const { data: subject } = await supabaseAdmin
      .from('subjects')
      .select('teacher_ids, teacher_id')
      .eq('id', cls.subject_id)
      .single();

    const isTeacherOfSubject =
      (subject?.teacher_ids && Array.isArray(subject.teacher_ids) && subject.teacher_ids.includes(session.user.userId)) ||
      subject?.teacher_id === session.user.userId;
    const isCreator = cls.created_by === session.user.userId;

    if (!isTeacherOfSubject && !isCreator) {
      return NextResponse.json({ error: 'Not authorized for this subject' }, { status: 403 });
    }
  }

  if (action === 'close') {
    await supabaseAdmin.from('classes').update({ status: 'closed' }).eq('id', classId);
    const { data: enrolled } = await supabaseAdmin.from('enrollments').select('student_id').eq('subject_id', cls.subject_id);
    const { data: marked }   = await supabaseAdmin.from('attendance').select('student_id').eq('class_id', classId);
    const markedIds = new Set(marked?.map(m => m.student_id) || []);
    const absentStudents = (enrolled||[]).filter(e => !markedIds.has(e.student_id))
      .map(e => ({ class_id: classId, student_id: e.student_id, status: 'A', method: 'auto' }));
    if (absentStudents.length > 0) await supabaseAdmin.from('attendance').insert(absentStudents);
    return NextResponse.json({ success: true });
  }

  if (action === 'regenerate_tokens') {
    const { qrInterval = 60, otpInterval = 60 } = body;
    const newQr = uuidv4();
    const newOtp = Math.floor(1000 + Math.random() * 9000).toString();
    await supabaseAdmin.from('classes').update({
      qr_code: newQr, 
      qr_expires_at: new Date(Date.now() + qrInterval * 1000).toISOString(),
      otp: newOtp,
      otp_expires_at: new Date(Date.now() + otpInterval * 1000).toISOString()
    }).eq('id', classId);
    return NextResponse.json({ qrCode: newQr, otp: newOtp });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['teacher', 'superadmin'].includes(session.user.role as string))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await autoCloseAbandonedClasses();
  const { searchParams } = new URL(req.url);
  const classId = searchParams.get('classId');
  if (!classId) return NextResponse.json({ error: 'Missing classId' }, { status: 400 });

  // Verify ownership
  const { data: cls } = await supabaseAdmin
    .from('classes')
    .select('id, created_by, subject_id, date')
    .eq('id', classId)
    .single();

  if (!cls) return NextResponse.json({ error: 'Class not found' }, { status: 404 });

  if (session.user.role === 'teacher') {
    const { data: subject } = await supabaseAdmin
      .from('subjects')
      .select('teacher_ids, teacher_id')
      .eq('id', cls.subject_id)
      .single();

    const isTeacherOfSubject =
      (subject?.teacher_ids && Array.isArray(subject.teacher_ids) && subject.teacher_ids.includes(session.user.userId)) ||
      subject?.teacher_id === session.user.userId;
    const isCreator = cls.created_by === session.user.userId;

    if (!isTeacherOfSubject && !isCreator) {
      return NextResponse.json({ error: 'Not authorized to delete this class' }, { status: 403 });
    }
  }

  // 1. Delete poll votes & polls linked to this class
  const { data: polls } = await supabaseAdmin.from('polls').select('id').eq('class_id', classId);
  if (polls && polls.length > 0) {
    const pollIds = polls.map((p: any) => p.id);
    await supabaseAdmin.from('poll_votes').delete().in('poll_id', pollIds);
    await supabaseAdmin.from('polls').delete().eq('class_id', classId);
  }

  // 2. Delete attendance records for this class
  await supabaseAdmin.from('attendance').delete().eq('class_id', classId);

  // 3. Delete class verification config from system_settings if any
  await supabaseAdmin.from('system_settings').delete().eq('key', `class_cfg_${classId}`);

  // 4. Delete the class itself
  const { error } = await supabaseAdmin.from('classes').delete().eq('id', classId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 5. Log audit
  await logAudit({
    userId: session.user.userId!,
    action: 'DELETE_CLASS',
    tableName: 'classes',
    recordId: classId,
    newValue: { subject_id: cls.subject_id, date: cls.date },
    ipAddress: req.headers.get('x-forwarded-for') || 'unknown'
  });

  return NextResponse.json({ success: true });
}
