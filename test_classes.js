const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function test() {
  const { data: classes, error } = await supabase.from('classes').select('*');
  console.log("All Classes:", classes);
  if (error) console.log(error);
}
test();
