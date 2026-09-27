const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function wipe() {
  // Delete all attendance records (to be safe)
  await supabase.from('attendance').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  // Delete all classes
  await supabase.from('classes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log("All test classes and attendance wiped!");
}
wipe();
