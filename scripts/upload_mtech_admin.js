/**
 * upload_mtech_admin.js
 * Reads VITE_SUPABASE_SERVICE_ROLE_KEY from .env to bypass RLS.
 * Run ONCE to rebuild all M.Tech data cleanly.
 */
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// ── Parse .env ────────────────────────────────────────────────────────────────
const envPath = path.resolve(process.cwd(), '.env');
const env = {};
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && val.length) env[key.trim()] = val.join('=').trim();
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const serviceRoleKey = env['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !serviceRoleKey) {
  console.error('\n❌ Missing SUPABASE_SERVICE_ROLE_KEY in .env');
  console.error('   Please add it: SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here\n');
  process.exit(1);
}

// Service role key bypasses ALL RLS policies
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// ── BASE PATHS ─────────────────────────────────────────────────────────────────
const BASE1 = 'D:\\Users\\Raj\\Downloads\\Course Student handouts and TTT formats-20260503T103957Z-3-001\\Course Student handouts and TTT formats';
const BASE2 = 'D:\\Users\\Raj\\Downloads\\Course Handouts Mtech CSE Jan 2026 Sem2-20260503T104034Z-3-001\\Course Handouts Mtech';

// ── SUBJECT DEFINITIONS ────────────────────────────────────────────────────────
const SUBJECTS = [
  { title: 'Big Data Analytics',               branch: 'mtech_cs', semester: 2, code: 'CS601' },
  { title: 'Data Modelling and Visualization', branch: 'mtech_cs', semester: 2, code: 'CS602' },
  { title: 'Deep Learning',                    branch: 'mtech_cs', semester: 2, code: 'CS603' },
  { title: 'MLOps',                            branch: 'mtech_cs', semester: 2, code: 'CS604' },
  { title: 'NLP',                              branch: 'mtech_cs', semester: 2, code: 'CS605' },
];

// ── SUBJECT DETECTION ──────────────────────────────────────────────────────────
function getSubjectFromPath(filePath) {
  const p = filePath.toLowerCase().replace(/\\/g, '/');
  if (p.includes('/big data analytics/'))              return 'Big Data Analytics';
  if (p.includes('/data modelling and visualization/')) return 'Data Modelling and Visualization';
  if (p.includes('/deep learning/'))                   return 'Deep Learning';
  if (p.includes('/mlops/'))                           return 'MLOps';
  if (p.includes('/nlp/'))                             return 'NLP';
  if (p.includes('/entire syllabus/'))                 return '__syllabus__';
  const fn = path.basename(filePath).toLowerCase();
  if (fn.includes('big data analytics'))               return 'Big Data Analytics';
  if (fn.includes('deep learning'))                    return 'Deep Learning';
  if (fn.includes('_dmv') || fn.includes('dmv'))       return 'Data Modelling and Visualization';
  if (fn.includes('mlop'))                             return 'MLOps';
  if (fn.includes('natural language'))                 return 'NLP';
  return null;
}

// ── TAB TYPE DETECTION ─────────────────────────────────────────────────────────
function getTypeFromPath(filePath) {
  const p = filePath.toLowerCase().replace(/\\/g, '/');
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.mp4' || ext === '.ds_store' || ext === '') return null;
  if (ext === '.pptx' || ext === '.ppt')                   return 'ppt';
  if (p.includes('/assignment'))                           return 'assignment';
  if (p.includes('/books'))                                return 'book';
  if (p.includes('/experiential learning'))                return 'experiential';
  if (p.includes('/participative learning'))               return 'participative';
  if (p.includes('/problem solving'))                      return 'problem_solving';
  if (p.includes('/question bank'))                        return 'question_bank';
  if (p.includes('/question papers'))                      return 'question_papers';
  if (p.includes('/notes'))                                return 'note';
  if (p.includes('/extras'))                               return 'extra';
  if (p.includes('/lesson plan') || p.includes('/course file')) return 'lesson_plan';
  if (p.includes('/course student handout') || p.includes('/course handout')) return 'handout';
  if (p.includes('/assessment scheme'))                    return 'extra';
  if (p.includes('/updated syllabus'))                     return 'lesson_plan';
  if (p.includes('/ttt theory formats/'))                  return null;
  if (p.includes('/ttt theory'))                           return 'lesson_plan';
  if (p.includes('/video lecture') || p.includes('/video lectures')) return 'handout';
  const fn = path.basename(filePath).toLowerCase();
  if (fn.includes('handout'))                              return 'handout';
  if (ext === '.pdf' || ext.includes('doc'))               return 'note';
  return 'extra';
}

// ── FILE SCANNER ───────────────────────────────────────────────────────────────
function scanDir(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    fs.statSync(full).isDirectory() ? scanDir(full, results) : results.push(full);
  }
  return results;
}

// ── FILE UPLOADER ──────────────────────────────────────────────────────────────
async function uploadFile(filePath, folder) {
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath);
  const safeName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const storagePath = `mtech/${folder}/${safeName}`;
  const contentTypeMap = {
    '.pdf':  'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc':  'application/msword',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.ppt':  'application/vnd.ms-powerpoint',
  };
  const { error } = await supabase.storage.from('materials').upload(
    storagePath, fs.readFileSync(filePath),
    { contentType: contentTypeMap[ext] || 'application/octet-stream' }
  );
  if (error) { console.error(`      ❌ Storage: ${error.message}`); return null; }
  return supabase.storage.from('materials').getPublicUrl(storagePath).data.publicUrl;
}

// ── MAIN ───────────────────────────────────────────────────────────────────────
async function run() {
  console.log('\n🚀 M.Tech Full Rebuild (Admin — RLS bypassed)\n');

  // STEP 1: Delete old M.Tech subjects + their resources
  console.log('🗑️  Step 1: Wiping existing M.Tech data...');
  const { data: existingSubs } = await supabase.from('subjects').select('id').eq('branch', 'mtech_cs');
  if (existingSubs?.length) {
    const ids = existingSubs.map(s => s.id);
    await supabase.from('resources').delete().in('subject_id', ids);
    await supabase.from('subjects').delete().in('id', ids);
    console.log(`  ✅ Wiped ${ids.length} old subject(s) and their resources.`);
  } else {
    console.log('  ℹ️  No existing M.Tech subjects found.');
  }

  // STEP 2: Create fresh subjects
  console.log('\n📚 Step 2: Creating M.Tech subjects...');
  const subjectIdMap = {};
  for (const sub of SUBJECTS) {
    const { data, error } = await supabase
      .from('subjects').insert([{ title: sub.title, code: sub.code, branch: sub.branch, semester: sub.semester }])
      .select('id').single();
    if (error) { console.error(`  ❌ ${sub.title}: ${error.message}`); }
    else { subjectIdMap[sub.title] = data.id; console.log(`  ✅ "${sub.title}" → ID ${data.id}`); }
  }

  // STEP 3: Scan + categorize files
  console.log('\n🔍 Step 3: Scanning and categorizing files...');
  const VALID_EXTS = ['.pdf', '.docx', '.doc', '.pptx', '.ppt'];
  const allFiles = [...scanDir(BASE1), ...scanDir(BASE2)];
  const bySubject = {}, syllabus = [], ignored = [];

  for (const f of allFiles) {
    const ext = path.extname(f).toLowerCase();
    if (!VALID_EXTS.includes(ext)) { ignored.push(f); continue; }
    const sub  = getSubjectFromPath(f);
    const type = getTypeFromPath(f);
    if (sub === '__syllabus__') { syllabus.push(f); continue; }
    if (!sub || !type) { ignored.push(f); continue; }
    if (!bySubject[sub]) bySubject[sub] = [];
    bySubject[sub].push({ filePath: f, type });
  }

  console.log('\n  📊 Breakdown:');
  for (const [sub, files] of Object.entries(bySubject)) {
    const byType = {};
    files.forEach(f => { byType[f.type] = (byType[f.type] || 0) + 1; });
    console.log(`  ${sub}: ${files.length} files — ${JSON.stringify(byType)}`);
  }
  console.log(`  Syllabus: ${syllabus.length} | Ignored: ${ignored.length}`);

  // STEP 4: Upload and insert DB records
  console.log('\n📤 Step 4: Uploading files to storage + database...');
  for (const [subjectTitle, files] of Object.entries(bySubject)) {
    const subjectId = subjectIdMap[subjectTitle];
    if (!subjectId) { console.log(`  ⚠️  Skipping "${subjectTitle}" (no DB ID)`); continue; }
    console.log(`\n  📁 ${subjectTitle}`);

    // De-duplicate by filename to avoid uploading same file from both source dirs
    const seen = new Set();
    const deduped = files.filter(f => {
      const base = path.basename(f.filePath).toLowerCase();
      if (seen.has(base)) return false;
      seen.add(base); return true;
    });

    for (const { filePath, type } of deduped) {
      const fileName = path.basename(filePath);
      const title    = path.parse(fileName).name;
      const folder   = subjectTitle.toLowerCase().replace(/\s+/g, '_');
      process.stdout.write(`    [${type.padEnd(16)}] ${fileName} ... `);
      const url = await uploadFile(filePath, folder);
      if (!url) continue;
      const { error } = await supabase.from('resources').insert([{ subject_id: subjectId, title, type, url }]);
      console.log(error ? `❌ ${error.message}` : '✅');
    }
  }

  // STEP 5: Syllabus → link to ALL subjects as 'handout'
  if (syllabus.length > 0) {
    console.log('\n📄 Step 5: Linking combined syllabus to all subjects...');
    const url = await uploadFile(syllabus[0], 'syllabus');
    if (url) {
      const title = path.parse(syllabus[0]).name;
      for (const [subjectTitle, subjectId] of Object.entries(subjectIdMap)) {
        const { error } = await supabase.from('resources').insert([{ subject_id: subjectId, title, type: 'handout', url }]);
        console.log(`  ${error ? '❌' : '✅'} ${subjectTitle}`);
      }
    }
  }

  console.log('\n🎉 COMPLETE! All M.Tech data has been rebuilt and is ready.\n');
}

run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
