import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { updateAttendanceInSheet } from '@/lib/sheets';
import type { AttendanceStatus } from '@/types';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  let { studentId, status, method, qrToken, otp, latitude, longitude, recordId, classId } = body;
  
  // Workaround for DB constraint missing kiosk/ai_vision
  let dbMethod = method;
  if (method === 'kiosk' || method === 'ai_vision') dbMethod = 'manual';


  // If recordId is provided (e.g. from Admin editor), fetch classId and studentId from DB
  if (recordId) {
    const { data: rec } = await supabaseAdmin.from('attendance').select('class_id, student_id').eq('id', recordId).single();
    if (rec) {
      classId = rec.class_id;
      studentId = rec.student_id;
    } else {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }
  }

  // Auto-detect classId from active classes if missing
  if (!classId) {
    if (method === 'otp' && otp) {
      const { data: activeCls } = await supabaseAdmin.from('classes').select('id').eq('otp', otp).eq('status', 'active').single();
      if (activeCls) classId = activeCls.id;
    } else if (method === 'qr' && qrToken) {
      const { data: activeCls } = await supabaseAdmin.from('classes').select('id').eq('qr_code', qrToken).eq('status', 'active').single();
      if (activeCls) classId = activeCls.id;
    }
  }

  if (!classId) return NextResponse.json({ error: 'Class not found or inactive. Please ask teacher to refresh.' }, { status: 404 });


  // Helper for GPS distance (Haversine in meters)
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const p1 = lat1 * Math.PI/180;
    const p2 = lat2 * Math.PI/180;
    const dp = (lat2-lat1) * Math.PI/180;
    const dl = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(dp/2) * Math.sin(dp/2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl/2) * Math.sin(dl/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };


  if (method === 'qr') {
    const { data: cls } = await supabaseAdmin
      .from('classes').select('qr_code, qr_expires_at, status, latitude, longitude, geofence_radius').eq('id', classId).single();
    if (!cls || cls.qr_code !== qrToken)
      return NextResponse.json({ error: 'Invalid QR code' }, { status: 400 });
    if (new Date(cls.qr_expires_at) < new Date())
      return NextResponse.json({ error: 'QR code expired' }, { status: 400 });
      
    // Anti-Proxy Check
    if (cls.latitude && cls.longitude) {
      if (!latitude || !longitude) return NextResponse.json({ error: 'Location required to mark attendance (Anti-Proxy enabled)' }, { status: 400 });
      const dist = getDistance(cls.latitude, cls.longitude, latitude, longitude);
      const allowedRadius = cls.geofence_radius || 150;
      if (dist > allowedRadius) {
        return NextResponse.json({ error: `Too far from class! You are ${Math.round(dist)}m away. Max allowed is ${allowedRadius}m.` }, { status: 400 });
      }
    }
  }

  if (method === 'otp') {
    const { data: cls } = await supabaseAdmin
      .from('classes').select('otp, otp_expires_at, latitude, longitude, geofence_radius').eq('id', classId).single();
    if (!cls || cls.otp !== otp)
      return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 });
    if (new Date(cls.otp_expires_at) < new Date())
      return NextResponse.json({ error: 'OTP expired' }, { status: 400 });
      
    // Anti-Proxy Check
    if (cls.latitude && cls.longitude) {
      if (!latitude || !longitude) return NextResponse.json({ error: 'Location required to mark attendance (Anti-Proxy enabled)' }, { status: 400 });
      const dist = getDistance(cls.latitude, cls.longitude, latitude, longitude);
      const allowedRadius = cls.geofence_radius || 150;
      if (dist > allowedRadius) {
        return NextResponse.json({ error: `Too far from class! You are ${Math.round(dist)}m away. Max allowed is ${allowedRadius}m.` }, { status: 400 });
      }
    }
  }

  if (method === 'manual' && session.user.role === 'teacher') {
    const { data: cls } = await supabaseAdmin.from('classes').select('subject_id, date').eq('id', classId).single();
    if (cls) {
      const { data: subj } = await supabaseAdmin.from('subjects').select('teacher_ids').eq('id', cls.subject_id).single();
      if (!subj?.teacher_ids?.includes(session.user.userId)) {
        console.error('Mark Manual Failed: Not your subject', { teacher_ids: subj?.teacher_ids, userId: session.user.userId });
        return NextResponse.json({ error: 'Not your subject' }, { status: 403 });
      }
      
      // Enforce 30 days window
      const { data: settings } = await supabaseAdmin.from('system_settings').select('value').eq('key', 'teacher_edit_window_days').single();
      const windowDays = parseInt(settings?.value || '30');
      const classDate = new Date(cls.date);
      const now = new Date();
      const diffDays = (now.getTime() - classDate.getTime()) / (1000 * 3600 * 24);
      if (diffDays > windowDays) {
        return NextResponse.json({ error: `Cannot edit attendance older than ${windowDays} days` }, { status: 400 });
      }
    }
  }

  // SECURITY: Only teachers/admins can mark for others or use kiosk/manual methods
  if (['manual', 'kiosk'].includes(method) && !['teacher', 'superadmin'].includes(session.user.role as string)) {
    return NextResponse.json({ error: 'Students can only mark via QR or OTP' }, { status: 403 });
  }

  let targetStudentId = session.user.userId;
  if (['teacher', 'superadmin'].includes(session.user.role as string)) {
    targetStudentId = studentId || session.user.userId;
  }
  const markStatus: AttendanceStatus = status || 'P';

  const { data: existing } = await supabaseAdmin.from('attendance')
    .select('id, status').eq('class_id', classId).eq('student_id', targetStudentId).single();

  if (existing) {
    await supabaseAdmin.from('attendance').update({
      status: markStatus, method: dbMethod,
      edited_by: session.user.userId, edited_at: new Date().toISOString(),
    }).eq('id', existing.id);
    if (session.user.role !== 'superadmin') {
      await logAudit({ userId: session.user.userId!, action: 'UPDATE_ATTENDANCE',
        tableName: 'attendance', recordId: existing.id,
        oldValue: { status: existing.status }, newValue: { status: markStatus },
        ipAddress: req.headers.get('x-forwarded-for') || 'unknown' });
    }
  } else {
    const { data: newRecord } = await supabaseAdmin.from('attendance')
      .insert({ class_id: classId, student_id: targetStudentId, status: markStatus, method: dbMethod })
      .select().single();
    if (session.user.role !== 'superadmin') {
      await logAudit({ userId: session.user.userId!, action: 'MARK_ATTENDANCE',
        tableName: 'attendance', recordId: newRecord?.id,
        newValue: { status: markStatus, method },
        ipAddress: req.headers.get('x-forwarded-for') || 'unknown' });
    }
  }

  // Async Google Sheets sync
  (async () => {
    const { data: cls } = await supabaseAdmin.from('classes')
      .select('date, subjects(code, name)').eq('id', classId).single();
    const { data: student } = await supabaseAdmin.from('users')
      .select('roll_no, name').eq('id', targetStudentId).single();
    if (cls && student) {
      const sub = cls.subjects as unknown as { code: string; name: string } | null;
      await updateAttendanceInSheet({
        subjectCode: sub?.code || 'UNKNOWN', subjectName: sub?.name || 'Subject',
        date: cls.date, studentRollNo: student.roll_no || targetStudentId,
        studentName: student.name, status: markStatus,
      });
    }
  })();

  return NextResponse.json({ success: true });
}
