import { supabaseAdmin } from './supabase';

export async function autoCloseAbandonedClasses() {
  try {
    // Find classes that are 'active' and created more than 3 hours ago
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    
    const { data: abandonedClasses, error } = await supabaseAdmin
      .from('classes')
      .select('id, subject_id, created_at')
      .eq('status', 'active')
      .lt('created_at', threeHoursAgo);

    if (error || !abandonedClasses || abandonedClasses.length === 0) {
      return;
    }

    for (const cls of abandonedClasses) {
      // 1. Close the class
      await supabaseAdmin.from('classes').update({ status: 'closed' }).eq('id', cls.id);

      // 2. Mark unmarked enrolled students as Absent
      const { data: enrolled } = await supabaseAdmin.from('enrollments').select('student_id').eq('subject_id', cls.subject_id);
      const { data: marked } = await supabaseAdmin.from('attendance').select('student_id').eq('class_id', cls.id);
      
      const markedIds = new Set(marked?.map(m => m.student_id) || []);
      const absentStudents = (enrolled || [])
        .filter(e => !markedIds.has(e.student_id))
        .map(e => ({ class_id: cls.id, student_id: e.student_id, status: 'A', method: 'auto' }));
        
      if (absentStudents.length > 0) {
        await supabaseAdmin.from('attendance').insert(absentStudents);
      }
    }
    
    console.log(`Auto-closed ${abandonedClasses.length} abandoned classes.`);
  } catch (err) {
    console.error('Error auto-closing classes:', err);
  }
}
