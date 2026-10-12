/**
 * seed_sy.mjs  –  Run: node scripts/seed_sy.mjs
 * Provide admin creds as env vars:
 *   $env:ADMIN_EMAIL="you@example.com"; $env:ADMIN_PASS="yourpass"; node scripts/seed_sy.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname, basename } from 'path';

const URL  = 'https://hegxlofeedmbvbqvinac.supabase.co';
const ANON = 'sb_publishable_gj2HX9Nu5QZusNwBb93Yiw_yvv6SpOF';
const EMAIL = process.env.ADMIN_EMAIL;
const PASS  = process.env.ADMIN_PASS;
const SY    = 'D:\\Users\\Raj\\Downloads\\SY-20260319T084231Z-3-001\\SY';
const BUCKET = 'materials';
const OK_EXT = new Set(['.pdf', '.pptx', '.docx']);

// ── Subject definitions ──────────────────────────────────
const SUBJECTS = {
  'AIA,AIEC- FAI': { title:'Foundations of AI',          description:'Artificial Intelligence, machine learning & applications', branch:'CS', semester:4 },
  'AJPL':          { title:'Advanced Java Programming',   description:'Java, Servlets, JSP, and enterprise frameworks',          branch:'CS', semester:4 },
  'CC,BDCE- FCC':  { title:'Cloud Computing',             description:'Cloud architecture, Big Data, security & deployment',     branch:'CS', semester:4 },
  'CORE-TOC':      { title:'Theory of Computation',       description:'Automata, formal languages, and computability',          branch:'CS', semester:4 },
  'CSF,BT- CSE':   { title:'Cyber Security Fundamentals', description:'Security, cryptography, blockchain concepts',            branch:'CS', semester:4 },
  'EE':            { title:'Engineering Economics',        description:'Finance, capital budgeting, time value of money',       branch:'CS', semester:4 },
  'MFC-III':       { title:'Mathematics III',              description:'Linear algebra, Fourier, Laplace transforms',           branch:'CS', semester:3 },
  'OS':            { title:'Computer Networks (CN)',        description:'Network layers, TCP/IP, routing protocols & lab',      branch:'CS', semester:4 },
  'PPPL':          { title:'Python Programming Lab',       description:'Python language, OOP, data structures & lab manual',   branch:'CS', semester:3 },
  'WTPL':          { title:'Web Technology Lab',           description:'HTML, CSS, JavaScript & web lab experiments',          branch:'CS', semester:3 },
};

function walk(dir) {
  const out = [];
  for (const f of readdirSync(dir)) {
    const full = join(dir, f);
    statSync(full).isDirectory() ? out.push(...walk(full)) : OK_EXT.has(extname(f).toLowerCase()) && out.push(full);
  }
  return out;
}

function guessType(p) {
  const l = p.toLowerCase();
  if (l.includes('.pptx')) return 'ppt';
  if (l.includes('note') || l.includes('unit')) return 'note';
  return 'extra';
}

async function main() {
  if (!EMAIL || !PASS) {
    console.error('\n❌  Set ADMIN_EMAIL and ADMIN_PASS env vars before running.\n');
    console.error('   $env:ADMIN_EMAIL="you@email.com"; $env:ADMIN_PASS="pass"; node scripts/seed_sy.mjs\n');
    process.exit(1);
  }

  const sb = createClient(URL, ANON);

  // 1. Sign in
  console.log(`\n🔐  Signing in as ${EMAIL}...`);
  const { error: authErr } = await sb.auth.signInWithPassword({ email: EMAIL, password: PASS });
  if (authErr) { console.error('❌  Auth failed:', authErr.message); process.exit(1); }
  console.log('✅  Signed in!\n');

  // 2. Upsert subjects
  const idMap = {};
  for (const [folder, info] of Object.entries(SUBJECTS)) {
    const { data, error } = await sb.from('subjects')
      .upsert(info, { onConflict: 'title' })
      .select('id,title').single();
    if (error) { console.error(`  ❌  Subject "${info.title}":`, error.message); continue; }
    idMap[folder] = data.id;
    console.log(`📚  ${data.title}`);
  }

  // 3. Upload files
  const files = walk(SY);
  console.log(`\n📁  ${files.length} files to upload...\n`);

  let ok = 0, skip = 0, fail = 0;
  for (const filePath of files) {
    const folderKey = filePath.replace(SY + '\\', '').split('\\')[0];
    const subjectId = idMap[folderKey];
    if (!subjectId) { skip++; continue; }

    const rel   = filePath.replace(SY + '\\', '').replace(/\\/g, '/');
    const spath = `sy/${rel}`;
    const title = basename(filePath, extname(filePath)).replace(/[_-]/g, ' ').trim();
    const mime  = extname(filePath) === '.pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

    // Upload
    const { error: upErr } = await sb.storage.from(BUCKET)
      .upload(spath, readFileSync(filePath), { contentType: mime, upsert: true });
    if (upErr && !upErr.message?.includes('already exists')) {
      console.error(`  ❌  ${rel}:`, upErr.message); fail++; continue;
    }

    // Public URL
    const { data: { publicUrl } } = sb.storage.from(BUCKET).getPublicUrl(spath);

    // Insert resource
    const { error: resErr } = await sb.from('resources').upsert(
      { subject_id: subjectId, title, type: guessType(filePath), url: publicUrl },
      { onConflict: 'url' }
    );
    if (resErr) { console.error(`  ❌  Resource "${title}":`, resErr.message); fail++; }
    else { process.stdout.write(`  ✅  ${title.slice(0,60)}\n`); ok++; }
  }

  console.log('\n──────────────────────────────────');
  console.log(`✅  Uploaded : ${ok}`);
  console.log(`⏭   Skipped  : ${skip}`);
  console.log(`❌  Failed   : ${fail}`);
  console.log('──────────────────────────────────');
  console.log('\n🎉  Done! Refresh your dashboard.\n');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
