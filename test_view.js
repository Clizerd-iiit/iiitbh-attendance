const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function test() {
  const { data, error } = await supabase.rpc('get_view_definition', { view_name: 'student_attendance_summary' }).catch(e => console.log(e));
  if (error) console.log(error);
  else console.log(data);
}
test();
