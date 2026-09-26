const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fix() {
  const { data: classes } = await supabase.from('classes').select('id, subject_id').eq('status', 'closed');
  for (const cls of classes) {
    const { data: enrolled } = await supabase.from('enrollments').select('student_id').eq('subject_id', cls.subject_id);
    const { data: marked } = await supabase.from('attendance').select('student_id').eq('class_id', cls.id);
    
    const markedIds = new Set(marked.map(m => m.student_id));
    const toMark = enrolled.filter(e => !markedIds.has(e.student_id)).map(e => ({
      class_id: cls.id,
      student_id: e.student_id,
      status: 'A',
      method: 'auto'
    }));
    
    if (toMark.length > 0) {
      console.log(`Inserting ${toMark.length} absents for class ${cls.id}`);
      await supabase.from('attendance').insert(toMark);
    }
  }
}
fix();
