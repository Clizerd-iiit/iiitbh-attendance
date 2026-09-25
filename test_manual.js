const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data: cls } = await supabase.from('classes').select('*').limit(1);
  if (!cls || cls.length === 0) { console.log("No class"); return; }
  
  const classId = cls[0].id;
  const { data: users } = await supabase.from('users').select('*').eq('role', 'student').limit(1);
  const studentId = users[0].id;

  const { data, error } = await supabase.from('attendance').insert({
    class_id: classId,
    student_id: studentId,
    status: 'P',
    method: 'manual'
  });
  console.log("Manual Insert:", error ? error.message : "Success");

  const { data: data2, error: error2 } = await supabase.from('attendance').insert({
    class_id: classId,
    student_id: studentId,
    status: 'P',
    method: 'kiosk'
  });
  console.log("Kiosk Insert:", error2 ? error2.message : "Success");
}
test();
