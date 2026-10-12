import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaGraduationCap, FaLock, FaCheckCircle, FaExclamationTriangle,
  FaArrowRight, FaIdCard, FaUserGraduate, FaShieldAlt, FaSpinner,
} from 'react-icons/fa';
import { supabase } from '../util/supabase';
import { PROFILE_KEY } from '../components/OnboardingModal';
import { useTheme } from '../context/ThemeContext';

// ─── helpers ────────────────────────────────────────────────────────────────────
async function getSubjectsForBatch(batch) {
  const branchKey = (batch.branch_id || '').toLowerCase();
  const semNum    = Number(batch.current_semester || 4);
  const map       = SEMESTER_SUBJECT_MAP[branchKey] || {};
  const ids       = new Set();
  for (let s = 1; s <= semNum; s++) (map[s] || []).forEach(id => ids.add(id));

  // Local subjects matching IDs
  const localMatches = ids.size > 0
    ? LOCAL_SUBJECTS.filter(s => ids.has(s.id))
    : [];

  // DB subjects matching numeric IDs
  const numericIds = [...ids].filter(id => typeof id === 'number');
  let dbMatches = [];
  if (numericIds.length > 0) {
    const { data } = await supabase.from('subjects').select('id,title,code').in('id', numericIds);
    dbMatches = data || [];
  }

  return [...localMatches, ...dbMatches];
}

// ─── 6-digit PIN input widget ────────────────────────────────────────────────
function PinInput({ value, onChange, error }) {
  // Single ref holding an array of 6 input DOM nodes — avoids hooks-in-loop violation
  const inputRefs = useRef([]);

  const handleKey = (e, i) => {
    if (e.key === 'Backspace') {
      if (!value[i] && i > 0) inputRefs.current[i - 1]?.focus();
      const next = value.split('');
      next[i] = '';
      onChange(next.join(''));
    }
  };

  const handleChange = (e, i) => {
    const raw  = e.target.value.toUpperCase();
    const char = raw.replace(/[^0-9A-Z]/g, '').slice(-1);
    if (!char) return;
    const next = value.padEnd(6, ' ').split('');
    next[i] = char;
    onChange(next.join('').trimEnd());
    if (i < 5) inputRefs.current[i + 1]?.focus();
  };

  return (
    <div>
      <div className="flex gap-2 justify-center">
        {Array.from({ length: 6 }).map((_, i) => (
          <input
            key={i}
            ref={el => { inputRefs.current[i] = el; }}
            maxLength={1}
            value={value[i] || ''}
            onChange={e => handleChange(e, i)}
            onKeyDown={e => handleKey(e, i)}
            className={`w-11 h-12 text-center text-lg font-extrabold rounded-xl border-2 outline-none transition
              ${error
                ? 'border-red-500 bg-red-50 text-red-700'
                : 'border-gray-200 bg-gray-50 text-gray-800 focus:border-indigo-500 focus:bg-white'
              }`}
          />
        ))}
      </div>
      {error && (
        <p className="text-red-500 text-xs font-semibold mt-2 text-center">{error}</p>
      )}
    </div>
  );
}

// ─── Main Enroll Page ────────────────────────────────────────────────────────
export default function EnrollPage() {
  const { batchToken } = useParams();
  const navigate       = useNavigate();
  const { darkMode }   = useTheme();
  const dm             = darkMode;

  const [phase, setPhase]       = useState('loading'); // loading | verify | form | success | error
  const [batchData, setBatchData] = useState(null);
  const [errorMsg, setErrorMsg]   = useState('');
  const [subjects, setSubjects]   = useState([]);

  // PIN
  const [pin, setPin]           = useState('');
  const [pinError, setPinError] = useState('');

  // Student form
  const [form, setForm] = useState({ fullName: '', rollNo: '', enrollNo: '' });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // ── Step 1: Resolve the batchToken from Supabase ─────────────────────────
  useEffect(() => {
    async function resolveBatch() {
      try {
        const { data, error } = await supabase
          .from('batch_links')
          .select('*')
          .eq('token', batchToken)
          .eq('is_active', true)
          .single();

        if (error || !data) {
          setPhase('error');
          setErrorMsg('This enrollment link is invalid or has expired. Please ask your teacher for a new link.');
          return;
        }
        setBatchData(data);
        setPhase('verify');
        // Fetch the subjects for this batch in background
        getSubjectsForBatch(data).then(subs => setSubjects(subs));
      } catch {
        setPhase('error');
        setErrorMsg('Unable to connect. Please check your internet and try again.');
      }
    }
    resolveBatch();
  }, [batchToken]);

  // ── Step 2: Validate PIN ─────────────────────────────────────────────────
  const handlePinSubmit = () => {
    if (pin.length < 6) {
      setPinError('Please enter the complete 6-character code.');
      return;
    }
    if (pin.toUpperCase() !== batchData.access_code.toUpperCase()) {
      setPinError('Incorrect access code. Please check with your teacher.');
      return;
    }
    setPinError('');
    setPhase('form');
  };

  // ── Step 3: Submit Student Details ───────────────────────────────────────
  const validateForm = () => {
    const errs = {};
    if (!form.fullName.trim())  errs.fullName  = 'Full name is required.';
    if (!form.rollNo.trim())    errs.rollNo    = 'Roll number is required.';
    if (!form.enrollNo.trim())  errs.enrollNo  = 'Enrollment number is required.';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleEnroll = async () => {
    if (!validateForm()) return;
    setSubmitting(true);

    try {
      // Record the enrollment in Supabase
      const { error } = await supabase.from('batch_enrollments').insert([{
        batch_link_id: batchData.id,
        full_name: form.fullName.trim(),
        roll_no: form.rollNo.trim(),
        enroll_no: form.enrollNo.trim(),
        enrolled_at: new Date().toISOString(),
      }]);

      if (error) {
        // Duplicate roll number? (unique constraint)
        if (error.code === '23505') {
          setFormErrors({ rollNo: 'This roll number is already enrolled in this batch.' });
          setSubmitting(false);
          return;
        }
        throw error;
      }

      // Build & persist a local profile from the batch data
      const profile = {
        name: form.fullName.trim(),
        rollNo: form.rollNo.trim(),
        enrollNo: form.enrollNo.trim(),
        schoolId: batchData.school_id  || '',
        degreeId: batchData.degree_id  || '',
        branchId: batchData.branch_id  || '',
        batchId:  batchData.batch_id   || '',
        semester: batchData.current_semester || 4,
        batchToken,
        enrolledViaMagicLink: true,
        completedAt: new Date().toISOString(),
      };
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));

      setPhase('success');
    } catch (err) {
      setFormErrors({ general: err.message || 'Something went wrong. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Derived ──────────────────────────────────────────────────────────────
  const batchLabel   = batchData
    ? `${batchData.degree_name} (${batchData.branch_name}) — Section ${batchData.section} · ${batchData.batch_name}`
    : '';

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-indigo-200 rounded-full blur-3xl opacity-20 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-blue-200 rounded-full blur-3xl opacity-20 translate-x-1/2 translate-y-1/2 pointer-events-none" />

      <AnimatePresence mode="wait">

        {/* ── LOADING ── */}
        {phase === 'loading' && (
          <motion.div key="loading"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4 text-indigo-600"
          >
            <FaSpinner className="text-5xl animate-spin" />
            <p className="font-semibold text-gray-600">Verifying enrollment link…</p>
          </motion.div>
        )}

        {/* ── ERROR ── */}
        {phase === 'error' && (
          <motion.div key="error"
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-red-100 overflow-hidden"
          >
            <div className="bg-gradient-to-r from-red-500 to-rose-600 p-8 text-white text-center">
              <FaExclamationTriangle className="text-5xl mx-auto mb-3" />
              <h1 className="text-2xl font-extrabold">Link Expired</h1>
            </div>
            <div className="p-8 text-center">
              <p className="text-gray-600 mb-6">{errorMsg}</p>
              <Link to="/" className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition">
                Go to Homepage
              </Link>
            </div>
          </motion.div>
        )}

        {/* ── VERIFY PIN ── */}
        {phase === 'verify' && (
          <motion.div key="verify"
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            className="max-w-md w-full"
          >
            {/* Back */}
            <Link to="/" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-800 text-sm font-medium mb-6 transition">
              ← Back to Home
            </Link>

            <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-8 text-white text-center">
                <FaGraduationCap className="text-5xl mx-auto mb-3" />
                <h1 className="text-2xl font-extrabold mb-1">You're Invited!</h1>
                <p className="text-indigo-200 text-sm font-medium">{batchLabel}</p>
              </div>

              <div className="p-8 space-y-6">
                {/* Batch info chips */}
                <div className="flex flex-wrap gap-2 justify-center">
                  <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-1.5 rounded-full border border-indigo-200">
                    🏫 {batchData?.school_name || 'School'}
                  </span>
                  <span className="bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-full border border-blue-200">
                    📚 {subjects.length} Subjects
                  </span>
                  <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-full border border-emerald-200">
                    📅 Sem {batchData?.current_semester}
                  </span>
                </div>

                {/* PIN entry */}
                <div>
                  <div className="flex items-center gap-2 justify-center mb-4">
                    <FaShieldAlt className="text-indigo-500" />
                    <h2 className="font-bold text-gray-800">Enter Your Access Code</h2>
                  </div>
                  <p className="text-sm text-gray-500 text-center mb-4">
                    Your teacher shared a 6-character security code along with this link.
                  </p>
                  <PinInput value={pin} onChange={setPin} error={pinError} />
                </div>

                <button
                  onClick={handlePinSubmit}
                  className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
                >
                  Verify & Continue <FaArrowRight />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── STUDENT FORM ── */}
        {phase === 'form' && (
          <motion.div key="form"
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            className="max-w-md w-full"
          >
            <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
              {/* Header — personalized */}
              <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-8 text-white">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                    <FaUserGraduate className="text-2xl" />
                  </div>
                  <div>
                    <p className="text-indigo-200 text-xs font-bold uppercase tracking-wider">Welcome to</p>
                    <h1 className="text-lg font-extrabold leading-tight">{batchLabel}</h1>
                  </div>
                </div>
                <div className="bg-white/10 rounded-xl px-4 py-2 border border-white/20">
                  <p className="text-indigo-100 text-xs">
                    ✅ Code verified · {subjects.length} subjects will be added to your dashboard
                  </p>
                </div>
              </div>

              <div className="p-8 space-y-5">
                <div>
                  <h2 className="text-gray-800 font-bold text-lg mb-1">Almost there!</h2>
                  <p className="text-gray-500 text-sm">We just need 3 things to set up your account.</p>
                </div>

                {formErrors.general && (
                  <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm border border-red-100">
                    ⚠️ {formErrors.general}
                  </div>
                )}

                {/* Full Name */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Full Name</label>
                  <div className="relative">
                    <FaUserGraduate className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                    <input
                      type="text"
                      placeholder="e.g. Raj Kumar Deshpande"
                      value={form.fullName}
                      onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                      className={`w-full pl-10 pr-4 py-3 rounded-xl border outline-none transition text-gray-800 bg-gray-50 focus:bg-white focus:ring-2
                        ${formErrors.fullName ? 'border-red-300 focus:ring-red-300' : 'border-gray-200 focus:ring-indigo-400 focus:border-transparent'}`}
                    />
                  </div>
                  {formErrors.fullName && <p className="text-red-500 text-xs mt-1">{formErrors.fullName}</p>}
                </div>

                {/* Roll Number */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Roll Number</label>
                  <div className="relative">
                    <FaIdCard className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                    <input
                      type="text"
                      placeholder="e.g. 23CSE0042"
                      value={form.rollNo}
                      onChange={e => setForm(f => ({ ...f, rollNo: e.target.value }))}
                      className={`w-full pl-10 pr-4 py-3 rounded-xl border outline-none transition text-gray-800 bg-gray-50 focus:bg-white focus:ring-2
                        ${formErrors.rollNo ? 'border-red-300 focus:ring-red-300' : 'border-gray-200 focus:ring-indigo-400 focus:border-transparent'}`}
                    />
                  </div>
                  {formErrors.rollNo && <p className="text-red-500 text-xs mt-1">{formErrors.rollNo}</p>}
                </div>

                {/* Enrollment Number */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Enrollment Number</label>
                  <div className="relative">
                    <FaGraduationCap className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                    <input
                      type="text"
                      placeholder="e.g. SIT2023001042"
                      value={form.enrollNo}
                      onChange={e => setForm(f => ({ ...f, enrollNo: e.target.value }))}
                      className={`w-full pl-10 pr-4 py-3 rounded-xl border outline-none transition text-gray-800 bg-gray-50 focus:bg-white focus:ring-2
                        ${formErrors.enrollNo ? 'border-red-300 focus:ring-red-300' : 'border-gray-200 focus:ring-indigo-400 focus:border-transparent'}`}
                    />
                  </div>
                  {formErrors.enrollNo && <p className="text-red-500 text-xs mt-1">{formErrors.enrollNo}</p>}
                </div>

                {/* Security note */}
                <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
                  <FaLock className="text-indigo-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-indigo-700">
                    Your details are only used to identify you within your batch. No account or password needed.
                  </p>
                </div>

                <button
                  onClick={handleEnroll}
                  disabled={submitting}
                  className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {submitting
                    ? <><FaSpinner className="animate-spin" /> Joining…</>
                    : <>Join Class <FaArrowRight /></>
                  }
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── SUCCESS ── */}
        {phase === 'success' && (
          <motion.div key="success"
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full"
          >
            <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden text-center">
              <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-10 text-white">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', bounce: 0.5, delay: 0.1 }}
                >
                  <FaCheckCircle className="text-7xl mx-auto mb-4" />
                </motion.div>
                <h1 className="text-3xl font-extrabold mb-2">You're In! 🎉</h1>
                <p className="text-emerald-100">Successfully enrolled in your batch</p>
              </div>

              <div className="p-8 space-y-5">
                <div className="bg-gray-50 rounded-2xl p-4 text-left space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 font-medium">Name</span>
                    <span className="text-gray-800 font-bold">{form.fullName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 font-medium">Roll No.</span>
                    <span className="text-gray-800 font-bold">{form.rollNo}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 font-medium">Batch</span>
                    <span className="text-gray-800 font-bold text-right max-w-[200px]">{batchLabel}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 font-medium">Subjects Added</span>
                    <span className="text-emerald-600 font-bold">{subjects.length} subjects ✅</span>
                  </div>
                </div>

                {/* Subject preview pills */}
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 text-left">Your Subjects</p>
                  <div className="flex flex-wrap gap-1.5">
                    {subjects.slice(0, 6).map(s => (
                      <span key={s.id} className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded-lg border border-indigo-100">
                        {s.code || s.title?.split(' ')[0]}
                      </span>
                    ))}
                    {subjects.length > 6 && (
                      <span className="bg-gray-100 text-gray-500 text-xs font-bold px-2.5 py-1 rounded-lg">
                        +{subjects.length - 6} more
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => navigate('/dashboard')}
                  className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
                >
                  Go to My Dashboard <FaArrowRight />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
