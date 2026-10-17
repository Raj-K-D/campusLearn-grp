import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../util/supabase';
import { requestAI } from '../util/ai';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaArrowLeft, FaFilePdf, FaTv, FaBrain, FaTimes,
  FaFolderOpen, FaFilePowerpoint, FaBook, FaLock,
  FaMoon, FaSun, FaSignOutAlt, FaCalculator, FaDownload,
  FaClipboardList, FaBookOpen, FaFileAlt, FaFlask,
  FaChalkboardTeacher, FaUsers, FaLightbulb,
  FaQuestionCircle, FaFileInvoice, FaUpload, FaCalendarAlt,
  FaMagic, FaRobot
} from 'react-icons/fa';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import CGPACalculator from '../components/CGPACalculator';
import SubmissionSection from '../components/SubmissionSection';
import { LOCAL_SUBJECTS } from '../data/localSubjects';
import { extractPdfText } from '../util/pdf';
import { resolveResourceUrl } from '../util/resourceUrls';

export default function SubjectPage() {
  const { id } = useParams();
  const { user, isCoordinator, isAdmin, isFaculty, signOut, isCoordinatorOf } = useAuth();
  const { darkMode, setDarkMode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const dm = darkMode;

  const fromCoordinator = location.state?.from === 'coordinator';
  const backTarget = fromCoordinator ? '/coordinator' : (location.state?.from === 'admin' ? '/admin' : (isCoordinator ? '/coordinator' : (isAdmin ? '/admin' : '/dashboard')));
  const backLabel = fromCoordinator ? 'Coordinator' : (location.state?.from === 'admin' ? 'Admin' : (isCoordinator ? 'Coordinator' : (isAdmin ? 'Admin' : 'Dashboard')));
 
  const [peekMode, setPeekMode] = useState(false);
  const isFacultyActive = () => {
    if (peekMode) return false;
    return isFaculty();
  };

  const [subject, setSubject] = useState(null);
  const [activeTab, setActiveTab] = useState('note');
  const [activeSubTab, setActiveSubTab] = useState('main'); // For question_papers (main, ta1, ta2)
  const [content, setContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subjectLoading, setSubjectLoading] = useState(true);
  const [showCalc, setShowCalc] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({ title: '', url: '', type: 'note', file: null, visibility: 'SUBJECT_WIDE' });
  const [uploading, setUploading] = useState(false);
  const [refetchCount, setRefetchCount] = useState(0);
  const [pdfSummary, setPdfSummary] = useState(null);
  const pdfSummaryRequest = useRef(0);

  // Listen for manual refetch events (e.g. after inline delete)
  useEffect(() => {
    const handler = () => setRefetchCount(c => c + 1);
    window.addEventListener('refetch-subject-content', handler);
    return () => window.removeEventListener('refetch-subject-content', handler);
  }, []);

  // Real progress tracking — which tabs has this student actually visited?
  const VISITED_KEY = `cl_visited_${id}`;
  const [visitedTabs, setVisitedTabs] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(VISITED_KEY) || '[]')); }
    catch { return new Set(); }
  });

  const [aiQuizOutput, setAiQuizOutput] = useState('');
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);

  const generateAIQuiz = async () => {
    setIsGeneratingQuiz(true);
    setAiQuizOutput('');
    try {
      const text = await requestAI({
        message: `Generate a 3-question multiple choice mock exam for the subject: "${subject?.title}". Format it clearly in Markdown. Do NOT include the answers immediately. Provide an "Answer Key" at the very bottom. Make the questions difficult and university-level.`,
        context: 'You are the CampusLearn Pro AI Exam Generator.',
      });
      setAiQuizOutput(text);
    } catch (e) {
      console.error(e);
      setAiQuizOutput(`Unable to generate the quiz: ${e.message || 'AI service unavailable.'}`);
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const summarizePdf = async (item, url) => {
    const resolvedUrl = resolveResourceUrl(url);
    const requestId = pdfSummaryRequest.current + 1;
    pdfSummaryRequest.current = requestId;
    setPdfSummary({ requestId, title: item.title || 'PDF notes', url: resolvedUrl, text: '', status: 'loading', error: '' });

    try {
      let response = await fetch(resolvedUrl);
      if (!response.ok && resolvedUrl !== url) {
        response = await fetch(url.replace(/ /g, '%20'));
      }
      if (!response.ok) throw new Error(`Could not download this PDF (HTTP ${response.status}).`);
      const text = await extractPdfText(new Uint8Array(await response.arrayBuffer()));
      if (pdfSummaryRequest.current !== requestId) return;

      setPdfSummary((current) => current?.requestId === requestId
        ? { ...current, status: 'summarizing' }
        : current
      );
      await requestAI({
        message: `Summarize the attached PDF notes and explain each main concept. Organize the summary into clear headings, define important terms, include simple examples, and highlight the key takeaways.`,
        context: `The student opened these notes from the ${subject?.title || 'subject'} Notes screen.`,
        pdfDocuments: [{ name: item.title || 'PDF notes', text }],
        onToken: (token) => setPdfSummary((current) => current?.requestId === requestId
          ? { ...current, text: current.text + token }
          : current
        ),
      });
      setPdfSummary((current) => current?.requestId === requestId
        ? { ...current, status: 'done' }
        : current
      );
    } catch (error) {
      setPdfSummary((current) => current?.requestId === requestId
        ? { ...current, status: 'error', error: error.message || 'Could not summarize this PDF.' }
        : current
      );
    }
  };

  const closePdfSummary = () => {
    pdfSummaryRequest.current += 1;
    setPdfSummary(null);
  };

  const markTabVisited = (tabId) => {
    if (tabId === 'submission') return; // don't count submission
    setVisitedTabs(prev => {
      const next = new Set(prev).add(tabId);
      localStorage.setItem(VISITED_KEY, JSON.stringify([...next]));
      // Update global progress in dashboard storage
      const PROGRESS_KEY = 'cl_progress';
      try {
        const prog = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
        // 13 countable tabs (excluding submission)
        const TOTAL_TABS = 13;
        prog[id] = Math.round((next.size / TOTAL_TABS) * 100);
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(prog));
      } catch {}
      return next;
    });
  };

  // Fetch subject info — with local fallback
  useEffect(() => {
    async function fetchSubject() {
      setSubjectLoading(true);
      let data = null;
      let error = null;

      // Skip Supabase if it's a local subject to prevent type errors (400 Bad Request)
      if (!id.startsWith('local-')) {
        const result = await supabase
          .from('subjects').select('*').eq('id', id).maybeSingle();
        data = result.data;
        error = result.error;
      }

      if (data) {
        setSubject(data);
      } else {
        // Fall back to local static data matching by ID or title
        const local = LOCAL_SUBJECTS.find(s => s.id === id || s.title?.toLowerCase().trim() === String(id).toLowerCase().trim());
        if (local) setSubject(local);
        else if (error) console.error('Error fetching subject:', error);
      }
      setSubjectLoading(false);
    }
    fetchSubject();
  }, [id]);

  // Fetch tab content + track visit
  useEffect(() => {
    async function fetchData() {
      if (!subject) return;
      setLoading(true);
      markTabVisited(activeTab);
      let data = [];

      // Skip Supabase if it's a local subject
      if (!id.startsWith('local-')) {
        if (activeTab === 'videos') {
          const { data: res, error } = await supabase
            .from('videos').select('*').eq('subject_id', id);
          if (error) console.error('Error fetching videos:', error);
          data = res || [];
        } else if (activeTab === 'timeline') {
          const { data: res, error } = await supabase
            .from('subject_timeline').select('*').eq('subject_id', id).order('week_number', { ascending: true });
          if (error) console.error('Error fetching timeline:', error);
          data = res || [];
        } else if (activeTab === 'quiz') {
          const { data: res, error } = await supabase
            .from('quizzes').select('*').eq('subject_id', id);
          if (error) console.error('Error fetching quizzes:', error);
          data = res || [];
        } else if (activeTab === 'question_papers') {
          // Fetch regular question papers
          const { data: qpData } = await supabase.from('resources').select('*').eq('subject_id', id).eq('type', 'question_papers');
          let combinedData = (qpData || []).filter(r => r.approval_status === 'approved' || r.owner_id === user?.id || isFaculty());

          // If faculty, also fetch TA papers
          if (isFacultyActive()) {
            const { data: taData } = await supabase.from('faculty_workspace').select('*').eq('subject_id', id).in('sub_type', ['TA1', 'TA2']);
            if (taData) {
              combinedData = [...combinedData, ...taData];
            }
          }
          data = combinedData;
        } else {
          // subject_id might be int or string depending on source. 
          // We try both to be safe against different DB schemas.
          const { data: res, error } = await supabase
            .from('resources').select('*')
            .eq('subject_id', id)
            .eq('type', activeTab);
          
          if (error) console.error('Error fetching resources:', error);
          data = (res || []).filter(r => r.approval_status === 'approved' || r.owner_id === user?.id || isFaculty());

          // If no data found and ID is numeric, try integer match
          if (data.length === 0 && !isNaN(id) && !id.includes('-')) {
             const { data: res2 } = await supabase
              .from('resources').select('*')
              .eq('subject_id', parseInt(id))
              .eq('type', activeTab);
             if (res2?.length) {
               data = res2.filter(r => r.approval_status === 'approved' || r.owner_id === user?.id || isFaculty());
             }
          }
        }
      }

      // Always fallback to local static data if Supabase returns nothing
      if (data.length === 0) {
        const local = LOCAL_SUBJECTS.find(s => 
          s.id === id || 
          (subject?.title && s.title?.toLowerCase().trim() === subject.title.toLowerCase().trim()) ||
          (subject?.code && s.code?.toLowerCase().trim() === subject.code.toLowerCase().trim())
        );
        data = (local?.resources || []).filter(r => r.type === activeTab);
      }

      setContent(data);
      setLoading(false);
    }
    fetchData();
  }, [activeTab, subject, id, user, refetchCount, peekMode]);

  const tabs = [
    { id: 'timeline',            label: 'Syllabus Timeline',     icon: <FaCalendarAlt /> },
    { id: 'assignment',          label: 'Assignment',            icon: <FaClipboardList /> },
    { id: 'book',                label: 'Books',                 icon: <FaBookOpen /> },
    { id: 'handout',             label: 'Course Handout',        icon: <FaFileAlt /> },
    { id: 'experiential',        label: 'Experiential Learning', icon: <FaFlask /> },
    { id: 'extra',               label: 'Extras',                icon: <FaFolderOpen /> },
    { id: 'lesson_plan',         label: 'Lesson Plan',           icon: <FaChalkboardTeacher /> },
    { id: 'note',                label: 'Notes',                 icon: <FaFilePdf /> },
    { id: 'participative',       label: 'Participative Learning',icon: <FaUsers /> },
    { id: 'ppt',                 label: 'PPTs',                  icon: <FaFilePowerpoint /> },
    { id: 'problem_solving',     label: 'Problem Solving',       icon: <FaLightbulb /> },
    { id: 'question_bank',       label: 'Question Bank',         icon: <FaQuestionCircle /> },
    { id: 'question_papers',     label: 'Question Papers',       icon: <FaFileInvoice /> },
    { id: 'videos',              label: 'Video Lectures',        icon: <FaTv /> },
    { id: 'submission',          label: 'Submission',            icon: <FaUpload /> },
  ].filter(t => !t.facultyOnly || isFacultyActive());
  const activeTabObj = tabs.find(t => t.id === activeTab) || tabs[0];

  // Loading subject state
  if (subjectLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${dm ? 'bg-gray-950' : 'bg-gray-50'}`}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className={`text-sm font-medium ${dm ? 'text-gray-400' : 'text-gray-500'}`}>Loading subject...</p>
        </div>
      </div>
    );
  }

  // Subject not found
  if (!subject) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${dm ? 'bg-gray-950 text-white' : 'bg-gray-50'}`}>
        <div className="text-center">
          <div className="text-6xl mb-4">📭</div>
          <h2 className="text-2xl font-bold mb-3">Subject not found</h2>
          <Link to="/dashboard" className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }
  const SUBJECT_EMOJIS = ['📚', '🧠', '⚡', '🎯', '🔬', '💡', '🖥️', '📐', '🧮', '📊'];
  const emoji = SUBJECT_EMOJIS[subject.title.length % SUBJECT_EMOJIS.length];

  return (
    <div className={`min-h-screen font-sans ${dm ? 'bg-gray-950' : 'bg-gray-50'} ${isFaculty() ? 'pt-[42px]' : ''}`}>
      {/* Faculty Peek Mode Banner */}
      {isFaculty() && (
        <div className={`fixed top-0 left-0 w-full py-2.5 px-6 text-xs font-bold flex flex-wrap items-center justify-between gap-3 z-50 shadow-md ${
          peekMode 
            ? 'bg-amber-500 text-white' 
            : dm ? 'bg-gray-800 border-b border-gray-700 text-gray-300' : 'bg-gray-100 border-b border-gray-200 text-gray-700'
        }`}>
          <span>
            {peekMode 
              ? '👁️ Viewing page exactly as a Student (Peek Mode Active)' 
              : '🎓 Coordinator View: You can see all TA Papers and restricted material.'}
          </span>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setPeekMode(!peekMode)}
              className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                peekMode 
                  ? 'bg-white text-amber-600 hover:bg-gray-100' 
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              {peekMode ? 'Exit Student View' : 'Peek as Student'}
            </button>
            <button
              onClick={() => navigate(backTarget)}
              className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-black/20 hover:bg-black/35 text-white transition"
            >
              ← Back to {backLabel} Portal
            </button>
            {isAdmin && isCoordinator && (
              <button
                onClick={() => navigate(fromCoordinator ? '/admin' : '/coordinator')}
                className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-black/10 hover:bg-black/25 text-white/80 hover:text-white transition"
              >
                Go to {fromCoordinator ? 'Admin' : 'Coordinator'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* TOP NAV */}
      <nav className={`fixed w-full z-40 px-6 py-3 flex items-center justify-between border-b backdrop-blur-md ${
        isFaculty() ? 'top-[42px]' : 'top-0'
      } ${
        dm ? 'bg-gray-950/80 border-gray-800' : 'bg-white/80 border-gray-100'
      }`}>
        {(!isCoordinator && !isAdmin) ? (
          <Link to="/dashboard" className={`flex items-center gap-2 text-sm font-medium transition ${
            dm ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'
          }`}>
            <FaArrowLeft /> Dashboard
          </Link>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(backTarget)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition"
            >
              <FaArrowLeft /> Back to {backLabel}
            </button>
            {isAdmin && isCoordinator && (
              <button
                onClick={() => navigate(fromCoordinator ? '/admin' : '/coordinator')}
                className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg transition ${
                  dm ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Switch to {fromCoordinator ? 'Admin' : 'Coordinator'}
              </button>
            )}
            <Link
              to="/dashboard"
              className={`text-xs font-semibold px-2 py-1 rounded-lg transition ${
                dm ? 'text-gray-400 hover:text-white hover:bg-gray-800' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              Student View
            </Link>
          </div>
        )}
        <Link to="/" className="text-lg font-extrabold">
          Campus<span className="text-indigo-600">Learn</span>
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCalc(true)}
            className={`p-2 rounded-lg transition ${dm ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-100'}`}
            title="CGPA Calculator"
          >
            <FaCalculator />
          </button>
          <button
            onClick={() => setDarkMode(!dm)}
            className={`p-2 rounded-lg transition ${dm ? 'text-yellow-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            {dm ? <FaSun /> : <FaMoon />}
          </button>
          {user ? (
            <button
              onClick={async () => { await signOut(); navigate('/'); }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                dm ? 'text-gray-400 hover:text-red-400 hover:bg-gray-800' : 'text-gray-500 hover:text-red-600 hover:bg-red-50'
              }`}
            >
              <FaSignOutAlt /> Sign Out
            </button>
          ) : (
            <Link
              to="/login"
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition"
            >
              Sign In
            </Link>
          )}
        </div>
      </nav>

      {/* HERO HEADER */}
      <div className={`bg-gradient-to-r from-indigo-700 to-blue-700 text-white pb-20 px-6 relative overflow-hidden ${
        isFaculty() ? 'pt-24' : 'pt-16'
      }`}>
        <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -mr-24 -mt-24 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full -ml-12 -mb-12 pointer-events-none" />

        <div className="container mx-auto max-w-5xl pt-6">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="w-28 h-28 bg-white/15 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-2xl border border-white/20 text-5xl flex-shrink-0"
            >
              {subject.icon_url ? (
                <img
                  src={subject.icon_url}
                  className="w-20 h-20 object-contain"
                  alt={subject.title}
                  onError={e => { e.target.style.display = 'none'; e.target.parentNode.textContent = emoji; }}
                />
              ) : emoji}
            </motion.div>

            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="text-center md:text-left"
            >
              <div className="flex items-center gap-3 mb-3 justify-center md:justify-start flex-wrap">
                {subject.code && (
                  <span className="bg-white text-indigo-700 text-sm font-black px-3 py-1 rounded-lg tracking-wider">
                    {subject.code}
                  </span>
                )}
                {subject.isCore !== undefined && (
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${subject.isCore ? 'bg-emerald-400/20 text-emerald-200' : 'bg-orange-400/20 text-orange-200'}`}>
                    {subject.isCore ? '📌 Core' : '⚡ Elective'}
                  </span>
                )}
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold mb-3 leading-tight">{subject.title}</h1>
              <div className="flex items-center justify-center md:justify-start flex-wrap gap-3 text-indigo-200 text-sm font-medium mb-3">
                <span className="bg-white/15 px-3 py-1 rounded-full">Sem {subject.semester}</span>
                {subject.credits && <span className="bg-white/15 px-3 py-1 rounded-full">{subject.credits} Credits</span>}
                {subject.faculty && <span className="bg-white/15 px-3 py-1 rounded-full">👤 {subject.faculty}</span>}
              </div>
              {subject.description && (
                <p className="text-indigo-100 max-w-2xl text-sm leading-relaxed">{subject.description}</p>
              )}
            </motion.div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT CARD */}
      <div className="container mx-auto max-w-5xl px-4 -mt-10 relative z-10 pb-20">
        <div className={`rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[560px] border ${
          dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'
        }`}>
          {/* Sidebar Tabs */}
          <div className={`w-full md:w-60 border-r flex flex-row md:flex-col gap-1 p-3 overflow-x-auto md:overflow-y-auto md:max-h-[700px] scrollbar-hide ${
            dm ? 'border-gray-800 bg-gray-900' : 'border-gray-100 bg-gray-50'
          }`}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all whitespace-nowrap text-sm relative flex-shrink-0 md:w-full ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20'
                    : dm
                      ? 'text-gray-400 hover:bg-gray-800 hover:text-white'
                      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
                {tab.locked && <FaLock className="ml-auto text-xs opacity-40" />}
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="flex-1 p-6 md:p-8 overflow-y-auto">
            <div className={`flex justify-between items-center mb-6 border-b pb-4 ${
              dm ? 'text-white border-gray-800' : 'text-gray-800 border-gray-100'
            }`}>
              <h2 className="text-xl font-extrabold flex items-center gap-2">
                {tabs.find(t => t.id === activeTab)?.icon}
                {tabs.find(t => t.id === activeTab)?.label} Library
              </h2>
            </div>

            {/* Sub Tabs for Question Papers */}
            {activeTab === 'question_papers' && isFacultyActive() && (
              <div className="flex gap-2 mb-6">
                <button onClick={() => setActiveSubTab('main')} className={`px-4 py-2 rounded-lg text-sm font-bold transition ${activeSubTab === 'main' ? 'bg-indigo-600 text-white' : dm ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>Main Papers</button>
                <button onClick={() => setActiveSubTab('ta1')} className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-1 ${activeSubTab === 'ta1' ? 'bg-indigo-600 text-white' : dm ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'}`}><FaLock className="text-xs"/> TA1 Papers</button>
                <button onClick={() => setActiveSubTab('ta2')} className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-1 ${activeSubTab === 'ta2' ? 'bg-indigo-600 text-white' : dm ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'}`}><FaLock className="text-xs"/> TA2 Papers</button>
              </div>
            )}

            {/* LOCK SCREEN */}
            {(activeTab === 'quiz' || activeTab === 'extra') && !user ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center h-64 text-center"
              >
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-5 ${
                  dm ? 'bg-gray-800' : 'bg-gray-100'
                }`}>
                  <FaLock className={`text-3xl ${dm ? 'text-gray-500' : 'text-gray-400'}`} />
                </div>
                <h3 className={`text-xl font-bold mb-2 ${dm ? 'text-white' : 'text-gray-800'}`}>
                  Members Only Content
                </h3>
                <p className={`mb-6 max-w-xs text-sm ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
                  Sign in to access quizzes and premium resources — 100% free.
                </p>
                <Link
                  to="/login"
                  className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200"
                >
                  Sign In to Unlock
                </Link>
              </motion.div>
            ) : loading ? (
              <div className="space-y-3">
                {[1,2,3].map(n => (
                  <div key={n} className={`h-16 rounded-xl skeleton ${dm ? 'bg-gray-800' : 'bg-gray-100'}`} />
                ))}
              </div>
            ) : (content.length === 0 && activeTab !== 'submission') ? (
              <div className={`text-center py-16 rounded-2xl border border-dashed ${
                dm ? 'border-gray-700' : 'border-gray-200 bg-gray-50'
              }`}>
                <div className="text-4xl mb-3">📭</div>
                <p className={`font-medium ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
                  No content uploaded yet for this tab.
                </p>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3"
                >
                  {/* SUBMISSION SECTION */}
                  {activeTab === 'submission' && (
                    <SubmissionSection subjectId={id} dm={dm} />
                  )}

                  {/* TIMELINE SECTION */}
                  {activeTab === 'timeline' && (
                    <div className="space-y-4">
                      {content.map(t => (
                        <div key={t.id} className={`p-5 rounded-2xl border flex gap-4 ${dm ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100 shadow-sm'}`}>
                          <div className={`w-16 h-16 rounded-xl flex flex-col items-center justify-center font-extrabold flex-shrink-0 ${dm ? 'bg-indigo-900/30 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                            <span className="text-xs uppercase opacity-70">Week</span>
                            <span className="text-2xl">{t.week_number}</span>
                          </div>
                          <div>
                            <h3 className={`font-bold text-lg ${dm ? 'text-white' : 'text-gray-900'}`}>{t.title}</h3>
                            <p className={`text-sm mt-1 ${dm ? 'text-gray-400' : 'text-gray-500'}`}>{t.description}</p>
                            <div className="mt-2 flex gap-2">
                              <span className={`text-xs font-bold px-2 py-1 rounded ${dm ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>{t.type}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* VIDEO GRID */}
                  {activeTab === 'videos' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {content.map(vid => (
                        <div key={vid.id} className="group">
                          <div className={`rounded-xl overflow-hidden shadow-md border ${
                            dm ? 'border-gray-700' : 'border-gray-100'
                          }`}>
                            <iframe
                              className="w-full aspect-video"
                              src={`https://www.youtube.com/embed/${vid.video_id}`}
                              title={vid.title}
                              allowFullScreen
                              loading="lazy"
                            />
                          </div>
                          <h4 className={`mt-2.5 font-bold text-sm ${dm ? 'text-gray-200' : 'text-gray-800'}`}>
                            {vid.title}
                          </h4>
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* RESOURCE / QUIZ LIST */
                    <div className="space-y-4">
                      {activeTab === 'quiz' && (
                        <div className={`p-6 rounded-2xl border mb-6 ${dm ? 'bg-gray-800/50 border-gray-700' : 'bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-100'}`}>
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h3 className={`text-lg font-bold flex items-center gap-2 ${dm ? 'text-white' : 'text-indigo-900'}`}>
                                <FaMagic className="text-amber-500" /> CampusLearn Pro AI
                              </h3>
                              <p className={`text-sm mt-1 ${dm ? 'text-gray-400' : 'text-indigo-700/80'}`}>
                                Generate an infinite number of customized mock exams to test your knowledge.
                              </p>
                            </div>
                            <button 
                              onClick={generateAIQuiz} 
                              disabled={isGeneratingQuiz}
                              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white transition shadow-md ${
                                isGeneratingQuiz ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                              }`}
                            >
                              {isGeneratingQuiz ? (
                                <><div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" /> Generating...</>
                              ) : (
                                <><FaBrain /> Generate Mock Exam</>
                              )}
                            </button>
                          </div>
                          
                          {aiQuizOutput && (
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                              className={`p-6 rounded-xl border mt-4 ${dm ? 'bg-gray-900 border-gray-700 text-gray-200' : 'bg-white border-indigo-100 text-gray-800 shadow-sm'}`}
                            >
                              <div className="flex items-center gap-2 mb-4 font-bold text-indigo-600 border-b pb-2 border-indigo-100/50">
                                <FaRobot /> AI Generated Mock Exam
                              </div>
                              <div className="prose prose-sm max-w-none prose-indigo">
                                <ReactMarkdown>{aiQuizOutput}</ReactMarkdown>
                              </div>
                            </motion.div>
                          )}
                        </div>
                      )}
                      
                      {content.filter(item => {
                        if (activeTab === 'question_papers') {
                          if (activeSubTab === 'main') return !item.sub_type;
                          if (activeSubTab === 'ta1') return item.sub_type === 'TA1';
                          if (activeSubTab === 'ta2') return item.sub_type === 'TA2';
                        }
                        return true;
                      }).map((item, i) => {
                      const rawUrl = item.url || item.link || item.resource_url || '';
                      const url = resolveResourceUrl(rawUrl);
                      const isPdf  = url.toLowerCase().endsWith('.pdf');
                      const isPpt  = url.toLowerCase().endsWith('.pptx') || url.toLowerCase().endsWith('.ppt');
                      const isDoc  = url.toLowerCase().endsWith('.docx') || url.toLowerCase().endsWith('.doc');
                      const fileIcon = activeTab === 'quiz' ? <FaBrain />
                        : isPdf  ? <FaFilePdf />
                        : isPpt  ? <FaFilePowerpoint />
                        : isDoc  ? <FaBook />
                        : <FaFolderOpen />;
                      const fileLabel = activeTab === 'quiz' ? 'Interactive Quiz'
                        : isPdf  ? 'PDF Document'
                        : isPpt  ? 'PowerPoint Presentation'
                        : isDoc  ? 'Word Document'
                        : 'Resource File';

                      return (
                        <div key={item.id || url}>
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04 }}
                            className={`flex items-center justify-between p-4 rounded-xl border transition-all group ${
                              dm
                                ? 'bg-gray-800 border-gray-700 hover:border-indigo-500'
                                : 'bg-white border-gray-100 hover:border-indigo-200 hover:shadow-md'
                            }`}
                          >
                            <div className="flex items-center gap-4 min-w-0">
                              <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg flex-shrink-0 transition-colors ${
                                dm
                                  ? 'bg-indigo-900/40 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white'
                                  : 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white'
                              }`}>
                                {fileIcon}
                              </div>
                              <div className="min-w-0">
                                <h4 className={`font-bold text-sm truncate flex items-center gap-2 ${dm ? 'text-white' : 'text-gray-800'}`}>
                                  {item.title}
                                  {item.approval_status === 'pending' && (
                                    <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full uppercase tracking-wider font-extrabold">
                                      Pending Approval
                                    </span>
                                  )}
                                  {item.approval_status === 'rejected' && (
                                    <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full uppercase tracking-wider font-extrabold">
                                      Rejected
                                    </span>
                                  )}
                                </h4>
                                <p className={`text-xs mt-0.5 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
                                  {fileLabel}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2 flex-shrink-0 ml-3 items-center">
                              {/* PDFs open in browser; PPTX/DOCX need download */}
                              {isPdf && activeTab === 'note' ? (
                                <button
                                  type="button"
                                  onClick={() => summarizePdf(item, url)}
                                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 transition whitespace-nowrap"
                                >
                                  ✨ Summarize
                                </button>
                              ) : isPdf ? (
                                <a href={url} target="_blank" rel="noreferrer"
                                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 transition">
                                  📄 Open
                                </a>
                              ) : activeTab === 'quiz' ? (
                                <a href={url} target="_blank" rel="noreferrer"
                                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 transition">
                                  🚀 Start
                                </a>
                              ) : (
                                <a href={url} download
                                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 transition flex items-center gap-1.5">
                                  <FaDownload className="text-xs" /> Download
                                </a>
                              )}
                            </div>
                          </motion.div>
                        </div>
                      );
                    })}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>
 
      {pdfSummary && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 p-4 flex items-center justify-center"
          onClick={closePdfSummary}
        >
          <motion.section
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pdf-summary-title"
            onClick={(event) => event.stopPropagation()}
            className={`w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border shadow-2xl ${dm ? 'bg-gray-900 border-gray-700 text-gray-100' : 'bg-white border-gray-200 text-gray-800'}`}
          >
            <header className={`flex items-center justify-between gap-4 px-5 py-4 border-b ${dm ? 'border-gray-700' : 'border-gray-100'}`}>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-indigo-500">Gooloogulu PDF summary</p>
                <h2 id="pdf-summary-title" className="font-bold truncate">{pdfSummary.title}</h2>
              </div>
              <button type="button" onClick={closePdfSummary} aria-label="Close summary" className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center hover:bg-gray-500/10">
                <FaTimes />
              </button>
            </header>
            <div className="overflow-y-auto p-5 min-h-40">
              {pdfSummary.status === 'loading' && <p className="text-sm text-gray-500">Reading the PDF…</p>}
              {pdfSummary.status === 'error' && <p role="alert" className="text-sm text-red-500">{pdfSummary.error}</p>}
              {pdfSummary.text && (
                <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-bold prose-p:leading-relaxed">
                  <ReactMarkdown>{pdfSummary.text}</ReactMarkdown>
                  {pdfSummary.status === 'summarizing' && <span className="inline-block w-2 h-4 ml-1 bg-indigo-500 animate-pulse align-middle" />}
                </div>
              )}
              {pdfSummary.status === 'summarizing' && !pdfSummary.text && <p className="text-sm text-gray-500">Gooloogulu is building your summary…</p>}
            </div>
            <footer className={`flex justify-end gap-2 px-5 py-4 border-t ${dm ? 'border-gray-700' : 'border-gray-100'}`}>
              <a href={pdfSummary.url} target="_blank" rel="noreferrer" className="px-4 py-2 rounded-lg text-sm font-semibold border border-indigo-500 text-indigo-600 hover:bg-indigo-500/10">
                Open PDF
              </a>
              <button type="button" onClick={closePdfSummary} className="px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700">
                Done
              </button>
            </footer>
          </motion.section>
        </div>
      )}
      {showCalc && <CGPACalculator onClose={() => setShowCalc(false)} darkMode={dm} />}
    </div>
  );
}