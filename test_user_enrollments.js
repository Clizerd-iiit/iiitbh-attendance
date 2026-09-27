const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [k, v] = line.split('=');
  if (k && v) acc[k.trim()] = v.trim();
  return acc;
}, {});
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: user } = await supabase.from('users').select('id, name').ilike('name', '%BALA JI MISHRA%').single();
  if (!user) { console.log("User not found"); return; }
  console.log("User:", user);
  
  const { data: enrollments, error } = await supabase.from('enrollments').select('*').eq('student_id', user.id);
  console.log("Enrollments:", enrollments, "Error:", error);
}
run();
