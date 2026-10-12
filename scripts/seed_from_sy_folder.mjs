/**
 * seed_from_sy_folder.mjs
 * ---------------------------------------------------
 * Reads your local SY folder, uploads PDF/PPTX files
 * to Supabase Storage, then seeds the DB with
 * subject & resource records.
 *
 * Usage:
 *   node scripts/seed_from_sy_folder.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname, basename } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ── Config ───────────────────────────────────────────────
const SUPABASE_URL  = 'https://hegxlofeedmbvbqvinac.supabase.co';
// Use the SERVICE ROLE key for uploads (not the anon key).
// Go to Supabase → Settings → API → service_role key and paste below:
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_KEY || 'PASTE_YOUR_SERVICE_ROLE_KEY_HERE';
const BUCKET        = 'materials';
const SY_PATH       = 'D:\\Users\\Raj\\Downloads\\SY-20260319T084231Z-3-001\\SY';
const ALLOWED_EXT   = new Set(['.pdf', '.pptx', '.docx']);

// ── Subject map (folder name → DB subject info) ──────────
const SUBJECT_MAP = {
  'AIA,AIEC- FAI': { title: 'Foundations of AI',         description: 'Artificial Intelligence & Applications',        branch: 'CS', semester: 4 },
  'AJPL':          { title: 'Advanced Java Programming',  description: 'Java, Servlets, JSP and frameworks',            branch: 'CS', semester: 4 },
  'CC,BDCE- FCC':  { title: 'Cloud Computing',            description: 'Cloud architecture, security, and Big Data',    branch: 'CS', semester: 4 },
  'CORE-TOC':      { title: 'Theory of Computation',      description: 'Automata, Formal Languages, and Computability', branch: 'CS', semester: 4 },
  'CSF,BT- CSE':   { title: 'Cyber Security Fundamentals',description: 'Security concepts, cryptography, blockchain',   branch: 'CS', semester: 4 },
  'EE':            { title: 'Engineering Economics',       description: 'Finance, capital budgeting & cost analysis',    branch: 'CS', semester: 4 },
  'MFC-III':       { title: 'Mathematics III',             description: 'Linear Algebra, Fourier, Laplace Transforms',  branch: 'CS', semester: 3 },
  'OS':            { title: 'Computer Networks',           description: 'Network layers, protocols, TCP/IP & routing',   branch: 'CS', semester: 4 },
  'PPPL':          { title: 'Python Programming',          description: 'Python language, OOP, libraries & lab',        branch: 'CS', semester: 3 },
  'WTPL':          { title: 'Web Technology',              description: 'HTML, CSS, JavaScript & Web Lab',              branch: 'CS', semester: 3 },
};

// ── Helpers ─────────────────────────────────────────────
function walk(dir) {
  const results = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      results.push(...walk(full));
    } else if (ALLOWED_EXT.has(extname(name).toLowerCase())) {
      results.push(full);
    }
  }
  return results;
}

function guessType(filePath) {
  const ext = extname(filePath).toLowerCase();
  const lower = filePath.toLowerCase();
  if (lower.includes('ppt')) return 'ppt';
  if (ext === '.pdf' && (lower.includes('note') || lower.includes('unit'))) return 'note';
  return 'extra';
}

function getSubjectFolder(filePath) {
  // SY_PATH\<subjectFolder>\...
  const rel = filePath.replace(SY_PATH + '\\', '');
  return rel.split('\\')[0];
}

// ── Main ────────────────────────────────────────────────
async function main() {
  if (SERVICE_KEY === 'PASTE_YOUR_SERVICE_ROLE_KEY_HERE') {
    console.error('\n❌  Please set SUPABASE_SERVICE_KEY env var or paste the service_role key into the script.\n');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  console.log('✅  Connected to Supabase\n');

  // 1. Upsert subjects
  const subjectIdMap = {};
  for (const [folder, info] of Object.entries(SUBJECT_MAP)) {
    const { data, error } = await supabase
      .from('subjects')
      .upsert({ ...info }, { onConflict: 'title' })
      .select('id, title')
      .single();
    if (error) { console.error(`Subject upsert error (${folder}):`, error.message); continue; }
    subjectIdMap[folder] = data.id;
    console.log(`📚  Subject: ${data.title} → ${data.id}`);
  }

  // 2. Walk folder and upload files
  const files = walk(SY_PATH);
  console.log(`\n📁  Found ${files.length} files to process...\n`);

  let uploaded = 0, skipped = 0, errors = 0;

  for (const filePath of files) {
    const folder = getSubjectFolder(filePath);
    const subjectId = subjectIdMap[folder];
    if (!subjectId) { skipped++; continue; }

    const rel = filePath.replace(SY_PATH + '\\', '').replace(/\\/g, '/');
    const storagePath = `sy/${rel}`;
    const title = basename(filePath, extname(filePath)).replace(/[-_]/g, ' ').trim();
    const type = guessType(filePath);

    // Upload file
    const fileBuffer = readFileSync(filePath);
    const mimeType = extname(filePath).toLowerCase() === '.pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, fileBuffer, { contentType: mimeType, upsert: true });

    if (uploadError && !uploadError.message.includes('already exists')) {
      console.error(`  ❌  Upload failed: ${rel} — ${uploadError.message}`);
      errors++;
      continue;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

    // Insert resource
    const { error: resError } = await supabase.from('resources').upsert({
      subject_id: subjectId,
      title,
      type,
      url: publicUrl,
    }, { onConflict: 'url' });

    if (resError) {
      console.error(`  ❌  Resource insert failed: ${title} — ${resError.message}`);
      errors++;
    } else {
      console.log(`  ✅  [${type.toUpperCase()}] ${title}`);
      uploaded++;
    }
  }

  console.log('\n─────────────────────────────────');
  console.log(`✅  Uploaded:  ${uploaded}`);
  console.log(`⏭️   Skipped:   ${skipped}`);
  console.log(`❌  Errors:    ${errors}`);
  console.log('─────────────────────────────────\n');
  console.log('🎉  Done! Refresh your CampusLearn dashboard to see all subjects & resources.\n');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
