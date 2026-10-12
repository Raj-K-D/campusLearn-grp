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
const supabaseKey = env['VITE_SUPABASE_ANON_KEY'];
if (!supabaseUrl || !supabaseKey) { console.error('Missing Supabase credentials'); process.exit(1); }
const supabase = createClient(supabaseUrl, supabaseKey);

// ── BASE PATHS ─────────────────────────────────────────────────────────────────
const BASE1 = 'D:\\Users\\Raj\\Downloads\\Course Student handouts and TTT formats-20260503T103957Z-3-001\\Course Student handouts and TTT formats';
const BASE2 = 'D:\\Users\\Raj\\Downloads\\Course Handouts Mtech CSE Jan 2026 Sem2-20260503T104034Z-3-001\\Course Handouts Mtech';

// ── SUBJECT DEFINITIONS ────────────────────────────────────────────────────────
// branch='mtech_cs', semester=2 for all M.Tech Sem 2 subjects
const SUBJECTS = [
  { title: 'Big Data Analytics',            branch: 'mtech_cs', semester: 2, code: 'CS601' },
  { title: 'Data Modelling and Visualization', branch: 'mtech_cs', semester: 2, code: 'CS602' },
  { title: 'Deep Learning',                 branch: 'mtech_cs', semester: 2, code: 'CS603' },
  { title: 'MLOps',                         branch: 'mtech_cs', semester: 2, code: 'CS604' },
  { title: 'NLP',                           branch: 'mtech_cs', semester: 2, code: 'CS605' },
];

// ── SUBJECT DETECTION from folder path ────────────────────────────────────────
function getSubjectFromPath(filePath) {
  const p = filePath.toLowerCase().replace(/\\/g, '/');

  // Subject detection first (inside subject folders takes priority)
  if (p.includes('/big data analytics/')) return 'Big Data Analytics';
  if (p.includes('/data modelling and visualization/')) return 'Data Modelling and Visualization';
  if (p.includes('/deep learning/')) return 'Deep Learning';
  if (p.includes('/mlops/')) return 'MLOps';
  if (p.includes('/nlp/')) return 'NLP';

  // Entire syllabus dir (root level)
  if (p.includes('/entire syllabus/')) return '__syllabus__';

  // BASE2 flat dir files — detect by filename
  const fn = path.basename(filePath).toLowerCase();
  if (fn.includes('big data analytics')) return 'Big Data Analytics';
  if (fn.includes('deep learning')) return 'Deep Learning';
  if (fn.includes('_dmv') || fn.includes('dmv')) return 'Data Modelling and Visualization';
  if (fn.includes('mlop')) return 'MLOps';
  if (fn.includes('natural language')) return 'NLP';

  // Root-level non-subject files (Assessment Scheme, TTT Formats, Lab II etc.)
  return null;
}

// ── TAB TYPE MAPPING ────────────────────────────────────────────────────────────
function getTypeFromPath(filePath) {
  const p = filePath.toLowerCase().replace(/\\/g, '/');
  const ext = path.extname(filePath).toLowerCase();

  // Skip non-uploadable
  if (ext === '.mp4' || ext === '.ds_store' || ext === '') return null;

  // PPT files ALWAYS go to 'ppt' tab
  if (ext === '.pptx' || ext === '.ppt') return 'ppt';

  // Folder-name based mapping (most specific first)
  if (p.includes('/assignment'))                         return 'assignment';
  if (p.includes('/books'))                              return 'book';
  if (p.includes('/experiential learning'))              return 'experiential';
  if (p.includes('/participative learning'))             return 'participative';
  if (p.includes('/problem solving'))                    return 'problem_solving';
  if (p.includes('/question bank'))                      return 'question_bank';
  if (p.includes('/question papers'))                    return 'question_papers';
  if (p.includes('/notes'))                              return 'note';
  if (p.includes('/extras'))                             return 'extra';
  if (p.includes('/video lecture') || p.includes('/video_lecture')) return 'videos';
  if (p.includes('/lesson plan') || p.includes('/course file')) return 'lesson_plan';

  // Handout files
  if (p.includes('/course student handout') || p.includes('/course handout')) return 'handout';

  // Assessment scheme docs → extra (admin, not student content) — check BEFORE filename fallback
  if (p.includes('/assessment scheme')) return 'extra';

  // Updated Syllabus docs → lesson_plan
  if (p.includes('/updated syllabus')) return 'lesson_plan';

  // TTT Theory root (non-subject PPT templates) → skip
  if (p.includes('/ttt theory formats/')) return null;

  // Other TTT theory items not caught above → lesson_plan
  if (p.includes('/ttt theory')) return 'lesson_plan';

  // Video Lectures folder: only upload actual videos (already skipped .mp4), docx here → handout
  if (p.includes('/video lecture') || p.includes('/video lectures')) return 'handout';

  // Filename-based for BASE2 flat directory handouts
  const fn = path.basename(filePath).toLowerCase();
  if (fn.includes('handout')) return 'handout';

  // Default fallback for pdfs/docs
  if (ext === '.pdf' || ext.includes('doc')) return 'note';

  return 'extra';
}

// ── COLLECT ALL FILES ──────────────────────────────────────────────────────────
function scanDir(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      scanDir(full, results);
    } else {
      results.push(full);
    }
  }
  return results;
}

async function uploadFile(filePath, storageFolderName) {
  const fileName = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const safeStorageName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const storagePath = `mtech/${storageFolderName}/${safeStorageName}`;

  const contentTypeMap = {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.ppt': 'application/vnd.ms-powerpoint',
  };
  const contentType = contentTypeMap[ext] || 'application/octet-stream';

  const fileBuffer = fs.readFileSync(filePath);
  const { error } = await supabase.storage.from('materials').upload(storagePath, fileBuffer, { contentType });
  if (error) {
    console.error(`      ❌ Storage error: ${error.message}`);
    return null;
  }
  const { data } = supabase.storage.from('materials').getPublicUrl(storagePath);
  return data.publicUrl;
}

// ── MAIN ───────────────────────────────────────────────────────────────────────
async function run() {
  console.log('\n🚀 M.Tech Data Migration — Full Rebuild\n');

  // STEP 1: Wipe all M.Tech subjects and their resources from DB
  console.log('🗑️  Step 1: Deleting existing M.Tech subjects and resources...');
  
  // Find all M.Tech subjects in DB
  const { data: existingSubjects } = await supabase
    .from('subjects').select('id, title').eq('branch', 'mtech_cs');

  if (existingSubjects && existingSubjects.length > 0) {
    const ids = existingSubjects.map(s => s.id);
    // Delete resources first (FK constraint)
    const { error: resDelErr } = await supabase.from('resources').delete().in('subject_id', ids);
    if (resDelErr) console.error('  ❌ Error deleting resources:', resDelErr.message);
    else console.log(`  ✅ Deleted resources for ${ids.length} subject(s)`);

    const { error: subDelErr } = await supabase.from('subjects').delete().in('id', ids);
    if (subDelErr) console.error('  ❌ Error deleting subjects:', subDelErr.message);
    else console.log(`  ✅ Deleted ${ids.length} M.Tech subject(s)`);
  } else {
    console.log('  ℹ️  No existing M.Tech subjects found.');
  }

  // STEP 2: Re-create subjects and get their new IDs
  console.log('\n📚 Step 2: Creating M.Tech subjects...');
  const subjectIdMap = {}; // title -> id

  for (const sub of SUBJECTS) {
    const { data, error } = await supabase.from('subjects').insert([{
      title: sub.title, code: sub.code, branch: sub.branch, semester: sub.semester,
    }]).select('id').single();

    if (error) {
      console.error(`  ❌ Failed to create ${sub.title}:`, error.message);
    } else {
      subjectIdMap[sub.title] = data.id;
      console.log(`  ✅ Created "${sub.title}" → ID ${data.id}`);
    }
  }

  // STEP 3: Scan all files from both source dirs
  console.log('\n🔍 Step 3: Scanning source files...');
  const allFiles = [
    ...scanDir(BASE1),
    ...scanDir(BASE2),
  ];
  console.log(`  Found ${allFiles.length} total files.`);

  // STEP 4: Categorize each file
  const syllabus = [];
  const filesBySubject = {}; // subjectTitle -> [{ filePath, type }]
  const ignored = [];

  for (const filePath of allFiles) {
    const ext = path.extname(filePath).toLowerCase();
    // Skip non-document files
    if (!['.pdf', '.docx', '.doc', '.pptx', '.ppt'].includes(ext)) {
      ignored.push(filePath);
      continue;
    }

    const subject = getSubjectFromPath(filePath);
    const type = getTypeFromPath(filePath);

    if (subject === '__syllabus__') {
      syllabus.push(filePath);
    } else if (!subject) {
      ignored.push(filePath);
    } else if (!type) {
      ignored.push(filePath);
    } else {
      if (!filesBySubject[subject]) filesBySubject[subject] = [];
      filesBySubject[subject].push({ filePath, type });
    }
  }

  console.log(`\n📊 Categorization summary:`);
  for (const [sub, files] of Object.entries(filesBySubject)) {
    const byType = {};
    files.forEach(f => { byType[f.type] = (byType[f.type] || 0) + 1; });
    console.log(`  ${sub}: ${files.length} files — ${JSON.stringify(byType)}`);
  }
  console.log(`  Syllabus (cross-subject): ${syllabus.length} file(s)`);
  console.log(`  Ignored: ${ignored.length} file(s)`);

  // STEP 5: Upload files and insert DB records
  console.log('\n📤 Step 4: Uploading files...');
  
  for (const [subjectTitle, files] of Object.entries(filesBySubject)) {
    const subjectId = subjectIdMap[subjectTitle];
    if (!subjectId) {
      console.log(`  ⚠️  No DB subject found for "${subjectTitle}", skipping.`);
      continue;
    }
    console.log(`\n  📁 ${subjectTitle} (ID: ${subjectId})`);

    // De-duplicate files by base filename (prevent uploading same file from both dirs)
    const seenNames = new Set();
    const deduped = files.filter(f => {
      const base = path.basename(f.filePath).toLowerCase();
      if (seenNames.has(base)) {
        console.log(`    ⏩ Duplicate skipped: ${path.basename(f.filePath)}`);
        return false;
      }
      seenNames.add(base);
      return true;
    });

    for (const { filePath, type } of deduped) {
      const fileName = path.basename(filePath);
      const title = path.parse(fileName).name; // filename without extension
      console.log(`    [${type.padEnd(16)}] ${fileName}`);

      const publicUrl = await uploadFile(filePath, subjectTitle.toLowerCase().replace(/\s/g, '_'));
      if (!publicUrl) continue;

      const { error } = await supabase.from('resources').insert([{
        subject_id: subjectId, title, type, url: publicUrl,
      }]);
      if (error) console.error(`      ❌ DB insert error: ${error.message}`);
      else console.log(`      ✅ Saved to DB`);
    }
  }

  // STEP 6: Upload syllabus and link to ALL subjects
  if (syllabus.length > 0) {
    console.log('\n📄 Step 5: Uploading combined syllabus to all subjects...');
    const sylPath = syllabus[0]; // Use the first/only syllabus
    const publicUrl = await uploadFile(sylPath, 'syllabus');

    if (publicUrl) {
      for (const [subjectTitle, subjectId] of Object.entries(subjectIdMap)) {
        const title = path.parse(sylPath).name;
        const { error } = await supabase.from('resources').insert([{
          subject_id: subjectId, title, type: 'handout', url: publicUrl,
        }]);
        if (error) console.error(`  ❌ Syllabus link failed for ${subjectTitle}:`, error.message);
        else console.log(`  ✅ Syllabus linked to ${subjectTitle}`);
      }
    }
  }

  // STEP 7: Link Course Handouts from BASE2 (flat dir, all .docx/.pdf)
  console.log('\n📋 Step 6: Linking BASE2 course handouts...');
  // BASE2 handouts are already captured in filesBySubject with type='handout'
  // No extra work needed — they were scanned in STEP 3-5.

  console.log('\n🎉 DONE! All M.Tech data has been rebuilt cleanly.\n');
}

run().catch(err => { console.error('Fatal error:', err); process.exit(1); });
