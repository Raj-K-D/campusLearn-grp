import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCalculator, FaTimes, FaRedo } from 'react-icons/fa';

export default function CGPACalculator({ onClose, darkMode }) {
  const [sgpas, setSgpas] = useState(['', '', '', '', '', '', '', '']);
  const [cgpa, setCgpa] = useState(null);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const errs = {};
    sgpas.forEach((val, i) => {
      if (val !== '') {
        const num = parseFloat(val);
        if (isNaN(num) || num < 0 || num > 10) {
          errs[i] = 'Must be 0–10';
        }
      }
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const calculate = () => {
    if (!validate()) return;
    const valid = sgpas.filter(s => s !== '' && !isNaN(parseFloat(s))).map(Number);
    if (valid.length === 0) return;
    const sum = valid.reduce((a, b) => a + b, 0);
    setCgpa((sum / valid.length).toFixed(2));
  };

  const reset = () => {
    setSgpas(['', '', '', '', '', '', '', '']);
    setCgpa(null);
    setErrors({});
  };

  const dm = darkMode;

  const getGrade = (cgpa) => {
    if (cgpa >= 9) return { label: 'Outstanding 🌟', color: 'text-yellow-500' };
    if (cgpa >= 8) return { label: 'Excellent 🎉', color: 'text-green-500' };
    if (cgpa >= 7) return { label: 'Good 👍', color: 'text-blue-500' };
    if (cgpa >= 6) return { label: 'Average 📚', color: 'text-orange-500' };
    return { label: 'Needs Improvement 💪', color: 'text-red-500' };
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden ${
            dm ? 'bg-gray-900 border border-gray-700' : 'bg-white border border-gray-100'
          }`}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <FaCalculator className="text-xl" />
                </div>
                <div>
                  <h3 className="text-xl font-extrabold">CGPA Calculator</h3>
                  <p className="text-indigo-200 text-sm">Enter your semester SGPAs</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition"
              >
                <FaTimes />
              </button>
            </div>
          </div>

          <div className="p-6">
            {/* SGPA Grid */}
            <div className="grid grid-cols-4 gap-3 mb-6">
              {sgpas.map((val, i) => (
                <div key={i}>
                  <label className={`text-xs font-bold block mb-1 ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
                    Sem {i + 1}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="10"
                    placeholder="—"
                    className={`w-full p-2.5 rounded-xl border text-center text-sm font-bold outline-none transition-all ${
                      errors[i]
                        ? 'border-red-400 bg-red-50 dark:bg-red-900/20'
                        : dm
                          ? 'bg-gray-800 border-gray-700 text-white focus:border-indigo-500'
                          : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-indigo-400 focus:bg-white'
                    }`}
                    value={val}
                    onChange={e => {
                      const newSgpas = [...sgpas];
                      newSgpas[i] = e.target.value;
                      setSgpas(newSgpas);
                      if (errors[i]) {
                        const newErrors = { ...errors };
                        delete newErrors[i];
                        setErrors(newErrors);
                      }
                    }}
                  />
                  {errors[i] && (
                    <p className="text-red-500 text-xs mt-1">{errors[i]}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Result */}
            <AnimatePresence>
              {cgpa && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`rounded-xl p-5 mb-6 text-center border ${
                    dm
                      ? 'bg-indigo-900/30 border-indigo-800/50'
                      : 'bg-gradient-to-br from-indigo-50 to-blue-50 border-indigo-100'
                  }`}
                >
                  <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${dm ? 'text-indigo-400' : 'text-indigo-500'}`}>
                    Your CGPA
                  </p>
                  <div className="text-5xl font-extrabold text-indigo-600 mb-2">{cgpa}</div>
                  <p className={`text-sm font-semibold ${getGrade(parseFloat(cgpa)).color}`}>
                    {getGrade(parseFloat(cgpa)).label}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={calculate}
                className="flex-1 bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-200/30"
              >
                Calculate
              </button>
              <button
                onClick={reset}
                className={`px-4 rounded-xl transition-all ${
                  dm
                    ? 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <FaRedo />
              </button>
              <button
                onClick={onClose}
                className={`flex-1 font-bold py-3 rounded-xl transition-all ${
                  dm
                    ? 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Close
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
