// ─── University Hierarchy Data ────────────────────────────────────────────────
// Structure: School → Degree → Specialization/Branch → Batch → Semester

export const UNIVERSITY_NAME = 'Symbiosis Institute of Technology';

export const SCHOOLS = [
  { id: 'set', name: 'School of Engineering & Technology', shortName: 'SET' },
  { id: 'sms', name: 'School of Management Studies',       shortName: 'SMS' },
  { id: 'scs', name: 'School of Computer Science',         shortName: 'SCS' },
];

export const DEGREES = [
  { id: 'btech', schoolId: 'set', name: 'B.Tech', years: 4 },
  { id: 'mtech', schoolId: 'set', name: 'M.Tech', years: 2 },
  { id: 'btech_cs', schoolId: 'scs', name: 'B.Tech (CS)', years: 4 },
  { id: 'mca',   schoolId: 'scs', name: 'MCA', years: 2 },
  { id: 'mba',   schoolId: 'sms', name: 'MBA', years: 2 },
];

export const BRANCHES = [
  { id: 'cs',   degreeId: 'btech',    name: 'Computer Science & Engineering',     code: 'CSE' },
  { id: 'it',   degreeId: 'btech',    name: 'Information Technology',              code: 'IT'  },
  { id: 'aiml', degreeId: 'btech',    name: 'AI & Machine Learning',              code: 'AIML'},
  { id: 'entc', degreeId: 'btech',    name: 'Electronics & Telecomm.',            code: 'ENTC'},
  { id: 'mech', degreeId: 'btech',    name: 'Mechanical Engineering',             code: 'MECH'},
  { id: 'civil',degreeId: 'btech',    name: 'Civil Engineering',                  code: 'CIVIL'},
  { id: 'cse2', degreeId: 'btech_cs', name: 'Computer Science & Engineering',     code: 'CSE' },
  { id: 'mca1', degreeId: 'mca',      name: 'MCA',                                code: 'MCA' },
  { id: 'mtech_cs', degreeId: 'mtech', name: 'Computer Science & Engineering',    code: 'CSE' },
];

export const BATCHES = [
  // B.Tech (4-year)
  { id: 'b2122', name: '2021–25', startYear: 2021, endYear: 2025, type: 'btech' },
  { id: 'b2223', name: '2022–26', startYear: 2022, endYear: 2026, type: 'btech' },
  { id: 'b2324', name: '2023–27', startYear: 2023, endYear: 2027, type: 'btech' },
  { id: 'b2425', name: '2024–28', startYear: 2024, endYear: 2028, type: 'btech' },
  // M.Tech / MCA (2-year)
  { id: 'm2425', name: '2024–26', startYear: 2024, endYear: 2026, type: 'mtech' },
  { id: 'm2526', name: '2025–27', startYear: 2025, endYear: 2027, type: 'mtech' },
];

// ─── Helper: infer current semester from batch start year ─────────────────────
export function inferSemester(startYear) {
  const now = new Date();
  const academicYear = now.getFullYear() - startYear;
  const month = now.getMonth(); // 0-based; June=5, July=6, Jan=0
  // Odd semesters: Jul–Nov | Even semesters: Jan–May
  const base = academicYear * 2;
  return month >= 6 ? base + 1 : base;
}

// ─── Semester → Subject Code mapping (per branch) ─────────────────────────────
// Each entry maps a semester to an array of subject IDs from localSubjects.js
export const SEMESTER_SUBJECT_MAP = {
  cs: {
    3: ['local-pppl', 'local-wtpl', 'local-maths3'],
    4: ['local-fai', 'local-toc', 'local-cc', 'local-csf', 'local-ee', 'local-cn', 'local-ajpl'],
  },
  it: {
    3: ['local-pppl', 'local-wtpl', 'local-maths3'],
    4: ['local-fai', 'local-toc', 'local-cc', 'local-csf', 'local-ee', 'local-cn'],
  },
  aiml: {
    3: ['local-pppl', 'local-maths3'],
    4: ['local-fai', 'local-cc', 'local-maths3'],
  },
  mtech_cs: {
    1: [12, 13, 14, 15, 16],  // Reuse sem-2 IDs as placeholder until sem-1 data is added
    2: [12, 13, 14, 15, 16],
  },
};

// ─── Subject Code Prefix by Branch+Year ──────────────────────────────────────
// Convention: YY + BRANCH_SHORT + SEM + Index (e.g. 23CS401)
export function buildSubjectCode(year2digit, branchCode, semester, index) {
  return `${year2digit}${branchCode}${semester}0${index}`;
}
