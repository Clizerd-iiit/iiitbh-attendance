import { supabaseAdmin } from './supabase';
import { backupClassAttendance } from './secondaryBackup';
import { getClassSettings } from './classSettings';

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

    // 2. Mark unmarked enrolled students as Absent (filtered by target branch/group if configured)
    const { data: enrolled } = await supabaseAdmin
      .from('enrollments')
      .select('student_id')
      .eq('subject_id', subjId);
    const { data: marked } = await supabaseAdmin
      .from('attendance')
      .select('student_id')
      .eq('class_id', classId);
    
    const markedIds = new Set(marked?.map((m: any) => m.student_id) || []);
    let targetStudentIds: string[] = (enrolled || []).map((e: any) => e.student_id);

    const cfg = await getClassSettings(classId);
    if ((cfg.target_branch || cfg.target_group) && targetStudentIds.length > 0) {
      const { data: users } = await supabaseAdmin
        .from('users')
        .select('id, branch, section, signup_info')
        .in('id', targetStudentIds);

      if (users && users.length > 0) {
        const filteredUsers = users.filter((u: any) => {
          const sBranch = (u.signup_info?.branch || u.branch || '').toUpperCase().trim();
          const sGroup = (u.signup_info?.group || u.section || '').toUpperCase().trim();
          const sSubGroup = (u.signup_info?.sub_group || '').toUpperCase().trim();
          if (cfg.target_branch && sBranch !== cfg.target_branch.toUpperCase().trim()) return false;
          if (cfg.target_group) {
            const target = cfg.target_group.toUpperCase().trim();
            if (target === 'G1') {
              if (!sGroup.startsWith('G1') && !sSubGroup.startsWith('G1')) return false;
            } else if (target === 'G2') {
              if (!sGroup.startsWith('G2') && !sSubGroup.startsWith('G2')) return false;
            } else if (['G1A', 'G1B', 'G2A', 'G2B'].includes(target)) {
              if (sSubGroup !== target && sGroup !== target) return false;
            } else {
              if (!sGroup.includes(target) && !sSubGroup.includes(target)) return false;
            }
          }
          return true;
        });
        targetStudentIds = filteredUsers.map((u: any) => u.id);
      }
    }

    const absentStudents = targetStudentIds
      .filter((sId: string) => !markedIds.has(sId))
      .map((sId: string) => ({
        class_id: classId,
        student_id: sId,
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
