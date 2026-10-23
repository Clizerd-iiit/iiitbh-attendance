import { supabaseAdmin } from './supabase';

export interface AttendanceBackupRecord {
  rollNo: string;
  studentName: string;
  status: 'P' | 'A' | 'Late';
  method: string;
  branch?: string;
  group?: string;
}

export interface AttendanceBackupPayload {
  event: 'CLASS_ATTENDANCE_FINALIZED';
  classId: string;
  subjectCode: string;
  subjectName: string;
  teacherName: string;
  date: string;
  closedAt: string;
  totalEnrolled: number;
  presentCount: number;
  absentCount: number;
  records: AttendanceBackupRecord[];
}

/**
 * Automatically backs up finalized class attendance to a secondary, immutable external storage
 * (e.g., Google Sheet via Webhook, GitHub Audit Repository, etc.)
 * This ensures data preservation even if Supabase records are accidentally or maliciously deleted.
 */
export async function backupClassAttendance(classId: string) {
  try {
    // 1. Check if backup webhook is configured (via env var or system_settings)
    let webhookUrl = process.env.ATTENDANCE_BACKUP_WEBHOOK_URL;
    if (!webhookUrl) {
      const { data: setting } = await supabaseAdmin
        .from('system_settings')
        .select('value')
        .eq('key', 'secondary_backup_webhook_url')
        .single();
      if (setting?.value) {
        webhookUrl = setting.value;
      }
    }

    const ghToken = process.env.GITHUB_BACKUP_TOKEN;
    const ghRepo = process.env.GITHUB_BACKUP_REPO;

    // If no backup targets are configured, exit gracefully
    if (!webhookUrl && (!ghToken || !ghRepo)) {
      return;
    }

    // 2. Fetch class details + subject + teacher
    const { data: cls } = await supabaseAdmin
      .from('classes')
      .select('*, subject:subjects(code, name), teacher:users(name, email)')
      .eq('id', classId)
      .single();

    if (!cls) return;

    // 3. Fetch all attendance entries with student info
    const { data: attendance } = await supabaseAdmin
      .from('attendance')
      .select('status, method, created_at, student:users(name, roll_no, branch, signup_info)')
      .eq('class_id', classId);

    const records: AttendanceBackupRecord[] = (attendance || []).map((a: any) => ({
      rollNo: a.student?.roll_no || 'N/A',
      studentName: a.student?.name || 'Unknown',
      status: a.status || 'A',
      method: a.method || 'auto',
      branch: a.student?.signup_info?.branch || a.student?.branch || 'N/A',
      group: a.student?.signup_info?.group || a.student?.signup_info?.section || 'N/A',
    })).sort((a, b) => a.rollNo.localeCompare(b.rollNo, undefined, { numeric: true }));

    const presentCount = records.filter(r => r.status === 'P' || r.status === 'Late').length;
    const absentCount = records.filter(r => r.status === 'A').length;

    const payload: AttendanceBackupPayload = {
      event: 'CLASS_ATTENDANCE_FINALIZED',
      classId,
      subjectCode: cls.subject?.code || 'N/A',
      subjectName: cls.subject?.name || 'N/A',
      teacherName: cls.teacher?.name || 'Teacher',
      date: cls.date,
      closedAt: new Date().toISOString(),
      totalEnrolled: records.length,
      presentCount,
      absentCount,
      records,
    };

    // 4. Send to Webhook (e.g. Google Apps Script -> Google Sheet)
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        redirect: 'follow',
      }).catch(err => {
        console.error('[Secondary Backup] Webhook Error:', err);
      });
    }

    // 5. Send to GitHub Audit Repo (if configured)
    if (ghToken && ghRepo) {
      const filePath = `attendance/${cls.date}/${(cls.subject?.code || 'SUB').replace(/[^a-zA-Z0-9_-]/g, '')}_${classId}.json`;
      const contentBase64 = Buffer.from(JSON.stringify(payload, null, 2)).toString('base64');
      await fetch(`https://api.github.com/repos/${ghRepo}/contents/${filePath}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${ghToken}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `backup: ${cls.subject?.code} attendance on ${cls.date} [classId: ${classId}]`,
          content: contentBase64,
        }),
      }).catch(err => {
        console.error('[Secondary Backup] GitHub Error:', err);
      });
    }
  } catch (e) {
    console.error('[Secondary Backup Exception]:', e);
  }
}
