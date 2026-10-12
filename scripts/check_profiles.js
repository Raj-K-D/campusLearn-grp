import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();

const supabase = createClient(url, key);

async function check() {
  console.log("Checking profiles...");
  const { data: profiles } = await supabase.from('profiles').select('*');
  console.log(JSON.stringify(profiles, null, 2));
}

check();
