import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaFilePdf, FaTv, FaBrain, FaFolderOpen, FaFilePowerpoint } from 'react-icons/fa';
import { supabase } from '../util/supabase';

export default function SubjectModal({ subject, onClose }) {
  const [activeTab, setActiveTab] = useState('notes');
  const [content, setContent] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch Content based on Tab
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      let data = [];
      
      if (activeTab === 'notes' || activeTab === 'ppt' || activeTab === 'extra') {
        const { data: res } = await supabase
          .from('resources')
          .select('*')
          .eq('subject_id', subject.id)
          .eq('type', activeTab === 'notes' ? 'note' : activeTab); // Mapping 'notes' -> 'note'
        data = res || [];
      } else if (activeTab === 'videos') {
        const { data: res } = await supabase.from('videos').select('*').eq('subject_id', subject.id);
        data = res || [];
      } else if (activeTab === 'quiz') {
        const { data: res } = await supabase.from('quizzes').select('*').eq('subject_id', subject.id);
        data = res || [];
      }
      
      setContent(data);
      setLoading(false);
    }
    fetchData();
  }, [activeTab, subject]);

  const tabs = [
    { id: 'notes', label: 'Notes', icon: <FaFilePdf /> },
    { id: 'ppt', label: 'PPTs', icon: <FaFilePowerpoint /> },
    { id: 'videos', label: 'Videos', icon: <FaTv /> },
    { id: 'quiz', label: 'Quiz', icon: <FaBrain /> },
    { id: 'extra', label: 'Extras', icon: <FaFolderOpen /> },
  ];

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div 
          initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
          className="bg-white w-full max-w-4xl h-[80vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-bold">{subject.title}</h2>
              <p className="text-blue-100 mt-1">{subject.branch} • Sem {subject.semester}</p>
            </div>
            <button onClick={onClose} className="bg-white/20 p-2 rounded-full hover:bg-white/30 transition">
              <FaTimes />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-4 flex items-center justify-center gap-2 font-semibold transition ${
                  activeTab === tab.id 
                  ? 'text-blue-600 border-b-4 border-blue-600 bg-blue-50' 
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="flex-1 p-8 overflow-y-auto bg-gray-50">
            {loading ? (
              <div className="text-center text-gray-400 mt-10">Loading resources...</div>
            ) : content.length === 0 ? (
              <div className="text-center text-gray-400 mt-10">No content uploaded yet.</div>
            ) : (
              <div className="grid gap-4">
                {activeTab === 'videos' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {content.map(vid => (
                      <div key={vid.id} className="bg-white rounded-xl overflow-hidden shadow-sm">
                        <iframe 
                          className="w-full aspect-video"
                          src={`https://www.youtube.com/embed/${vid.video_id}`}
                          title={vid.title}
                          allowFullScreen
                        ></iframe>
                        <div className="p-3 font-bold text-gray-800">{vid.title}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  content.map(item => (
                    <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center hover:shadow-md transition">
                      <div className="flex items-center gap-4">
                        <div className="bg-blue-100 p-3 rounded-lg text-blue-600">
                          {activeTab === 'quiz' ? <FaBrain /> : <FaFilePdf />}
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-800">{item.title}</h4>
                          <p className="text-xs text-gray-500">Added recently</p>
                        </div>
                      </div>
                      <a 
                        href={item.url || item.link} 
                        target="_blank" 
                        rel="noreferrer"
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition"
                      >
                        {activeTab === 'quiz' ? 'Start Quiz' : 'View'}
                      </a>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}