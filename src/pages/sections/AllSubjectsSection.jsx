import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FaSearch, FaArrowRight, FaBookmark } from 'react-icons/fa';

const EMOJIS = ['📚','🧠','⚡','🎯','🔬','💡','🖥️','📐','🧮','📊'];

export default function AllSubjectsSection({ subjects, progress, bookmarks, onToggleBookmark, dm }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filterBranch, setFilterBranch] = useState('All');
  const [filterSem, setFilterSem] = useState('All');

  const branches = ['All', ...new Set(subjects.map(s => s.branch).filter(Boolean))];
  const semesters = ['All', ...new Set(subjects.map(s => s.semester).filter(Boolean)).values()].sort();

  const filtered = subjects.filter(s =>
    s.title.toLowerCase().includes(search.toLowerCase()) &&
    (filterBranch === 'All' || s.branch === filterBranch) &&
    (filterSem === 'All' || String(s.semester) === String(filterSem))
  );

  return (
    <div>
      <h2 className={`text-2xl font-extrabold mb-6 ${dm ? 'text-white' : 'text-gray-900'}`}>📚 All Subjects</h2>

      {/* Search */}
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-4 ${dm ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
        <FaSearch className={dm ? 'text-gray-500' : 'text-gray-400'} />
        <input
          type="text" placeholder="Search subjects..."
          value={search} onChange={e => setSearch(e.target.value)}
          className={`bg-transparent outline-none text-sm w-full ${dm ? 'text-white placeholder-gray-500' : 'text-gray-700'}`}
        />
      </div>

      {/* Branch pills */}
      <div className="flex gap-2 flex-wrap mb-3">
        {branches.map(b => (
          <button key={b} onClick={() => setFilterBranch(b)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${
              filterBranch === b ? 'bg-indigo-600 text-white border-indigo-600' : dm ? 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white' : 'bg-white text-gray-500 border-gray-200 hover:text-gray-800'
            }`}>{b}</button>
        ))}
      </div>

      {/* Semester pills */}
      <div className="flex gap-2 flex-wrap mb-6">
        {semesters.map(s => (
          <button key={s} onClick={() => setFilterSem(String(s))}
            className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${
              String(filterSem) === String(s) ? 'bg-blue-600 text-white border-blue-600' : dm ? 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white' : 'bg-white text-gray-500 border-gray-200 hover:text-gray-800'
            }`}>{s === 'All' ? 'All Sems' : `Sem ${s}`}</button>
        ))}
      </div>

      <p className={`text-sm mb-4 ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
        Showing <strong>{filtered.length}</strong> of {subjects.length} subjects
      </p>

      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-3">🔍</div>
          <p className={dm ? 'text-gray-400' : 'text-gray-500'}>No subjects match your filters.</p>
        </div>
      ) : (
        <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          <AnimatePresence>
            {filtered.map((subject, i) => {
              const emoji = EMOJIS[subject.title.length % EMOJIS.length];
              const isBookmarked = bookmarks.includes(subject.id);
              return (
                <motion.div key={subject.id}
                  layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }} transition={{ delay: i * 0.03 }}
                  className={`rounded-2xl p-5 border group cursor-pointer relative ${dm ? 'bg-gray-800 border-gray-700 hover:border-indigo-500' : 'bg-white border-gray-100 hover:border-indigo-200 hover:shadow-lg'}`}
                  onClick={() => navigate(`/subject/${subject.id}`)}
                >
                  {/* Bookmark button */}
                  <button
                    onClick={e => { e.stopPropagation(); onToggleBookmark(subject.id); }}
                    className={`absolute top-4 right-4 p-1.5 rounded-lg transition ${isBookmarked ? 'text-indigo-500' : dm ? 'text-gray-600 hover:text-indigo-400' : 'text-gray-300 hover:text-indigo-500'}`}
                  >
                    <FaBookmark />
                  </button>

                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-3 ${dm ? 'bg-gray-700' : 'bg-indigo-50'}`}>
                    {subject.icon_url ? <img src={subject.icon_url} className="w-7 h-7 object-contain" alt="" /> : emoji}
                  </div>
                  <h3 className={`font-bold mb-1 group-hover:text-indigo-600 transition ${dm ? 'text-white' : 'text-gray-900'}`}>{subject.title}</h3>
                  <p className={`text-xs mb-3 line-clamp-2 ${dm ? 'text-gray-400' : 'text-gray-500'}`}>{subject.description}</p>

                  {/* Progress */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className={dm ? 'text-gray-500' : 'text-gray-400'}>Progress</span>
                      <span className={`font-bold ${dm ? 'text-indigo-400' : 'text-indigo-600'}`}>{progress[subject.id] || 0}%</span>
                    </div>
                    <div className={`h-1.5 rounded-full ${dm ? 'bg-gray-700' : 'bg-gray-100'}`}>
                      <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all" style={{ width: `${progress[subject.id] || 0}%` }} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex gap-1.5">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${dm ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-500'}`}>{subject.branch}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${dm ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-500'}`}>Sem {subject.semester}</span>
                    </div>
                    <FaArrowRight className={`text-xs ${dm ? 'text-gray-500 group-hover:text-indigo-400' : 'text-gray-300 group-hover:text-indigo-600'} transition`} />
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
