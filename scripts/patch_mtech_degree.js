import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();

const supabase = createClient(url, key);

async function patch() {
  console.log("Patching M.Tech subjects with degree_id='mtech'...");
  const { error } = await supabase
    .from('subjects')
    .update({ degree_id: 'mtech' })
    .eq('branch', 'mtech_cs');
  
  if (error) console.error("Error:", error.message);
  else console.log("✅ Patch successful.");
}

patch();
