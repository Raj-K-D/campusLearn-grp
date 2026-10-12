import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaHome, FaBook, FaChartLine, FaBookmark, FaSignOutAlt,
  FaMoon, FaSun, FaSearch, FaCalculator, FaGraduationCap,
  FaUserEdit, FaLock, FaCode, FaStar, FaBullseye,
  FaChalkboardTeacher, FaUsersCog, FaShieldAlt,
} from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import CGPACalculator from '../components/CGPACalculator';
import OnboardingModal, { PROFILE_KEY } from '../components/OnboardingModal';
import { LOCAL_SUBJECTS } from '../data/localSubjects';
import { SEMESTER_SUBJECT_MAP } from '../data/universityData';
import { supabase } from '../util/supabase';

const BOOKMARKS_KEY = 'cl_bookmarks';
const PROGRESS_KEY  = 'cl_progress';
const MOTIVATIONAL  = [
  'Keep pushing — every page counts! 🚀',
  'Consistency beats intensity. 💪',
  'Your future self is counting on you. 🎯',
  'One chapter closer to your dream! 📖',
];

function getEnrolledSubjects(profile, allSubjects) {
  if (!profile?.branch && !profile?.branchId) return allSubjects;
  
  const studentBranch = String(profile.branch || profile.branchId || '').toLowerCase();
  const studentSem = Number(profile.semester || 4);
  
  return allSubjects.filter(s => {
    const subjectBranch = String(s.branch || '').toLowerCase();
    
    // Normalize CSE/CS differences
    const isBranchMatch = 
      subjectBranch === studentBranch || 
      (studentBranch === 'cs' && subjectBranch === 'cse') ||
      (studentBranch === 'cse' && subjectBranch === 'cs');
      
    return isBranchMatch;
  });
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function SubjectCard({ subject, progress, isBookmarked, onToggleBookmark, dm, isEnrolled }) {
  const pct = progress?.[subject.id] ?? 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border p-5 flex flex-col gap-3 group transition-all hover:shadow-xl relative overflow-hidden ${
        dm ? 'bg-gray-900 border-gray-800 hover:border-indigo-500' : 'bg-white border-gray-100 hover:border-indigo-200'
      }`}
    >
      {/* badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-indigo-600 text-white tracking-wider">
          {subject.code}
        </span>
        {subject.isCore !== undefined && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
            subject.isCore ? 'bg-emerald-500/15 text-emerald-400' : 'bg-orange-500/15 text-orange-400'
          }`}>
            {subject.isCore ? 'Core' : 'Elective'}
          </span>
        )}
        {!isEnrolled && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-400">
            Exploring
          </span>
        )}
      </div>

      <div>
        <h3 className={`font-extrabold text-sm leading-snug mb-1 group-hover:text-indigo-500 transition ${dm ? 'text-white' : 'text-gray-800'}`}>
          {subject.title}
        </h3>
        <p className={`text-xs ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
          {subject.faculty} · {subject.credits} cr · Sem {subject.semester}
        </p>
      </div>

      {/* progress */}
      <div>
        <div className="flex justify-between text-[10px] font-semibold mb-1">
          <span className={dm ? 'text-gray-500' : 'text-gray-400'}>Progress</span>
          <span className="text-indigo-400">{pct}%</span>
        </div>
        <div className={`h-1.5 rounded-full ${dm ? 'bg-gray-800' : 'bg-gray-100'}`}>
          <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="flex gap-2 mt-auto">
        <Link
          to={`/subject/${subject.id}`}
          className="flex-1 text-center bg-indigo-600 text-white text-xs font-bold py-2 rounded-xl hover:bg-indigo-500 transition"
        >
          Open →
        </Link>
        <button
          onClick={() => onToggleBookmark(subject.id)}
          className={`px-3 py-2 rounded-xl text-sm transition ${
            isBookmarked ? 'bg-yellow-400/20 text-yellow-400' : dm ? 'bg-gray-800 text-gray-500 hover:text-yellow-400' : 'bg-gray-100 text-gray-400 hover:text-yellow-500'
          }`}
        >
          {isBookmarked ? <FaStar /> : <FaBookmark />}
        </button>
      </div>
    </motion.div>
  );
}

function NavBtn({ icon, label, active, onClick, dm }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl font-semibold text-sm transition-all ${
        active
          ? 'bg-indigo-600 text-white shadow-lg'
          : dm ? 'text-gray-400 hover:bg-gray-800 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
      }`}
    >
      {icon} {label}
    </button>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────
export default function StudentDashboard() {
  const { user, signOut, isCoordinator, isAdmin, getCoordinatorSubjects } = useAuth();
  const { darkMode, setDarkMode } = useTheme();
  const navigate = useNavigate();
  const dm = darkMode;

  const [profile, setProfile]           = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [activeTab, setActiveTab]       = useState('home');
  const [search, setSearch]             = useState('');
  const [bookmarks, setBookmarks]       = useState([]);
  const [progress, setProgress]         = useState({});
  const [showCalc, setShowCalc]         = useState(false);
  const [showAllSubjects, setShowAllSubjects] = useState(false);
  const [dbSubjects, setDbSubjects]     = useState([]);

  // Fetch subjects from Supabase — filter by degree so M.Tech doesn't bleed into B.Tech
  useEffect(() => {
    async function fetchDb() {
      const { data } = await supabase.from('subjects').select('*');
      if (data) setDbSubjects(data);
    }
    fetchDb();
  }, []);

  // Merge logic: Prefer DB subjects over Local ones if they have the same code or title
  // profile is loaded asynchronously so we read it safely here
  const degreeId = profile?.degreeId || null;
  const relevantDbSubjects = degreeId
    ? dbSubjects.filter(s => !s.degree_id || s.degree_id === degreeId)
    : dbSubjects;

  const allSubjects = [...relevantDbSubjects];
  const dbCodes = new Set(relevantDbSubjects.map(s => (s.code || '').toLowerCase()));
  const dbTitles = new Set(relevantDbSubjects.map(s => s.title.toLowerCase()));

  LOCAL_SUBJECTS.forEach(ls => {
    const code = (ls.code || '').toLowerCase();
    const title = ls.title.toLowerCase();
    if (!dbCodes.has(code) && !dbTitles.has(title)) {
      allSubjects.push(ls);
    }
  });

  // Load profile + localStorage data
  useEffect(() => {
    async function initProfile() {
      const p = localStorage.getItem(PROFILE_KEY);
      if (p) {
        const parsedProfile = JSON.parse(p);
        if (user) {
          const { data } = await supabase.from('profiles').select('pinned_semester').eq('id', user.id).single();
          if (data?.pinned_semester) parsedProfile.pinned_semester = data.pinned_semester;
        }
        setProfile(parsedProfile);
      } else if (user) {
        setShowOnboarding(true);
      }
    }
    initProfile();

    const bm = localStorage.getItem(BOOKMARKS_KEY);
    if (bm) setBookmarks(JSON.parse(bm));

    const pr = localStorage.getItem(PROGRESS_KEY);
    if (pr) {
      setProgress(JSON.parse(pr));
    } else {
      // Default all subjects to 0 — progress is tracked as student opens tabs
      const initial = {};
      setProgress(initial);
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(initial));
    }
  }, [user, dbSubjects.length]);

  const handlePinSemester = async (sem) => {
    setProfile(prev => ({ ...prev, pinned_semester: sem }));
    if (user) {
      await supabase.from('profiles').update({ pinned_semester: String(sem) }).eq('id', user.id);
    }
  };

  let enrolledSubjects = [];
  if (isAdmin) {
    enrolledSubjects = allSubjects;
  } else if (isCoordinator) {
    const assignedIds = new Set(getCoordinatorSubjects().map(s => s.id));
    enrolledSubjects = allSubjects.filter(s => assignedIds.has(s.id) || assignedIds.has(String(s.id)) || assignedIds.has(Number(s.id)));
  } else {
    enrolledSubjects = getEnrolledSubjects(profile, allSubjects);
  }
  const quote = MOTIVATIONAL[new Date().getDay() % MOTIVATIONAL.length];

  // Search across ALL subjects when user types
  const searchResults = search.trim().length > 1
    ? allSubjects.filter(s =>
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        (s.code || '').toLowerCase().includes(search.toLowerCase())
      )
    : [];

  const toggleBookmark = (id) => {
    const next = bookmarks.includes(id) ? bookmarks.filter(b => b !== id) : [...bookmarks, id];
    setBookmarks(next);
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next));
  };

  const updateSubjectProgress = (subjectId, delta) => {
    setProgress(prev => {
      const current = prev[subjectId] || 0;
      const nextVal = delta === 100 ? 100 : delta === 0 ? 0 : Math.min(100, Math.max(0, current + delta));
      const next = { ...prev, [subjectId]: nextVal };
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const handleOnboardingComplete = (p) => {
    setProfile(p);
    setShowOnboarding(false);
  };

  const handleEditProfile = () => {
    setShowOnboarding(true);
  };

  const totalCredits = enrolledSubjects.reduce((a, s) => a + (s.credits || 0), 0);
  const avgProgress  = enrolledSubjects.length
    ? Math.round(enrolledSubjects.reduce((a, s) => a + (progress[s.id] || 0), 0) / enrolledSubjects.length)
    : 0;

  return (
    <div className={`min-h-screen flex ${dm ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'}`}>

      {/* ── SIDEBAR ──────────────────────────────────────────── */}
      <aside className={`hidden md:flex flex-col w-64 border-r p-4 gap-2 sticky top-0 h-screen ${
        dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'
      }`}>
        {/* Brand */}
        <div className="flex items-center gap-2 px-4 py-3 mb-2">
          <FaGraduationCap className="text-indigo-500 text-xl" />
          <span className="font-extrabold text-lg">Campus<span className="text-indigo-500">Learn</span></span>
        </div>

        {/* Profile chip */}
        {profile && (
          <div className={`mx-1 mb-2 p-3 rounded-2xl ${dm ? 'bg-gray-800' : 'bg-indigo-50'}`}>
            <p className="font-bold text-sm truncate">{profile.name || user?.email?.split('@')[0]}</p>
            <p className={`text-[10px] mt-0.5 ${dm ? 'text-indigo-400' : 'text-indigo-600'}`}>
              {profile.rollNo} · Sem {profile.semester}
            </p>
          </div>
        )}

        <nav className="flex flex-col gap-1 flex-1">
          <NavBtn icon={<FaHome />}      label="Dashboard"    active={activeTab==='home'}      onClick={() => setActiveTab('home')}      dm={dm} />
          <NavBtn icon={<FaBook />}      label="My Subjects"  active={activeTab==='subjects'}  onClick={() => setActiveTab('subjects')}  dm={dm} />
          <NavBtn icon={<FaChartLine />} label="Progress"     active={activeTab==='progress'}  onClick={() => setActiveTab('progress')}  dm={dm} />
          <NavBtn icon={<FaBookmark />}  label="Bookmarks"    active={activeTab==='bookmarks'} onClick={() => setActiveTab('bookmarks')} dm={dm} />

          {/* Faculty Quick Links */}
          {isAdmin && <NavBtn icon={<FaShieldAlt />} label="Admin Portal" active={false} onClick={() => navigate('/admin')} dm={dm} />}
          {isCoordinator && <NavBtn icon={<FaUsersCog />} label="Coordinator Portal" active={false} onClick={() => navigate('/coordinator')} dm={dm} />}
        </nav>

        <div className="flex flex-col gap-2">
          <button onClick={() => setShowCalc(true)} className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl font-semibold text-sm transition ${dm ? 'text-gray-400 hover:bg-gray-800 hover:text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
            <FaCalculator /> CGPA Calc
          </button>
          <button onClick={() => setShowOnboarding(true)} className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl font-semibold text-sm transition ${dm ? 'text-gray-400 hover:bg-gray-800 hover:text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
            <FaUserEdit /> Edit Profile
          </button>
          <button onClick={() => setDarkMode(!dm)} className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl font-semibold text-sm transition ${dm ? 'text-gray-400 hover:bg-gray-800 hover:text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
            {dm ? <FaSun /> : <FaMoon />} {dm ? 'Light Mode' : 'Dark Mode'}
          </button>
          <button onClick={async () => { await signOut(); navigate('/login'); }} className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl font-semibold text-sm transition text-red-400 hover:bg-red-500/10`}>
            <FaSignOutAlt /> Sign Out
          </button>
        </div>
      </aside>

      {/* ── MAIN ─────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">

        {/* Top Bar */}
        <div className={`sticky top-0 z-20 px-6 py-4 border-b flex items-center gap-4 ${dm ? 'bg-gray-950/90 border-gray-800 backdrop-blur' : 'bg-white/90 border-gray-100 backdrop-blur'}`}>
          <div className={`flex items-center gap-2 flex-1 max-w-md px-4 py-2.5 rounded-xl border ${dm ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
            <FaSearch className="text-gray-400 text-sm" />
            <input
              className="bg-transparent outline-none text-sm w-full"
              placeholder="Search by subject name or code (e.g. 23CS401)…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button onClick={() => setDarkMode(!dm)} className={`p-2.5 rounded-xl ${dm ? 'bg-gray-800 text-yellow-400' : 'bg-gray-100 text-gray-600'}`}>
            {dm ? <FaSun /> : <FaMoon />}
          </button>
        </div>

        {/* Search overlay */}
        <AnimatePresence>
          {searchResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`mx-6 mt-4 rounded-2xl border overflow-hidden ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-xl'}`}
            >
              <p className={`px-5 py-3 text-xs font-bold border-b ${dm ? 'border-gray-800 text-gray-500' : 'border-gray-100 text-gray-400'}`}>
                {searchResults.length} result(s) — searching all subjects
              </p>
              {searchResults.map(s => {
                const isEnrolled = enrolledSubjects.some(e => e.id === s.id);
                return (
                  <Link key={s.id} to={`/subject/${s.id}`} onClick={() => setSearch('')}
                    className={`flex items-center gap-4 px-5 py-3 border-b last:border-0 hover:bg-indigo-500/10 transition ${dm ? 'border-gray-800' : 'border-gray-100'}`}
                  >
                    <div>
                      <span className="text-[10px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded-md mr-2">{s.code}</span>
                      <span className={`font-bold text-sm ${dm ? 'text-white' : 'text-gray-800'}`}>{s.title}</span>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      {!isEnrolled && <span className="text-[10px] font-bold text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded-full">Exploring</span>}
                      <FaBullseye className="text-indigo-400 text-xs" />
                    </div>
                  </Link>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="p-6 max-w-6xl mx-auto space-y-8">

          {/* ── HOME TAB ── */}
          {activeTab === 'home' && (
            <div className="space-y-8">
              {/* Welcome */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-3xl p-6 text-white relative overflow-hidden"
              >
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, white 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                <p className="text-indigo-200 text-sm font-medium mb-1">Good {new Date().getHours() < 12 ? 'Morning' : 'Afternoon'} 👋</p>
                <h1 className="text-2xl font-extrabold mb-1">{profile?.name || user?.email?.split('@')[0] || 'Student'}</h1>
                {profile && (
                  <p className="text-indigo-200 text-sm">
                    {profile.rollNo} · Semester {profile.semester}
                  </p>
                )}
                {/* Batch badge when enrolled via magic link */}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {profile?.enrolledViaMagicLink && (
                    <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-1.5">
                      <span className="text-white/80 text-xs">🔗</span>
                      <span className="text-xs font-bold text-white/90">Batch Enrolled</span>
                      {profile.branchId && <span className="text-indigo-200 text-xs">· {profile.branchId.toUpperCase()}</span>}
                    </div>
                  )}
                  <button
                    onClick={handleEditProfile}
                    className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 transition rounded-xl px-3 py-1.5 text-xs font-bold text-white/90"
                  >
                    <FaUserEdit className="text-xs" /> Edit Profile
                  </button>
                </div>
                <p className="mt-3 text-white/80 text-sm italic">{quote}</p>
              </motion.div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { icon: '📚', label: 'Enrolled Subjects', value: enrolledSubjects.length, grad: 'from-indigo-500 to-purple-600' },
                  { icon: '🎯', label: 'Avg. Progress',     value: `${avgProgress}%`,        grad: 'from-emerald-500 to-teal-600' },
                  { icon: '⭐', label: 'Total Credits',     value: totalCredits,              grad: 'from-orange-500 to-pink-600'  },
                  { icon: '🔖', label: 'Bookmarks',         value: bookmarks.length,          grad: 'from-pink-500 to-rose-600'    },
                ].map((s, i) => (
                  <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                    className={`bg-gradient-to-br ${s.grad} rounded-2xl p-4 text-white shadow-lg`}
                  >
                    <div className="text-2xl mb-1">{s.icon}</div>
                    <div className="text-2xl font-extrabold">{s.value}</div>
                    <div className="text-xs opacity-75 mt-0.5">{s.label}</div>
                  </motion.div>
                ))}
              </div>

              {/* Current Semester Subjects */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h2 className={`text-lg font-extrabold ${dm ? 'text-white' : 'text-gray-800'}`}>
                      📖 Semester
                    </h2>
                    <select
                      value={profile?.pinned_semester || profile?.semester || ''}
                      onChange={e => handlePinSemester(e.target.value)}
                      className={`text-sm font-bold rounded-lg px-2 py-1 border outline-none ${dm ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-800'}`}
                    >
                      {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <h2 className={`text-lg font-extrabold ${dm ? 'text-white' : 'text-gray-800'}`}>
                      Subjects
                    </h2>
                  </div>
                  <button onClick={() => setActiveTab('subjects')} className="text-indigo-500 text-sm font-bold hover:underline">
                    View All →
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {enrolledSubjects
                    .filter(s => Number(s.semester) === Number(profile?.pinned_semester || profile?.semester || 4))
                    .slice(0, 6)
                    .map((s, i) => (
                      <SubjectCard
                        key={s.id} subject={s} progress={progress} dm={dm}
                        isBookmarked={bookmarks.includes(s.id)}
                        onToggleBookmark={toggleBookmark}
                        isEnrolled={true}
                      />
                    ))
                  }
                </div>
              </div>
            </div>
          )}

          {/* ── MY SUBJECTS TAB ── */}
          {activeTab === 'subjects' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className={`text-xl font-extrabold ${dm ? 'text-white' : 'text-gray-800'}`}>My Enrolled Subjects</h2>
                <button
                  onClick={() => setShowAllSubjects(!showAllSubjects)}
                  className="text-xs font-bold px-4 py-2 rounded-xl bg-purple-600 text-white hover:bg-purple-500 transition"
                >
                  {showAllSubjects ? '📚 Show Enrolled Only' : '🌐 Browse All Subjects'}
                </button>
              </div>

              {/* Semester grouping */}
              {[...new Set((showAllSubjects ? allSubjects : enrolledSubjects).map(s => s.semester))].sort().map(sem => {
                const semSubjects = (showAllSubjects ? allSubjects : enrolledSubjects).filter(s => s.semester === sem);
                return (
                  <div key={sem}>
                    <h3 className={`text-sm font-black uppercase tracking-widest mb-3 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
                      Semester {sem}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {semSubjects.map(s => (
                        <SubjectCard
                          key={s.id} subject={s} progress={progress} dm={dm}
                          isBookmarked={bookmarks.includes(s.id)}
                          onToggleBookmark={toggleBookmark}
                          isEnrolled={enrolledSubjects.some(e => e.id === s.id)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── PROGRESS & ACADEMIC ANALYTICS TAB ── */}
          {activeTab === 'progress' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className={`text-2xl font-extrabold ${dm ? 'text-white' : 'text-gray-900'}`}>📊 Learning Analytics & Progress</h2>
                  <p className={`text-xs ${dm ? 'text-gray-400' : 'text-gray-500'}`}>Track your syllabus coverage and log your daily study sessions</p>
                </div>
                <div className={`text-xs px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 self-start ${dm ? 'bg-indigo-900/40 text-indigo-300' : 'bg-indigo-50 text-indigo-700'}`}>
                  <span>🎯 Overall Completion:</span>
                  <span className="text-base font-extrabold">{avgProgress}%</span>
                </div>
              </div>

              {/* Top Overview Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Overall Progress', value: `${avgProgress}%`, icon: '📈', color: 'from-indigo-500 to-purple-600' },
                  { label: 'Completed Subjects', value: enrolledSubjects.filter(s => (progress[s.id] || 0) >= 100).length, icon: '🏆', color: 'from-emerald-500 to-teal-600' },
                  { label: 'In Progress', value: enrolledSubjects.filter(s => (progress[s.id] || 0) > 0 && (progress[s.id] || 0) < 100).length, icon: '⚡', color: 'from-amber-500 to-orange-600' },
                  { label: 'Total Credits', value: totalCredits, icon: '⭐', color: 'from-blue-500 to-cyan-600' },
                ].map((stat, i) => (
                  <div key={i} className={`p-4 rounded-2xl border ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'} shadow-sm`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl">{stat.icon}</span>
                      <span className={`text-[10px] font-black uppercase tracking-wider ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
                        Metric
                      </span>
                    </div>
                    <div className={`text-2xl font-black ${dm ? 'text-white' : 'text-gray-900'}`}>{stat.value}</div>
                    <div className={`text-xs font-semibold mt-0.5 ${dm ? 'text-gray-400' : 'text-gray-500'}`}>{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Interactive Subject Progress List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className={`text-sm font-black uppercase tracking-wider ${dm ? 'text-gray-400' : 'text-gray-600'}`}>
                    Enrolled Courses ({enrolledSubjects.length})
                  </h3>
                  <span className={`text-[11px] ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
                    💡 Click buttons to log study time or adjust progress
                  </span>
                </div>

                {enrolledSubjects.length === 0 ? (
                  <div className={`p-12 text-center rounded-2xl border border-dashed ${dm ? 'border-gray-800 text-gray-500' : 'border-gray-200 text-gray-400'}`}>
                    No subjects enrolled yet. Explore courses in the "My Subjects" tab!
                  </div>
                ) : (
                  enrolledSubjects.map((s, i) => {
                    const pct = progress[s.id] || 0;
                    return (
                      <motion.div
                        key={s.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className={`p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition hover:shadow-md ${
                          dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="text-[10px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded-md">
                              {s.code || 'CODE'}
                            </span>
                            <span className={`font-extrabold text-base truncate ${dm ? 'text-white' : 'text-gray-900'}`}>
                              {s.title}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              dm ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'
                            }`}>
                              Sem {s.semester || '—'} · {s.credits || 0} Credits
                            </span>
                          </div>

                          {/* Progress bar */}
                          <div className="flex items-center gap-3">
                            <div className={`flex-1 h-2.5 rounded-full overflow-hidden ${dm ? 'bg-gray-800' : 'bg-gray-100'}`}>
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  pct >= 100
                                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                                    : pct >= 50
                                    ? 'bg-gradient-to-r from-indigo-500 to-purple-500'
                                    : 'bg-gradient-to-r from-amber-500 to-indigo-500'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className={`text-sm font-black w-12 text-right ${
                              pct >= 100 ? 'text-emerald-500' : pct >= 50 ? 'text-indigo-400' : 'text-amber-500'
                            }`}>
                              {pct}%
                            </span>
                          </div>
                        </div>

                        {/* Interactive Buttons */}
                        <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-gray-100 dark:border-gray-800">
                          <button
                            onClick={() => updateSubjectProgress(s.id, 10)}
                            title="Add 10% study progress"
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition shadow-sm"
                          >
                            +10%
                          </button>
                          <button
                            onClick={() => updateSubjectProgress(s.id, 100)}
                            title="Mark course as 100% completed"
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition shadow-sm"
                          >
                            ✓ Complete
                          </button>
                          <button
                            onClick={() => updateSubjectProgress(s.id, 0)}
                            title="Reset progress to 0%"
                            className={`px-2.5 py-1.5 text-xs font-bold rounded-xl transition ${
                              dm ? 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                          >
                            Reset
                          </button>
                          <Link
                            to={`/subject/${s.id}`}
                            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition border ${
                              dm ? 'border-gray-700 text-indigo-400 hover:bg-gray-800' : 'border-indigo-200 text-indigo-600 hover:bg-indigo-50'
                            }`}
                          >
                            Study →
                          </Link>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ── BOOKMARKS TAB ── */}
          {activeTab === 'bookmarks' && (
            <div className="space-y-4">
              <h2 className={`text-xl font-extrabold ${dm ? 'text-white' : 'text-gray-800'}`}>🔖 Bookmarks</h2>
              {bookmarks.length === 0 ? (
                <div className={`text-center py-16 rounded-2xl border border-dashed ${dm ? 'border-gray-800 text-gray-600' : 'border-gray-200 text-gray-400'}`}>
                  <FaBookmark className="text-4xl mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-medium">No bookmarks yet. Star a subject to save it here.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {allSubjects.filter(s => bookmarks.includes(s.id)).map(s => (
                    <SubjectCard
                      key={s.id} subject={s} progress={progress} dm={dm}
                      isBookmarked={true}
                      onToggleBookmark={toggleBookmark}
                      isEnrolled={enrolledSubjects.some(e => e.id === s.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </main>

      {/* Modals */}
      {showCalc && <CGPACalculator onClose={() => setShowCalc(false)} darkMode={dm} />}
      {showOnboarding && <OnboardingModal user={user} onComplete={handleOnboardingComplete} />}
    </div>
  );
}
