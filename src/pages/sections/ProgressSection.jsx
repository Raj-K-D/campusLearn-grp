import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaArrowRight, FaTrophy, FaFire, FaCheckCircle } from 'react-icons/fa';

const EMOJIS = ['📚','🧠','⚡','🎯','🔬','💡','🖥️','📐','🧮','📊'];

function getGrade(pct) {
  if (pct >= 80) return { label: 'Excellent', color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' };
  if (pct >= 60) return { label: 'Good', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' };
  if (pct >= 40) return { label: 'Average', color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900/20' };
  return { label: 'Needs Work', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' };
}

export default function ProgressSection({ subjects, progress, dm }) {
  const navigate = useNavigate();
  const overallPct = subjects.length
    ? Math.round(Object.values(progress).reduce((a, b) => a + b, 0) / subjects.length)
    : 0;
  const done = subjects.filter(s => (progress[s.id] || 0) >= 80).length;
  const inProgress = subjects.filter(s => { const p = progress[s.id] || 0; return p > 0 && p < 80; }).length;
  const notStarted = subjects.filter(s => (progress[s.id] || 0) === 0).length;

  return (
    <div>
      <h2 className={`text-2xl font-extrabold mb-6 ${dm ? 'text-white' : 'text-gray-900'}`}>📊 My Progress</h2>

      {/* Overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Overall', value: `${overallPct}%`, icon: <FaTrophy />, color: 'from-indigo-500 to-blue-500' },
          { label: 'Completed', value: done, icon: <FaCheckCircle />, color: 'from-green-500 to-emerald-500' },
          { label: 'In Progress', value: inProgress, icon: <FaFire />, color: 'from-orange-500 to-yellow-500' },
          { label: 'Not Started', value: notStarted, icon: '📭', color: 'from-gray-400 to-gray-500' },
        ].map((card, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            className={`relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br ${card.color} text-white shadow-lg`}>
            <div className="absolute -top-4 -right-4 w-16 h-16 bg-white/10 rounded-full" />
            <div className="text-2xl mb-2">{card.icon}</div>
            <div className="text-3xl font-extrabold">{card.value}</div>
            <div className="text-xs font-medium opacity-80 mt-1">{card.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Overall progress bar */}
      <div className={`p-5 rounded-2xl mb-6 border ${dm ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
        <div className="flex justify-between items-center mb-3">
          <span className={`font-bold ${dm ? 'text-white' : 'text-gray-800'}`}>Overall Completion</span>
          <span className="text-indigo-600 font-extrabold text-lg">{overallPct}%</span>
        </div>
        <div className={`h-3 rounded-full ${dm ? 'bg-gray-700' : 'bg-gray-100'}`}>
          <motion.div
            initial={{ width: 0 }} animate={{ width: `${overallPct}%` }} transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-500"
          />
        </div>
      </div>

      {/* Per-subject list */}
      <div className={`rounded-2xl border overflow-hidden ${dm ? 'border-gray-700' : 'border-gray-100'}`}>
        {subjects.length === 0 ? (
          <div className="p-10 text-center">
            <p className={dm ? 'text-gray-500' : 'text-gray-400'}>No subjects loaded yet.</p>
          </div>
        ) : subjects.map((s, i) => {
          const pct = progress[s.id] || 0;
          const grade = getGrade(pct);
          const emoji = EMOJIS[s.title.length % EMOJIS.length];
          return (
            <motion.div key={s.id}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
              onClick={() => navigate(`/subject/${s.id}`)}
              className={`flex items-center gap-4 p-4 cursor-pointer border-b last:border-b-0 group transition ${
                dm ? 'border-gray-700 hover:bg-gray-800' : 'border-gray-50 hover:bg-gray-50'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${dm ? 'bg-gray-700' : 'bg-indigo-50'}`}>
                {s.icon_url ? <img src={s.icon_url} className="w-7 h-7 object-contain" alt="" /> : emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-semibold text-sm truncate ${dm ? 'text-white' : 'text-gray-800'}`}>{s.title}</span>
                  <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                    <span className={`text-xs font-bold ${grade.color}`}>{grade.label}</span>
                    <span className={`text-sm font-extrabold ${dm ? 'text-indigo-400' : 'text-indigo-600'}`}>{pct}%</span>
                  </div>
                </div>
                <div className={`h-1.5 rounded-full ${dm ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  <motion.div
                    initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ delay: i * 0.04 + 0.3, duration: 0.5 }}
                    className={`h-full rounded-full ${pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-blue-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-400'}`}
                  />
                </div>
              </div>
              <FaArrowRight className={`text-xs flex-shrink-0 ${dm ? 'text-gray-600 group-hover:text-indigo-400' : 'text-gray-300 group-hover:text-indigo-500'} transition`} />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
