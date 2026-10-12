import fs from 'fs';
import path from 'path';

const BASE1 = 'D:\\Users\\Raj\\Downloads\\Course Student handouts and TTT formats-20260503T103957Z-3-001\\Course Student handouts and TTT formats';
const BASE2 = 'D:\\Users\\Raj\\Downloads\\Course Handouts Mtech CSE Jan 2026 Sem2-20260503T104034Z-3-001\\Course Handouts Mtech';

function scanDir(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) scanDir(full, results);
    else results.push(full);
  }
  return results;
}

function getSubjectFromPath(filePath) {
  const p = filePath.toLowerCase().replace(/\\/g, '/');
  if (p.includes('/big data analytics/')) return 'Big Data Analytics';
  if (p.includes('/data modelling and visualization/')) return 'Data Modelling and Visualization';
  if (p.includes('/deep learning/')) return 'Deep Learning';
  if (p.includes('/mlops/')) return 'MLOps';
  if (p.includes('/nlp/')) return 'NLP';
  if (p.includes('/entire syllabus/')) return '__syllabus__';
  const fn = path.basename(filePath).toLowerCase();
  if (fn.includes('big data analytics')) return 'Big Data Analytics';
  if (fn.includes('deep learning')) return 'Deep Learning';
  if (fn.includes('_dmv') || fn.includes('dmv')) return 'Data Modelling and Visualization';
  if (fn.includes('mlop')) return 'MLOps';
  if (fn.includes('natural language')) return 'NLP';
  return null;
}

function getTypeFromPath(filePath) {
  const p = filePath.toLowerCase().replace(/\\/g, '/');
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.mp4' || ext === '.ds_store' || ext === '') return null;
  if (ext === '.pptx' || ext === '.ppt') return 'ppt';
  if (p.includes('/assignment'))             return 'assignment';
  if (p.includes('/books'))                  return 'book';
  if (p.includes('/experiential learning'))  return 'experiential';
  if (p.includes('/participative learning')) return 'participative';
  if (p.includes('/problem solving'))        return 'problem_solving';
  if (p.includes('/question bank'))          return 'question_bank';
  if (p.includes('/question papers'))        return 'question_papers';
  if (p.includes('/notes'))                  return 'note';
  if (p.includes('/extras'))                 return 'extra';
  if (p.includes('/lesson plan') || p.includes('/course file')) return 'lesson_plan';
  if (p.includes('/course student handout') || p.includes('/course handout')) return 'handout';
  if (p.includes('/assessment scheme'))      return 'extra';
  if (p.includes('/updated syllabus'))       return 'lesson_plan';
  if (p.includes('/ttt theory formats/'))    return null;
  if (p.includes('/ttt theory'))             return 'lesson_plan';
  if (p.includes('/video lecture') || p.includes('/video lectures')) return 'handout';
  const fn = path.basename(filePath).toLowerCase();
  if (fn.includes('handout'))                return 'handout';
  if (ext === '.pdf' || ext.includes('doc')) return 'note';
  return 'extra';
}

const allFiles = [...scanDir(BASE1), ...scanDir(BASE2)];
const VALID_EXTS = ['.pdf', '.docx', '.doc', '.pptx', '.ppt'];
const bySubject = {}, ignored = [];

for (const f of allFiles) {
  const ext = path.extname(f).toLowerCase();
  if (!VALID_EXTS.includes(ext)) { ignored.push(`[non-doc] ${path.basename(f)}`); continue; }
  const sub = getSubjectFromPath(f);
  const type = getTypeFromPath(f);
  if (!sub || !type) { ignored.push(`[no-match sub=${sub} type=${type}] ${f.split('\\').slice(-3).join('\\')}`); continue; }
  if (!bySubject[sub]) bySubject[sub] = {};
  if (!bySubject[sub][type]) bySubject[sub][type] = [];
  bySubject[sub][type].push(path.basename(f));
}

console.log('=== DRY RUN CATEGORIZATION ===\n');
for (const [sub, types] of Object.entries(bySubject)) {
  const total = Object.values(types).reduce((a, v) => a + v.length, 0);
  console.log(`📚 ${sub}  (${total} files)`);
  for (const [t, files] of Object.entries(types)) {
    console.log(`  [${t}]`);
    files.forEach(f => console.log(`    - ${f}`));
  }
  console.log('');
}
console.log(`\n⚠️  IGNORED (${ignored.length}):`);
ignored.forEach(f => console.log('  ' + f));
