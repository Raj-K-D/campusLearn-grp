import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const envContent = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && val.length) env[key.trim()] = val.join('=').trim();
});

const supabase = createClient(env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_ANON_KEY']);

async function run() {
  const { data: subjects } = await supabase.from('subjects').select('id, title, degree_id');
  const { data: resources } = await supabase.from('resources').select('id, subject_id, title, type');
  
  subjects.filter(s => s.degree_id === 'mtech').forEach(sub => {
    console.log(`\n--- Subject: ${sub.title} (ID: ${sub.id}) ---`);
    const subRes = resources.filter(r => r.subject_id === sub.id);
    const notes = subRes.filter(r => r.type === 'note');
    const others = subRes.filter(r => r.type !== 'note');
    console.log(`Notes (${notes.length}):`, notes.map(n => n.title).join(', '));
    console.log(`Other resources:`, others.map(o => `${o.title} [${o.type}]`).join(', '));
  });
}
run();
