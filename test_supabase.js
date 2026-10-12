import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ljueqpvkogxctpentmdq.supabase.co';
const supabaseKey = 'sb_publishable_tRMdk-esj-w9u8ztFdSuGw_Tw5dG7GL';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  console.log('Testing Supabase queries...');
  try {
    const pRes = await supabase.from('profiles').select('id, email, full_name, is_admin, is_coordinator');
    console.log('Registered users:', pRes);
  } catch (err) {
    console.error('Unexpected error:', err.message);
  }
}

testConnection();