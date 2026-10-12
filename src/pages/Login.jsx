import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaEnvelope, FaLock, FaArrowLeft, FaEye, FaEyeSlash } from 'react-icons/fa';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, signUp, user, getPrimaryPortal, profile } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  // If already logged in and profile loaded, redirect to appropriate dashboard
  useEffect(() => {
    if (user && profile !== null) {
      navigate(getPrimaryPortal(), { replace: true });
    }
  }, [user, profile, navigate, getPrimaryPortal]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (isSignUp) {
        if (password.length < 6) throw new Error('Password must be at least 6 characters.');
        const { error } = await signUp({ email, password });
        if (error) throw error;
        setSuccess('✅ Verification email sent! Please check your inbox.');
      } else {
        const { error } = await signIn({ email, password });
        if (error) throw error;
        // Navigation handled by the useEffect above once profile loads
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-300 rounded-full blur-3xl opacity-10 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-300 rounded-full blur-3xl opacity-10 translate-x-1/2 translate-y-1/2 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md relative"
      >
        {/* Back link */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-800 text-sm font-medium mb-6 transition group"
        >
          <FaArrowLeft className="group-hover:-translate-x-1 transition" />
          Back to Home
        </Link>

        <div className="bg-white rounded-3xl shadow-2xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
          {/* Header gradient */}
          <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-8 text-white text-center">
            <div className="text-4xl font-extrabold mb-1">
              Campus<span className="text-indigo-200">Learn</span>
            </div>
            <p className="text-indigo-200 text-sm mb-3">
              {isSignUp ? 'Create your CampusLearn account' : 'Welcome back 👋'}
            </p>
            <div className="inline-flex items-center gap-1.5 bg-white/15 px-3 py-1 rounded-full text-xs font-semibold text-white/90">
              <span>🎓 Students</span>
              <span>•</span>
              <span>🧑‍🏫 Coordinators</span>
              <span>•</span>
              <span>🛡️ Admins</span>
            </div>
          </div>

          <div className="p-8">
            {/* Toggle tabs */}
            <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
              <button
                onClick={() => { setIsSignUp(false); setError(''); setSuccess(''); }}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${!isSignUp ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                  }`}
              >
                Sign In
              </button>
              <button
                onClick={() => { setIsSignUp(true); setError(''); setSuccess(''); }}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${isSignUp ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                  }`}
              >
                Sign Up Free
              </button>
            </div>

            {/* Error / Success */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-5 text-sm font-medium border border-red-100 flex items-start gap-2"
              >
                ⚠️ {error}
              </motion.div>
            )}
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-green-50 text-green-700 px-4 py-3 rounded-xl mb-5 text-sm font-medium border border-green-100"
              >
                {success}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Email Address</label>
                <div className="relative">
                  <FaEnvelope className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                  <input
                    type="email"
                    placeholder="yourname@gmail.com"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition text-gray-800 bg-gray-50 focus:bg-white"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Password</label>
                <div className="relative">
                  <FaLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder={isSignUp ? 'Min. 6 characters' : 'Enter password'}
                    className="w-full pl-10 pr-12 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition text-gray-800 bg-gray-50 focus:bg-white"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-lg shadow-indigo-200 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </span>
                ) : isSignUp ? 'Create Account 🚀' : 'Sign In →'}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-gray-100 text-center">
              <p className="text-gray-500 text-sm">
                {isSignUp ? 'Already have an account?' : 'New to CampusLearn?'}{' '}
                <button
                  onClick={() => { setIsSignUp(!isSignUp); setError(''); setSuccess(''); }}
                  className="text-indigo-600 font-bold hover:underline"
                >
                  {isSignUp ? 'Sign In' : 'Sign Up Free'}
                </button>
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}