import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();

const supabase = createClient(url, key);

async function check() {
  console.log("Checking resources...");
  const { data: res } = await supabase.from('resources').select('*').limit(10);
  console.log(JSON.stringify(res, null, 2));

  console.log("\nChecking subjects...");
  const { data: sub } = await supabase.from('subjects').select('*').limit(10);
  console.log(JSON.stringify(sub, null, 2));
}

check();
