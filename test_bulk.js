const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data: activeClass } = await supabase.from('classes').select('*').limit(1);
  if (!activeClass || activeClass.length === 0) return console.log("No class");
  const classId = activeClass[0].id;
  
  const { data: users } = await supabase.from('users').select('*').eq('role', 'student').limit(2);
  
  for (const u of users) {
    const res = await fetch('http://localhost:3000/api/attendance/mark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId, studentId: u.id, status: 'P', method: 'manual' })
    });
    console.log(u.name, res.status);
  }
}
test();
