import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { autoCloseAbandonedClasses } from '@/lib/autoCloseClasses';


export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await autoCloseAbandonedClasses();
  const { searchParams } = new URL(req.url);
  const subjectId = searchParams.get('subject_id');
  const limit = parseInt(searchParams.get('limit') || '20');

  let query = supabaseAdmin.from('classes')
    .select('id, date, start_time, status, subject_id, subjects!inner(name, code)')
    .neq('status', 'scheduled')
    .order('date', { ascending: false })
    .limit(limit);

  if (subjectId) query = query.eq('subject_id', subjectId);
  if (session.user.role === 'teacher') query = query.eq('created_by', session.user.userId);


  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ classes: data });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['teacher','superadmin'].includes(session.user.role as string))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { subjectId, method, latitude, longitude, geofenceRadius, qrInterval = 60, otpInterval = 60 } = body;

  if (session.user.role === 'teacher') {
    const { data: subject } = await supabaseAdmin.from('subjects')
      .select('teacher_ids').eq('id', subjectId).single();
    if (!subject?.teacher_ids?.includes(session.user.userId))
      return NextResponse.json({ error: 'Not your subject' }, { status: 403 });
  }

  const now = new Date();
  // If method is kiosk, make tokens unguessable so students can't self-mark
  const qrCode = method === 'kiosk' ? uuidv4() + '-kiosk' : uuidv4();
  const otp = method === 'kiosk' ? 'KIOSK-' + Math.floor(Math.random()*10000) : Math.floor(1000 + Math.random() * 9000).toString();

  const { data: newClass, error } = await supabaseAdmin.from('classes').insert({
    subject_id: subjectId,
    date: now.toISOString().split('T')[0],
    start_time: now.toTimeString().split(' ')[0],
    qr_code: qrCode,
    qr_expires_at: new Date(now.getTime() + qrInterval * 1000).toISOString(),
    otp,
    otp_expires_at: new Date(now.getTime() + otpInterval * 1000).toISOString(),
    status: 'active',
    created_by: session.user.userId, latitude, longitude, geofence_radius: geofenceRadius || 150,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ class: newClass, qrCode, otp });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { classId, action } = body;

  if (action === 'close') {
    await supabaseAdmin.from('classes').update({ status: 'closed' }).eq('id', classId);
    const { data: cls } = await supabaseAdmin.from('classes').select('subject_id').eq('id', classId).single();
    if (cls) {
      const { data: enrolled } = await supabaseAdmin.from('enrollments').select('student_id').eq('subject_id', cls.subject_id);
      const { data: marked }   = await supabaseAdmin.from('attendance').select('student_id').eq('class_id', classId);
      const markedIds = new Set(marked?.map(m => m.student_id) || []);
      const absentStudents = (enrolled||[]).filter(e => !markedIds.has(e.student_id))
        .map(e => ({ class_id: classId, student_id: e.student_id, status: 'A', method: 'auto' }));
      if (absentStudents.length > 0) await supabaseAdmin.from('attendance').insert(absentStudents);
    }
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
  const { data: cls } = await supabaseAdmin.from('classes').select('created_by').eq('id', classId).single();
  if (session.user.role === 'teacher' && cls?.created_by !== session.user.userId) {
    return NextResponse.json({ error: 'Not your class' }, { status: 403 });
  }

  // Delete attendance records (cascade should handle this if foreign key is set up, but let's be explicit)
  await supabaseAdmin.from('attendance').delete().eq('class_id', classId);
  
  // Delete the class
  const { error } = await supabaseAdmin.from('classes').delete().eq('id', classId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  return NextResponse.json({ success: true });
}
