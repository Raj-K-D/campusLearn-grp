import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { FaArrowRight, FaLock, FaMoon, FaSun, FaCalculator, FaChevronLeft, FaChevronRight, FaUserTie } from 'react-icons/fa';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import SubjectPage from './pages/SubjectPage';
import Admin from './pages/Admin';
import Login from './pages/Login';
import PasswordReset from './pages/PasswordReset';
import StudentDashboard from './pages/StudentDashboard';
import NotFound from './pages/NotFound';
import EnrollPage from './pages/EnrollPage';
import CoordinatorDashboard from './pages/CoordinatorDashboard';
import { ProtectedRoute, AdminRoute, CoordinatorRoute } from './components/ProtectedRoute';
import CGPACalculator from './components/CGPACalculator';
import AIBuddy from './components/AIBuddy';
import ErrorBoundary from './components/ErrorBoundary';

// ===================== LANDING PAGE =====================
const FEATURES = [
  { icon: '📚', title: 'Notes & PPTs', desc: 'Structured, semester-wise study materials for every branch.' },
  { icon: '🎬', title: 'Video Lectures', desc: 'Curated YouTube lectures linked directly to each subject.' },
  { icon: '🧠', title: 'Quizzes', desc: 'Test yourself with interactive quizzes after each topic.' },
  { icon: '📊', title: 'CGPA Tracker', desc: 'Calculate your CGPA and plan your academic goals.' },
  { icon: '✨', title: 'AI Study Companion', desc: 'Turn course material into summaries, flashcards, study plans, and guided quizzes.' },
  { icon: '🏫', title: 'Campus Workspaces', desc: 'Student, coordinator, and administrator portals bring learning and course management together.' },
];

const STATS = [
  { value: '150+', label: 'Study Materials' },
  { value: '14',   label: 'Subjects Covered' },
  { value: '5+',   label: 'Branches Supported' },
  { value: '100%', label: 'Free Access' },
];

const HERO_IMAGES = [
  {
    src: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1920&q=80',
    alt: 'University students studying together on campus',
  },
  {
    src: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1920&q=80',
    alt: 'Students collaborating on coursework with a laptop',
  },
  {
    src: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1920&q=80',
    alt: 'Students learning together in a classroom',
  },
];

function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { darkMode, setDarkMode } = useTheme();
  const [showCalc, setShowCalc] = useState(false);
  const [heroImageIndex, setHeroImageIndex] = useState(0);
  const dm = darkMode;

  useEffect(() => {
    const slideshow = window.setInterval(() => {
      setHeroImageIndex((index) => (index + 1) % HERO_IMAGES.length);
    }, 6000);
    return () => window.clearInterval(slideshow);
  }, []);

  return (
    <div className={`min-h-screen font-sans transition-colors ${dm ? 'bg-gray-950 text-white' : 'bg-white text-gray-900'}`}>
      {/* NAVBAR */}
      <nav className={`fixed top-0 w-full z-40 px-6 py-4 flex items-center justify-between border-b backdrop-blur-md transition-colors ${
        dm ? 'bg-gray-950/80 border-gray-800' : 'bg-white/80 border-gray-100'
      }`}>
        <Link to="/" className="text-2xl font-extrabold tracking-tight">
          Campus<span className="text-indigo-600">Learn</span>
        </Link>

        <div className={`hidden md:flex items-center gap-7 text-sm font-semibold ${dm ? 'text-gray-300' : 'text-gray-600'}`}>
          <a href="#features" className="hover:text-indigo-400 transition-colors">Features</a>
          <a href="#contact" className="hover:text-indigo-400 transition-colors">Contact</a>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setDarkMode(!dm)}
            className={`p-2.5 rounded-full transition ${dm ? 'text-yellow-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            {dm ? <FaSun /> : <FaMoon />}
          </button>
          {user ? (
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-indigo-600 text-white px-5 py-2 rounded-full font-bold text-sm hover:bg-indigo-700 transition"
            >
              My Dashboard
            </button>
          ) : (
            <Link
              to="/login"
              className="bg-indigo-600 text-white px-5 py-2 rounded-full font-bold text-sm hover:bg-indigo-700 transition"
            >
              Sign In
            </Link>
          )}
        </div>
      </nav>

      {/* HERO */}
      <section className="relative min-h-[680px] flex items-center pt-28 pb-20 px-6 overflow-hidden bg-gray-950">
        <AnimatePresence mode="wait">
          <motion.img
            key={HERO_IMAGES[heroImageIndex].src}
            src={HERO_IMAGES[heroImageIndex].src}
            alt={HERO_IMAGES[heroImageIndex].alt}
            aria-hidden="true"
            initial={{ opacity: 0, scale: 1.06 }}
            animate={{ opacity: 0.22, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 1.2, ease: 'easeInOut' }}
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-r from-gray-950 via-gray-950/90 to-indigo-950/75" />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-gray-950/30" />
        <div className="absolute -top-20 left-1/4 w-96 h-96 bg-indigo-500 rounded-full blur-3xl opacity-15 pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-blue-500 rounded-full blur-3xl opacity-15 pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto text-center relative z-10"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold mb-8 border"
            style={{
              background: dm ? 'rgba(99,102,241,0.1)' : 'rgba(238,242,255,1)',
              borderColor: dm ? 'rgba(99,102,241,0.3)' : 'rgba(199,210,254,1)',
              color: dm ? '#a5b4fc' : '#4f46e5',
            }}
          >
            🎓 A learning workspace for your campus
          </motion.div>

          <h1 className="text-5xl md:text-7xl font-extrabold mb-6 leading-tight tracking-tight">
            One Workspace.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500">
              Every Semester.
            </span>
          </h1>
          <p className={`text-xl md:text-2xl mb-10 max-w-2xl mx-auto leading-relaxed ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
            Organize study resources, track academic progress, and support course teams through one easy-to-use campus platform.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/dashboard')}
              className="inline-flex items-center gap-2 bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-indigo-700 transition shadow-xl shadow-indigo-500/25"
            >
              Start Learning Free <FaArrowRight />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowCalc(true)}
              className={`inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-lg transition border ${
                dm
                  ? 'bg-gray-900 border-gray-700 text-gray-200 hover:bg-gray-800'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm'
              }`}
            >
              <FaCalculator /> CGPA Calculator
            </motion.button>
          </div>

          <div className="mt-12 flex items-center justify-center gap-4" aria-label="Hero background slideshow controls">
            <button
              type="button"
              onClick={() => setHeroImageIndex((index) => (index + HERO_IMAGES.length - 1) % HERO_IMAGES.length)}
              aria-label="Previous background image"
              className="w-9 h-9 rounded-full border border-white/20 bg-black/25 text-white/80 hover:bg-white/15 hover:text-white transition"
            >
              <FaChevronLeft className="mx-auto text-xs" />
            </button>
            <div className="flex items-center gap-2">
              {HERO_IMAGES.map((image, index) => (
                <button
                  key={image.src}
                  type="button"
                  onClick={() => setHeroImageIndex(index)}
                  aria-label={`Show background image ${index + 1}`}
                  aria-current={heroImageIndex === index ? 'true' : undefined}
                  className={`h-2 rounded-full transition-all ${heroImageIndex === index ? 'w-8 bg-indigo-400' : 'w-2 bg-white/45 hover:bg-white/75'}`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setHeroImageIndex((index) => (index + 1) % HERO_IMAGES.length)}
              aria-label="Next background image"
              className="w-9 h-9 rounded-full border border-white/20 bg-black/25 text-white/80 hover:bg-white/15 hover:text-white transition"
            >
              <FaChevronRight className="mx-auto text-xs" />
            </button>
          </div>
        </motion.div>
      </section>

      {/* STATS BAR */}
      <section className={`py-12 border-y ${dm ? 'bg-gray-900 border-gray-800' : 'bg-gray-50 border-gray-100'}`}>
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center"
            >
              <div className="text-4xl font-extrabold text-indigo-600 mb-1">{stat.value}</div>
              <div className={`text-sm font-medium ${dm ? 'text-gray-400' : 'text-gray-500'}`}>{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-20 px-6 max-w-6xl mx-auto scroll-mt-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <h2 className="text-4xl font-extrabold mb-4">One campus platform for learning and operations</h2>
          <p className={`text-lg max-w-2xl mx-auto ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
            One platform, all your study resources — organized, accessible, and free.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -4 }}
              className={`p-6 rounded-2xl border transition-all ${
                dm
                  ? 'bg-gray-900 border-gray-800 hover:border-indigo-700'
                  : 'bg-white border-gray-100 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-50'
              }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4 ${
                dm ? 'bg-indigo-900/40' : 'bg-indigo-50'
              }`}>
                {f.icon}
              </div>
              <h3 className="text-lg font-bold mb-2">{f.title}</h3>
              <p className={`text-sm leading-relaxed ${dm ? 'text-gray-400' : 'text-gray-500'}`}>{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="py-20 px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto rounded-3xl overflow-hidden relative bg-gradient-to-r from-indigo-600 to-blue-600 p-12 text-center text-white"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-24 -mt-24 pointer-events-none" />
          <div className="relative">
            <div className="text-5xl mb-6">🚀</div>
            <h2 className="text-4xl font-extrabold mb-4">Bring your campus learning together</h2>
            <p className="text-indigo-200 mb-8 text-lg max-w-xl mx-auto">
              Bring course resources, academic progress, and study support into one shared workspace.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => navigate(user ? '/dashboard' : '/login')}
                className="inline-flex items-center gap-2 bg-white text-indigo-700 px-8 py-4 rounded-xl font-bold hover:bg-indigo-50 transition"
              >
                {user ? 'Go to Dashboard' : 'Explore CampusLearn'} <FaArrowRight />
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="inline-flex items-center gap-2 bg-white/20 text-white border border-white/30 px-8 py-4 rounded-xl font-bold hover:bg-white/30 transition"
              >
                Browse as Guest
              </button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* CONTACT */}
      <section id="contact" className={`py-20 px-6 border-t scroll-mt-20 ${dm ? 'border-gray-800 bg-gray-900/60' : 'border-gray-100 bg-gray-50'}`}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-5xl mx-auto"
        >
          <div className="text-center mb-10">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-indigo-400 mb-3">We’re here to help</p>
            <h2 className="text-4xl font-extrabold mb-4">Contact us</h2>
            <p className={`text-lg max-w-2xl mx-auto ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
              Need help with your account, course access, or the platform? Choose the right channel and we’ll get you pointed in the right direction.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <motion.div
              whileHover={{ y: -4 }}
              className={`rounded-2xl border p-6 ${dm ? 'bg-gray-950 border-gray-800' : 'bg-white border-gray-200'}`}
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="w-11 h-11 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center"><FaUserTie /></span>
                <h3 className="font-bold text-lg">Course access &amp; accounts</h3>
              </div>
              <p className={`text-sm leading-relaxed mb-5 ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
                For coordinator invitations, course assignments, or account access, contact your course coordinator or platform administrator.
              </p>
              <Link to="/coordinator/login" className="inline-flex items-center gap-2 text-sm font-bold text-indigo-400 hover:text-indigo-300 transition-colors">
                Open coordinator portal <FaArrowRight />
              </Link>
            </motion.div>
            <motion.div
              whileHover={{ y: -4 }}
              className={`rounded-2xl border p-6 ${dm ? 'bg-gray-950 border-gray-800' : 'bg-white border-gray-200'}`}
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="w-11 h-11 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center"><FaUserTie /></span>
                <h3 className="font-bold text-lg">Technical support</h3>
              </div>
              <p className={`text-sm leading-relaxed mb-5 ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
                For technical problems or help using CampusLearn, contact your course coordinator or platform administrator. They can route your request to the appropriate team.
              </p>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* FOOTER */}
      <footer className={`border-t py-10 px-6 ${dm ? 'border-gray-800 bg-gray-950' : 'border-gray-100 bg-white'}`}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-xl font-extrabold">
            Campus<span className="text-indigo-600">Learn</span>
          </div>
          <p className={`text-sm ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
            © 2024 CampusLearn — Built with ❤️ for engineering students
          </p>
          <div className="flex gap-4 text-xs font-semibold">
            <a href="#contact" className={`hover:text-indigo-600 transition ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
              Contact Us
            </a>
            <Link to="/dashboard" className={`hover:text-indigo-600 transition ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
              Student Dashboard
            </Link>
            <Link to="/coordinator/login" className={`hover:text-purple-600 transition ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
              Coordinator Portal
            </Link>
            <Link to="/admin/login" className={`hover:text-blue-600 transition ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
              Admin Portal
            </Link>
          </div>
        </div>
      </footer>

      {showCalc && <CGPACalculator onClose={() => setShowCalc(false)} darkMode={dm} />}
    </div>
  );
}

// ===================== PUBLIC DASHBOARD (Guest Browse) =====================
function PublicDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { darkMode } = useTheme();
  const dm = darkMode;

  // Redirect logged-in users to their personalized dashboard
  if (user) {
    navigate('/dashboard', { replace: true });
    return null;
  }

  return <StudentDashboard />;
}

// ===================== MAIN APP =====================
export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Landing />} />
              {/* Student Login Routes */}
              <Route path="/login" element={<Login portal="student" />} />
              <Route path="/student" element={<Login portal="student" />} />
              <Route path="/student-login" element={<Login portal="student" />} />
              <Route path="/reset-password" element={<PasswordReset />} />

              {/* Coordinator Login & Dashboard Routes */}
              <Route path="/coordinator-login" element={<Login portal="coordinator" />} />
              <Route path="/coordinator/login" element={<Login portal="coordinator" />} />
              <Route path="/coordinator" element={
                <CoordinatorRoute>
                  <CoordinatorDashboard />
                </CoordinatorRoute>
              } />

              {/* Admin Login & Dashboard Routes */}
              <Route path="/admin-login" element={<Login portal="admin" />} />
              <Route path="/admin/login" element={<Login portal="admin" />} />
              <Route path="/admin" element={
                <AdminRoute>
                  <Admin />
                </AdminRoute>
              } />

              {/* Magic link enrollment — no auth required */}
              <Route path="/enroll/:batchToken" element={<EnrollPage />} />
              {/* Public subject browser — guests can browse, login needed for quiz/extras */}
              <Route path="/dashboard" element={<StudentDashboard />} />
              <Route path="/subject/:id" element={<SubjectPage />} />
              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            <AIBuddy />
          </BrowserRouter>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}