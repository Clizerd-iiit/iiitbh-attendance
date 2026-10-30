import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { updateAttendanceInSheet } from '@/lib/sheets';
import type { AttendanceStatus } from '@/types';

import { rateLimit, getIp } from '@/lib/rate-limit';
import { getClassSettings } from '@/lib/classSettings';
import { closeClassAndMarkAbsent } from '@/lib/autoCloseClasses';
import {
  checkOtpLockout,
  recordFailedOtpAttempt,
  clearOtpAttempts,
  validateCoordinates,
  trackDeviceAttendance
} from '@/lib/security';

export async function POST(req: NextRequest) {
  const ip = getIp(req);
  if (!rateLimit(ip, 12, 60000)) return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 });

  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  let { studentId, status, method, qrToken, otp, latitude, longitude, recordId, classId, accuracy, deviceFingerprint } = body;
  
  // Workaround for DB constraint missing kiosk/ai_vision

  // Advanced Geofencing & Device API Protection
  // Server-side anomaly detection (prevent VPN/Proxy spoofing)
  const isVpnOrProxy = req.headers.get('via') || req.headers.get('x-proxy-id') || req.headers.get('cf-pseudo-ipv4');
  if (isVpnOrProxy && (method === 'qr' || method === 'otp')) {
    return NextResponse.json({ error: 'VPN or Proxy detected. Please connect directly to mark attendance.' }, { status: 403 });
  }

  let dbMethod = method;
  if (method === 'kiosk' || method === 'ai_vision') dbMethod = 'manual';

  // Device Token Identification for Proxy Prevention
  const deviceToken = String(
    deviceFingerprint ||
    `${req.headers.get('user-agent') || ''}:${req.headers.get('accept-language') || ''}:${ip}`
  ).slice(0, 150);


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

  // If self-marking via QR or OTP, enforce active status and 10-minute max limit
  if (method === 'qr' || method === 'otp') {
    const { data: currentCls } = await supabaseAdmin
      .from('classes')
      .select('id, status, created_at, subject_id')
      .eq('id', classId)
      .single();

    if (!currentCls || currentCls.status !== 'active') {
      return NextResponse.json({ error: 'This class session is closed.' }, { status: 400 });
    }

    if (currentCls.created_at) {
      const elapsedMs = Date.now() - new Date(currentCls.created_at).getTime();
      if (elapsedMs >= 10 * 60 * 1000) {
        await closeClassAndMarkAbsent(currentCls.id, currentCls.subject_id);
        return NextResponse.json({ error: 'This class session has expired (10-minute maximum limit exceeded). Attendance is closed.' }, { status: 400 });
      }
    }
  }

  // SECURITY: Determine acting user vs target student
  const currentUserId = (session.user.userId || (session.user as any).id) as string;
  let canManageAttendance = ['teacher', 'superadmin'].includes(session.user.role as string);
  if (!canManageAttendance && session.user.role === 'student' && classId && currentUserId) {
    const { canCREditClass } = await import('@/lib/delegation');
    canManageAttendance = await canCREditClass(currentUserId, classId);
  }

  if (['manual', 'kiosk'].includes(method) && !canManageAttendance) {
    return NextResponse.json({ error: 'Students can only mark via QR or OTP' }, { status: 403 });
  }

  let targetStudentId = currentUserId;
  if (canManageAttendance) {
    targetStudentId = studentId || currentUserId;
  }

  // Device Sharing Proxy Detection (Stop one device marking for multiple different students)
  if (!canManageAttendance && (method === 'qr' || method === 'otp')) {
    const devCheck = trackDeviceAttendance(classId, deviceToken, targetStudentId);
    if (devCheck.isProxyDetected) {
      await logAudit({
        userId: targetStudentId,
        action: 'MULTI_ACCOUNT_DEVICE_PROXY_FLAGGED',
        tableName: 'attendance',
        recordId: classId,
        newValue: { otherStudentsCount: devCheck.otherStudentsCount, ip },
        ipAddress: ip,
      });
      return NextResponse.json({
        error: 'Multiple accounts detected using this device for attendance. Proxy attendance is strictly prohibited.',
      }, { status: 403 });
    }
  }

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
      
    const classSettings = await getClassSettings(classId);

    // Anti-Proxy Check (only if require_geofence is enabled)
    if (classSettings.require_geofence && cls.latitude && cls.longitude) {
      if (!latitude || !longitude) return NextResponse.json({ error: 'Location required to mark attendance (Anti-Proxy enabled)' }, { status: 400 });
      
      const geoCheck = validateCoordinates(latitude, longitude, accuracy);
      if (!geoCheck.isValid) {
        return NextResponse.json({ error: geoCheck.error }, { status: 400 });
      }

      const dist = getDistance(cls.latitude, cls.longitude, latitude, longitude);
      const allowedRadius = cls.geofence_radius || 150;
      if (dist > allowedRadius) {
        return NextResponse.json({ error: `Too far from class! You are ${Math.round(dist)}m away. Max allowed is ${allowedRadius}m.` }, { status: 400 });
      }
    }
  }

  if (method === 'otp') {
    // 1. Anti-Brute-Force Check
    const otpLock = checkOtpLockout(targetStudentId, classId);
    if (otpLock.isLocked) {
      return NextResponse.json({
        error: `Too many failed OTP attempts. You are locked out of OTP entry for ${otpLock.remainingMinutes} more minute(s). Please use QR Code or contact teacher.`,
      }, { status: 429 });
    }

    const { data: cls } = await supabaseAdmin
      .from('classes').select('otp, otp_expires_at, latitude, longitude, geofence_radius').eq('id', classId).single();
    if (!cls || cls.otp !== otp) {
      const { isNowLocked, attemptsLeft } = recordFailedOtpAttempt(targetStudentId, classId);
      await logAudit({
        userId: targetStudentId,
        action: isNowLocked ? 'OTP_BRUTE_FORCE_LOCKOUT' : 'FAILED_OTP_ATTEMPT',
        tableName: 'attendance',
        recordId: classId,
        newValue: { attemptsLeft, isNowLocked },
        ipAddress: ip,
      });

      return NextResponse.json({
        error: isNowLocked
          ? 'Too many incorrect OTP attempts! You are locked out of OTP for 10 minutes.'
          : `Invalid OTP. ${attemptsLeft} attempt(s) remaining before lockout.`
      }, { status: 400 });
    }

    if (new Date(cls.otp_expires_at) < new Date())
      return NextResponse.json({ error: 'OTP expired' }, { status: 400 });

    // Success -> clear OTP attempts
    clearOtpAttempts(targetStudentId, classId);

    const classSettings = await getClassSettings(classId);

    // Anti-Proxy Check (only if require_geofence is enabled)
    if (classSettings.require_geofence && cls.latitude && cls.longitude) {
      if (!latitude || !longitude) return NextResponse.json({ error: 'Location required to mark attendance (Anti-Proxy enabled)' }, { status: 400 });
      
      const geoCheck = validateCoordinates(latitude, longitude, accuracy);
      if (!geoCheck.isValid) {
        return NextResponse.json({ error: geoCheck.error }, { status: 400 });
      }

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
