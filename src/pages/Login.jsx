import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FaEnvelope, FaLock, FaArrowLeft, FaEye, FaEyeSlash,
  FaShieldAlt, FaUserTie, FaGraduationCap, FaArrowRight, FaSignOutAlt
} from 'react-icons/fa';

const OWNER_EMAILS = ['rajdugane00@gmail.com', 'rajdugane685@gmail.com'];

export default function Login({ portal: propPortal }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signIn, signUp, signOut, user, profile, isAdmin, isCoordinator } = useAuth();

  // Detect portal from prop or URL
  const portal = propPortal || (() => {
    const path = location.pathname.toLowerCase();
    if (path.includes('admin')) return 'admin';
    if (path.includes('coordinator')) return 'coordinator';
    return 'student';
  })();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  // If already logged in, check if allowed in this portal or redirect
  useEffect(() => {
    if (user && profile !== null) {
      if (portal === 'admin') {
        const hasAdmin = isAdmin || OWNER_EMAILS.includes(user.email?.toLowerCase());
        if (hasAdmin) {
          navigate('/admin', { replace: true });
        }
      } else if (portal === 'coordinator') {
        const hasCoord = isCoordinator || isAdmin || OWNER_EMAILS.includes(user.email?.toLowerCase());
        if (hasCoord) {
          navigate('/coordinator', { replace: true });
        }
      } else if (portal === 'student') {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [user, profile, isAdmin, isCoordinator, portal, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (isSignUp) {
        if (portal === 'admin') {
          throw new Error('Administrator accounts are provisioned by system administration and cannot be self-registered.');
        }
        if (password.length < 6) throw new Error('Password must be at least 6 characters.');
        const { error: upErr } = await signUp({ email: email.trim(), password });
        if (upErr) throw upErr;
        setSuccess('✅ Account created! Please check your email to verify and sign in.');
      } else {
        const { data, error: inErr } = await signIn({ email: email.trim(), password });
        if (inErr) throw inErr;

        // Role verification after sign in
        const signedUser = data?.user;
        const signedEmail = signedUser?.email?.toLowerCase();

        if (portal === 'admin') {
          // Verify admin privileges
          const isOwner = OWNER_EMAILS.includes(signedEmail);
          // Wait briefly for profile check if needed
          if (!isOwner && !isAdmin) {
            // Note: If profile is not yet hydrated, useEffect will handle or we navigate
            navigate('/admin', { replace: true });
          } else {
            navigate('/admin', { replace: true });
          }
        } else if (portal === 'coordinator') {
          navigate('/coordinator', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  // If user is already authenticated with a different role that doesn't permit this portal:
  if (user && profile !== null) {
    const isOwner = OWNER_EMAILS.includes(user.email?.toLowerCase());
    const hasAdmin = isAdmin || isOwner;
    const hasCoord = isCoordinator || isAdmin || isOwner;

    if (portal === 'admin' && !hasAdmin) {
      return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-gray-950 border border-gray-800 rounded-3xl p-8 text-center text-white shadow-2xl">
            <div className="w-16 h-16 bg-red-900/40 text-red-400 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 border border-red-800/60">
              <FaShieldAlt />
            </div>
            <h2 className="text-2xl font-extrabold mb-2">Admin Portal Restricted</h2>
            <p className="text-gray-400 text-sm mb-6">
              You are signed in as <span className="text-gray-200 font-bold">{user.email}</span>, which does not have Super Administrator privileges.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition"
              >
                Go to Student Dashboard →
              </button>
              {isCoordinator && (
                <button
                  onClick={() => navigate('/coordinator')}
                  className="w-full py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition"
                >
                  Go to Coordinator Portal →
                </button>
              )}
              <button
                onClick={async () => { await signOut(); navigate('/admin'); }}
                className="w-full py-2.5 bg-gray-800 text-gray-300 font-semibold rounded-xl hover:bg-gray-700 transition text-xs flex items-center justify-center gap-2"
              >
                <FaSignOutAlt /> Sign Out / Use Another Account
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (portal === 'coordinator' && !hasCoord) {
      return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-gray-950 border border-gray-800 rounded-3xl p-8 text-center text-white shadow-2xl">
            <div className="w-16 h-16 bg-purple-900/40 text-purple-400 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 border border-purple-800/60">
              <FaUserTie />
            </div>
            <h2 className="text-2xl font-extrabold mb-2">Coordinator Access Restricted</h2>
            <p className="text-gray-400 text-sm mb-6">
              You are signed in as <span className="text-gray-200 font-bold">{user.email}</span>, but this account has not been assigned as a Subject Coordinator.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition"
              >
                Go to Student Dashboard →
              </button>
              <button
                onClick={async () => { await signOut(); navigate('/coordinator'); }}
                className="w-full py-2.5 bg-gray-800 text-gray-300 font-semibold rounded-xl hover:bg-gray-700 transition text-xs flex items-center justify-center gap-2"
              >
                <FaSignOutAlt /> Sign Out / Use Another Account
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  // Visual configuration per portal
  const configs = {
    admin: {
      bg: 'bg-gradient-to-br from-slate-900 via-gray-950 to-indigo-950 text-white',
      cardBg: 'bg-gray-900/90 border-gray-800 text-white shadow-2xl shadow-indigo-950/50',
      headerGradient: 'bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 text-white',
      badge: '🛡️ Super Administrator Portal',
      badgeBg: 'bg-white/10 text-blue-200 border border-blue-400/30',
      title: 'Admin Sign In',
      subtitle: 'Platform management and department governance',
      buttonBg: 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-900/40',
      inputBg: 'bg-gray-800/80 border-gray-700 text-white focus:bg-gray-800 focus:border-blue-500 placeholder-gray-500',
      labelText: 'text-gray-300',
      icon: <FaShieldAlt className="text-xl" />,
    },
    coordinator: {
      bg: 'bg-gradient-to-br from-purple-50 via-white to-indigo-50 text-gray-900',
      cardBg: 'bg-white border-purple-100 shadow-2xl shadow-purple-200/50',
      headerGradient: 'bg-gradient-to-r from-purple-700 via-purple-600 to-indigo-600 text-white',
      badge: '🧑‍🏫 Faculty & Coordinator Portal',
      badgeBg: 'bg-white/15 text-white',
      title: 'Coordinator Sign In',
      subtitle: 'Manage assigned course syllabi, resources & submissions',
      buttonBg: 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-purple-200',
      inputBg: 'bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:border-purple-500 placeholder-gray-400',
      labelText: 'text-gray-700',
      icon: <FaUserTie className="text-xl" />,
    },
    student: {
      bg: 'bg-gradient-to-br from-indigo-50 via-white to-blue-50 text-gray-900',
      cardBg: 'bg-white border-gray-100 shadow-2xl shadow-gray-200/50',
      headerGradient: 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white',
      badge: '🎓 Engineering Student Portal',
      badgeBg: 'bg-white/15 text-white',
      title: 'Student Sign In',
      subtitle: 'Access structured notes, PPTs, exam prep & CGPA tools',
      buttonBg: 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200',
      inputBg: 'bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:border-indigo-500 placeholder-gray-400',
      labelText: 'text-gray-700',
      icon: <FaGraduationCap className="text-xl" />,
    },
  };

  const cfg = configs[portal] || configs.student;

  return (
    <div className={`min-h-screen ${cfg.bg} flex items-center justify-center p-4 relative overflow-hidden transition-colors`}>
      {/* Background decorations */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-500 rounded-full blur-3xl opacity-10 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500 rounded-full blur-3xl opacity-10 translate-x-1/2 translate-y-1/2 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md relative"
      >
        {/* Back to Home link */}
        <Link
          to="/"
          className={`inline-flex items-center gap-2 text-sm font-medium mb-6 transition group ${
            portal === 'admin' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <FaArrowLeft className="group-hover:-translate-x-1 transition" />
          Back to CampusLearn Home
        </Link>

        <div className={`rounded-3xl border overflow-hidden backdrop-blur-md ${cfg.cardBg}`}>
          {/* Header Gradient */}
          <div className={`${cfg.headerGradient} p-8 text-center relative overflow-hidden`}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-3 shadow-sm border border-white/20">
              {cfg.icon}
              <span>{cfg.badge}</span>
            </div>
            <div className="text-3xl font-extrabold tracking-tight mb-1">
              Campus<span className="opacity-90">Learn</span>
            </div>
            <p className="text-xs opacity-90 max-w-xs mx-auto leading-relaxed">
              {isSignUp ? 'Create your account' : cfg.subtitle}
            </p>
          </div>

          <div className="p-8">
            {/* Tabs (Only Student and Coordinator get signup option; Admin is Sign In only) */}
            {portal !== 'admin' ? (
              <div className={`flex rounded-xl p-1 mb-6 ${portal === 'admin' ? 'bg-gray-800' : 'bg-gray-100'}`}>
                <button
                  type="button"
                  onClick={() => { setIsSignUp(false); setError(''); setSuccess(''); }}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                    !isSignUp
                      ? (portal === 'admin' ? 'bg-gray-700 text-white shadow' : 'bg-white text-gray-900 shadow-sm')
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => { setIsSignUp(true); setError(''); setSuccess(''); }}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                    isSignUp
                      ? (portal === 'admin' ? 'bg-gray-700 text-white shadow' : 'bg-white text-gray-900 shadow-sm')
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {portal === 'coordinator' ? 'Activate / Sign Up' : 'Sign Up Free'}
                </button>
              </div>
            ) : (
              <div className="mb-6 p-3 rounded-xl bg-blue-950/50 border border-blue-900/60 text-blue-200 text-xs flex items-center gap-2">
                <FaShieldAlt className="text-blue-400 shrink-0 text-base" />
                <span>Single Super Admin login. Central credentials only.</span>
              </div>
            )}

            {/* Error / Success messages */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/10 text-red-500 px-4 py-3 rounded-xl mb-5 text-xs font-semibold border border-red-500/20 flex items-start gap-2"
              >
                <span>⚠️</span>
                <span>{error}</span>
              </motion.div>
            )}
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-green-500/10 text-green-500 px-4 py-3 rounded-xl mb-5 text-xs font-semibold border border-green-500/20"
              >
                {success}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className={`block text-xs font-bold mb-1.5 ${cfg.labelText}`}>
                  {portal === 'admin' ? 'Administrator Email' : portal === 'coordinator' ? 'Faculty / Coordinator Email' : 'Student Email'}
                </label>
                <div className="relative">
                  <FaEnvelope className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                  <input
                    type="email"
                    placeholder={portal === 'admin' ? 'admin@campuslearn.com' : 'yourname@gmail.com'}
                    className={`w-full pl-10 pr-4 py-3 rounded-xl border outline-none text-sm transition ${cfg.inputBg}`}
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className={`block text-xs font-bold mb-1.5 ${cfg.labelText}`}>Password</label>
                <div className="relative">
                  <FaLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder={isSignUp ? 'Min. 6 characters' : 'Enter password'}
                    className={`w-full pl-10 pr-12 py-3 rounded-xl border outline-none text-sm transition ${cfg.inputBg}`}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition"
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full ${cfg.buttonBg} text-white font-extrabold py-3.5 rounded-xl active:scale-[0.98] transition-all shadow-lg disabled:opacity-60 disabled:cursor-not-allowed mt-2 text-sm flex items-center justify-center gap-2`}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Authenticating...
                  </span>
                ) : isSignUp ? (
                  `Create ${portal === 'coordinator' ? 'Coordinator' : 'Student'} Account 🚀`
                ) : (
                  <>Sign In to {portal === 'admin' ? 'Admin Portal' : portal === 'coordinator' ? 'Coordinator Portal' : 'Dashboard'} <FaArrowRight /></>
                )}
              </button>
            </form>

            {/* Portal Switcher Links */}
            <div className={`mt-8 pt-5 border-t text-center text-xs space-y-2 ${
              portal === 'admin' ? 'border-gray-800 text-gray-400' : 'border-gray-100 text-gray-500'
            }`}>
              <p className="font-semibold text-gray-400 uppercase text-[10px] tracking-wider mb-2">Switch Portal</p>
              <div className="flex flex-wrap items-center justify-center gap-3 font-bold">
                {portal !== 'student' && (
                  <Link to="/login" className="text-indigo-400 hover:underline flex items-center gap-1">
                    <FaGraduationCap /> Student Portal
                  </Link>
                )}
                {portal !== 'coordinator' && (
                  <Link to="/coordinator/login" className="text-purple-400 hover:underline flex items-center gap-1">
                    <FaUserTie /> Coordinator Portal
                  </Link>
                )}
                {portal !== 'admin' && (
                  <Link to="/admin/login" className="text-blue-400 hover:underline flex items-center gap-1">
                    <FaShieldAlt /> Admin Portal
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}