import { supabaseAdmin } from './supabase';
import { backupClassAttendance } from './secondaryBackup';

/**
 * Closes an active class session, marks any unmarked enrolled students as Absent ('A', method: 'auto'),
 * updates the class status to 'closed' with the current IST end_time, and triggers secondary backup.
 */
export async function closeClassAndMarkAbsent(classId: string, subjectId?: string) {
  try {
    let subjId = subjectId;
    if (!subjId) {
      const { data: cls } = await supabaseAdmin
        .from('classes')
        .select('subject_id, status')
        .eq('id', classId)
        .single();
      if (!cls || cls.status === 'closed') return;
      subjId = cls.subject_id;
    }

    // Set end_time in Indian Standard Time (IST)
    const now = new Date();
    const istString = now.toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' });
    const istTime = istString.split(' ')[1] || now.toTimeString().split(' ')[0];

    // 1. Close the class
    await supabaseAdmin
      .from('classes')
      .update({ status: 'closed', end_time: istTime })
      .eq('id', classId);

    // 2. Mark unmarked enrolled students as Absent
    const { data: enrolled } = await supabaseAdmin
      .from('enrollments')
      .select('student_id')
      .eq('subject_id', subjId);
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
        method: 'auto'
      }));
      
    if (absentStudents.length > 0) {
      await supabaseAdmin.from('attendance').insert(absentStudents);
    }

    // 3. Trigger secondary append-only backup
    backupClassAttendance(classId).catch(err => console.error('[AutoClose Backup Error]:', err));
  } catch (err) {
    console.error(`[closeClassAndMarkAbsent] Error closing class ${classId}:`, err);
  }
}

/**
 * Automatically closes any active classes that have exceeded the strict 10-minute maximum limit.
 */
export async function autoCloseAbandonedClasses() {
  try {
    // 10 minutes maximum duration cutoff
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    const { data: abandonedClasses, error } = await supabaseAdmin
      .from('classes')
      .select('id, subject_id, created_at')
      .eq('status', 'active')
      .lt('created_at', tenMinutesAgo);

    if (error || !abandonedClasses || abandonedClasses.length === 0) {
      return;
    }

    for (const cls of abandonedClasses) {
      await closeClassAndMarkAbsent(cls.id, cls.subject_id);
    }
    
    console.log(`Auto-closed ${abandonedClasses.length} class(es) exceeding 10 minutes limit.`);
  } catch (err) {
    console.error('Error auto-closing classes:', err);
  }
}
