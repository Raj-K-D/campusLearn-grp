import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaBookmark, FaArrowRight, FaTrash } from 'react-icons/fa';

const EMOJIS = ['📚','🧠','⚡','🎯','🔬','💡','🖥️','📐','🧮','📊'];

export default function BookmarksSection({ subjects, bookmarks, onToggleBookmark, progress, dm }) {
  const navigate = useNavigate();
  const bookmarked = subjects.filter(s => bookmarks.includes(s.id));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className={`text-2xl font-extrabold ${dm ? 'text-white' : 'text-gray-900'}`}>🔖 Bookmarks</h2>
        {bookmarked.length > 0 && (
          <span className={`text-sm font-medium px-3 py-1 rounded-full ${dm ? 'bg-indigo-900/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
            {bookmarked.length} saved
          </span>
        )}
      </div>

      {bookmarked.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className={`rounded-2xl border p-16 text-center ${dm ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
          <div className="text-6xl mb-4">🔖</div>
          <h3 className={`text-lg font-bold mb-2 ${dm ? 'text-gray-300' : 'text-gray-700'}`}>No bookmarks yet</h3>
          <p className={`text-sm ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
            Click the <FaBookmark className="inline text-indigo-500" /> icon on any subject card to save it here.
          </p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {bookmarked.map((subject, i) => {
            const emoji = EMOJIS[subject.title.length % EMOJIS.length];
            const pct = progress[subject.id] || 0;
            return (
              <motion.div key={subject.id}
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.06 }}
                className={`rounded-2xl p-5 border group cursor-pointer relative ${dm ? 'bg-gray-800 border-gray-700 hover:border-indigo-500' : 'bg-white border-gray-100 hover:border-indigo-200 hover:shadow-lg'}`}
                onClick={() => navigate(`/subject/${subject.id}`)}
              >
                {/* Remove bookmark */}
                <button
                  onClick={e => { e.stopPropagation(); onToggleBookmark(subject.id); }}
                  className={`absolute top-3 right-3 p-1.5 rounded-lg text-indigo-500 hover:text-red-500 transition`}
                  title="Remove bookmark"
                >
                  <FaTrash className="text-xs" />
                </button>

                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${dm ? 'bg-gray-700' : 'bg-indigo-50'}`}>
                    {subject.icon_url ? <img src={subject.icon_url} className="w-7 h-7 object-contain" alt="" /> : emoji}
                  </div>
                  <div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${dm ? 'bg-gray-700 text-gray-300' : 'bg-indigo-50 text-indigo-600'}`}>
                      {subject.branch} · Sem {subject.semester}
                    </span>
                  </div>
                </div>

                <h3 className={`font-bold mb-1 group-hover:text-indigo-600 transition pr-6 ${dm ? 'text-white' : 'text-gray-900'}`}>
                  {subject.title}
                </h3>
                <p className={`text-xs mb-4 line-clamp-2 ${dm ? 'text-gray-400' : 'text-gray-500'}`}>{subject.description}</p>

                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className={dm ? 'text-gray-500' : 'text-gray-400'}>Progress</span>
                    <span className={`font-bold ${dm ? 'text-indigo-400' : 'text-indigo-600'}`}>{pct}%</span>
                  </div>
                  <div className={`h-1.5 rounded-full ${dm ? 'bg-gray-700' : 'bg-gray-100'}`}>
                    <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                <div className={`flex items-center justify-end text-xs ${dm ? 'text-indigo-400' : 'text-indigo-600'} font-semibold group-hover:gap-2 gap-1 transition-all`}>
                  Open Subject <FaArrowRight />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
