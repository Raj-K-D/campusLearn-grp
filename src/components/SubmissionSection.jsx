import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaUpload, FaFilePdf, FaFilePowerpoint, FaFileWord, FaFileAlt, FaTrash,
  FaCheckCircle, FaClock, FaRobot, FaMagic, FaSearch, FaShieldAlt
} from 'react-icons/fa';
import ReactMarkdown from 'react-markdown';
import { supabase } from '../util/supabase';
import { requestAI } from '../util/ai';
import { useAuth } from '../context/AuthContext';

export default function SubmissionSection({ subjectId, dm }) {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [gradingId, setGradingId] = useState(null);
  const [aiFeedback, setAiFeedback] = useState({});
  const [aiErrors, setAiErrors] = useState({});
  const [authScanId, setAuthScanId] = useState(null);
  const [authFeedback, setAuthFeedback] = useState({});
  const [authErrors, setAuthErrors] = useState({});

  const [formData, setFormData] = useState({
    title: '',
    type: 'assignment',
    file: null,
  });

  const STORAGE_KEY = `submissions_${subjectId}_${user?.id || 'guest'}`;

  useEffect(() => {
    // Load from DB first, fallback to localStorage
    async function loadSubmissions() {
      if (user) {
        const { data } = await supabase
          .from('submissions')
          .select('*')
          .eq('subject_id', subjectId)
          .eq('student_id', user.id)
          .order('submitted_at', { ascending: false });
        if (data && data.length > 0) {
          setSubmissions(data.map(s => ({
            id: s.id,
            title: s.title,
            type: s.type,
            fileName: s.file_name,
            date: new Date(s.submitted_at).toLocaleString(),
            status: s.status || 'Submitted',
            fileUrl: s.file_url,
          })));
          return;
        }
      }
      // Fallback: localStorage
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setSubmissions(JSON.parse(saved));
    }
    loadSubmissions();
  }, [subjectId, user]);

  const saveToLocal = (data) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setSubmissions(data);
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.title || !formData.file) {
      alert('Please fill in the title and select a file.');
      return;
    }
    if (!user) {
      alert('Please sign in to submit assignments.');
      return;
    }

    setIsUploading(true);

    try {
      // Upload file to Supabase Storage
      let fileUrl = null;
      const path = `submissions/${user.id}/${Date.now()}_${formData.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: upErr } = await supabase.storage.from('materials').upload(path, formData.file);
      if (upErr) {
        console.warn('Storage upload failed:', upErr.message);
      } else {
        fileUrl = supabase.storage.from('materials').getPublicUrl(path).data.publicUrl;
      }

      // Insert submission row — no teacher_id required, goes to coordinator
      const submissionData = {
        student_id: user.id,
        subject_id: subjectId,
        title: formData.title,
        type: formData.type,
        file_name: formData.file.name,
        file_url: fileUrl,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      };

      let dbId = null;
      try {
        const { data: inserted, error: dbErr } = await supabase
          .from('submissions')
          .insert([submissionData])
          .select()
          .single();
        if (dbErr) throw dbErr;
        dbId = inserted?.id;
      } catch (dbErr) {
        console.warn('DB insert failed, saving locally:', dbErr.message);
      }

      const newSub = {
        id: dbId || Date.now(),
        title: formData.title,
        type: formData.type,
        fileName: formData.file.name,
        fileUrl,
        date: new Date().toLocaleString(),
        status: 'Submitted',
      };

      const updated = [newSub, ...submissions];
      saveToLocal(updated);
      setFormData({ title: '', type: 'assignment', file: null });

      // reset file input
      const fi = document.getElementById('sub-file-input');
      if (fi) fi.value = '';
    } finally {
      setIsUploading(false);
    }
  }

  const deleteSubmission = (id) => {
    const updated = submissions.filter(s => s.id !== id);
    saveToLocal(updated);
  };

  const getIcon = (type) => {
    switch (type) {
      case 'assignment': return <FaFilePdf className="text-red-500" />;
      case 'ppt':        return <FaFilePowerpoint className="text-orange-500" />;
      case 'word':       return <FaFileWord className="text-blue-500" />;
      default:           return <FaFileAlt className="text-gray-500" />;
    }
  };

  const handleAIGrade = async (sub) => {
    setGradingId(sub.id);
    setAiErrors(prev => ({ ...prev, [sub.id]: null }));
    try {
      const text = await requestAI({
        message: `Act as a strict but fair university professor. I am a student submitting an assignment titled "${sub.title}" (${sub.fileName}). Give me a simulated grade out of 10 and 3 bullet points of constructive feedback. State that this estimate is based only on the title and file name because you cannot inspect the submitted file.`,
        context: 'You are CampusLearn Pro AI Grading Assistant.',
      });
      setAiFeedback(prev => ({ ...prev, [sub.id]: text }));
    } catch (e) {
      setAiErrors(prev => ({ ...prev, [sub.id]: e.message || 'AI service unavailable.' }));
    } finally {
      setGradingId(null);
    }
  };

  const handleAuthScan = async (sub) => {
    setAuthScanId(sub.id);
    setAuthErrors(prev => ({ ...prev, [sub.id]: null }));
    try {
      const text = await requestAI({
        message: `An assignment titled "${sub.title}" was uploaded as "${sub.fileName}". Explain that you cannot inspect the uploaded document or verify plagiarism from its title or file name. Give the student a short, practical checklist for reviewing citation quality and originality themselves. Do not generate probability scores.`,
        context: 'You are the CampusLearn Pro academic integrity guide.',
      });
      setAuthFeedback(prev => ({ ...prev, [sub.id]: text }));
    } catch (e) {
      setAuthErrors(prev => ({ ...prev, [sub.id]: e.message || 'AI service unavailable.' }));
    } finally {
      setAuthScanId(null);
    }
  };

  if (!user) {
    return (
      <div className={`text-center py-16 rounded-2xl border border-dashed ${dm ? 'border-gray-700 text-gray-500' : 'border-gray-200 text-gray-400'}`}>
        <FaUpload className="text-3xl mx-auto mb-3 opacity-20" />
        <p className="font-semibold mb-2">Sign in to submit assignments</p>
        <a href="/login" className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-700 transition inline-block mt-2">
          Sign In →
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Upload Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`p-6 rounded-2xl border ${dm ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-gray-100 shadow-sm'}`}
      >
        <h3 className={`text-lg font-bold mb-1 flex items-center gap-2 ${dm ? 'text-white' : 'text-gray-800'}`}>
          <FaUpload className="text-indigo-500" /> Submit Your Assignment
        </h3>
        <p className={`text-sm mb-5 ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
          Upload your work — it will be delivered directly to your subject coordinator.
        </p>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Title */}
          <div className="space-y-1">
            <label className={`text-xs font-semibold ml-1 ${dm ? 'text-gray-400' : 'text-gray-500'}`}>Submission Title</label>
            <input
              type="text"
              placeholder="e.g. Unit 1 Assignment"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              className={`w-full px-4 py-2.5 rounded-xl border outline-none transition-all ${
                dm ? 'bg-gray-800 border-gray-700 text-white focus:border-indigo-500' : 'bg-gray-50 border-gray-200 focus:border-indigo-400'
              }`}
            />
          </div>

          {/* Type */}
          <div className="space-y-1">
            <label className={`text-xs font-semibold ml-1 ${dm ? 'text-gray-400' : 'text-gray-500'}`}>Type</label>
            <select
              value={formData.type}
              onChange={e => setFormData({ ...formData, type: e.target.value })}
              className={`w-full px-4 py-2.5 rounded-xl border outline-none transition-all ${
                dm ? 'bg-gray-800 border-gray-700 text-white focus:border-indigo-500' : 'bg-gray-50 border-gray-200 focus:border-indigo-400'
              }`}
            >
              <option value="assignment">Assignment (PDF)</option>
              <option value="ppt">Presentation (PPTX)</option>
              <option value="word">Document (DOCX)</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* File drop zone */}
          <div className="md:col-span-2">
            <div className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
              dm ? 'border-gray-700 hover:border-indigo-500 bg-gray-800/30' : 'border-gray-200 hover:border-indigo-400 bg-gray-50'
            } ${formData.file ? (dm ? 'border-green-600 bg-green-900/10' : 'border-green-400 bg-green-50') : ''}`}>
              <input
                id="sub-file-input"
                type="file"
                onChange={e => setFormData({ ...formData, file: e.target.files[0] })}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${
                  formData.file
                    ? 'bg-green-100 text-green-500'
                    : dm ? 'bg-gray-700 text-indigo-400' : 'bg-white text-indigo-500 shadow-sm'
                }`}>
                  {formData.file ? <FaCheckCircle /> : <FaUpload />}
                </div>
                <p className={`text-sm font-medium ${dm ? 'text-gray-300' : 'text-gray-600'}`}>
                  {formData.file ? formData.file.name : 'Click or drag to upload your file'}
                </p>
                <p className={`text-xs mt-1 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
                  {formData.file
                    ? `${(formData.file.size / 1024 / 1024).toFixed(2)} MB`
                    : 'PDF, PPTX, DOCX — Max 10 MB'}
                </p>
              </div>
            </div>
          </div>

          {/* Submit button */}
          <div className="md:col-span-2 flex justify-end mt-2">
            <button
              type="submit"
              disabled={isUploading || !formData.title || !formData.file}
              className={`px-8 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
                isUploading || !formData.title || !formData.file
                  ? 'bg-gray-400 cursor-not-allowed text-white'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/30 active:scale-95'
              }`}
            >
              {isUploading ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting...</>
              ) : (
                <><FaUpload /> Submit Assignment</>
              )}
            </button>
          </div>
        </form>
      </motion.div>

      {/* My Submissions */}
      <div className="space-y-4">
        <h3 className={`text-lg font-bold flex items-center gap-2 ${dm ? 'text-white' : 'text-gray-800'}`}>
          <FaClock className="text-indigo-400" /> My Submissions ({submissions.length})
        </h3>

        {submissions.length === 0 ? (
          <div className={`text-center py-12 rounded-2xl border border-dashed ${dm ? 'border-gray-800 text-gray-600' : 'border-gray-200 text-gray-400'}`}>
            <FaUpload className="text-3xl mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">No submissions yet. Submit your first one above!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            <AnimatePresence initial={false}>
              {submissions.map((sub) => (
                <motion.div
                  key={sub.id} layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`p-4 rounded-xl border ${dm ? 'bg-gray-900/40 border-gray-800' : 'bg-white border-gray-100 shadow-sm'}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0 ${dm ? 'bg-gray-800' : 'bg-gray-50'}`}>
                        {getIcon(sub.type)}
                      </div>
                      <div className="min-w-0">
                        <h4 className={`font-bold text-sm ${dm ? 'text-white' : 'text-gray-800'}`}>{sub.title}</h4>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${dm ? 'bg-indigo-900/30 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                            {sub.fileName}
                          </span>
                          {sub.fileUrl && (
                            <a href={sub.fileUrl} target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline font-bold">
                              View File
                            </a>
                          )}
                          <span className={`text-[10px] ${dm ? 'text-gray-500' : 'text-gray-400'}`}>{sub.date}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="flex items-center gap-1.5 text-emerald-500 font-bold text-[10px] uppercase tracking-wider">
                        <FaCheckCircle /> {sub.status}
                      </div>
                      {!aiFeedback[sub.id] && (
                        <button onClick={() => handleAIGrade(sub)} disabled={gradingId === sub.id}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${dm ? 'bg-indigo-900/40 text-indigo-400 hover:bg-indigo-900/60' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}>
                          {gradingId === sub.id ? <><div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /> Analyzing...</> : <><FaMagic className="text-amber-500" /> AI Pre-Grade</>}
                        </button>
                      )}
                      {!authFeedback[sub.id] && (
                        <button onClick={() => handleAuthScan(sub)} disabled={authScanId === sub.id}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${dm ? 'bg-rose-900/40 text-rose-400 hover:bg-rose-900/60' : 'bg-rose-50 text-rose-600 hover:bg-rose-100'}`}>
                          {authScanId === sub.id ? <><div className="w-3 h-3 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" /> Scanning...</> : <><FaSearch className="text-rose-500" /> Auth Scan</>}
                        </button>
                      )}
                      <button onClick={() => deleteSubmission(sub.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-500 transition-colors">
                        <FaTrash size={14} />
                      </button>
                    </div>
                  </div>

                  {/* AI Feedback */}
                  {aiFeedback[sub.id] && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                      className={`mt-4 p-4 rounded-xl border ${dm ? 'bg-gray-800/50 border-indigo-900/50' : 'bg-indigo-50/50 border-indigo-100'}`}>
                      <div className="flex items-center gap-2 mb-2 font-bold text-indigo-600"><FaRobot /> Mini Agent: Indicative Feedback</div>
                      <div className={`text-sm prose prose-sm max-w-none ${dm ? 'prose-invert text-gray-300' : 'text-gray-700'}`}>
                        <ReactMarkdown>{aiFeedback[sub.id]}</ReactMarkdown>
                      </div>
                    </motion.div>
                  )}
                  {aiErrors[sub.id] && (
                    <p role="alert" className="mt-3 text-sm text-red-500">
                      Unable to get AI feedback: {aiErrors[sub.id]}
                    </p>
                  )}

                  {/* Authenticity Report */}
                  {authFeedback[sub.id] && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                      className={`mt-4 p-4 rounded-xl border ${dm ? 'bg-rose-900/10 border-rose-900/30' : 'bg-rose-50/50 border-rose-100'}`}>
                      <div className="flex items-center gap-2 mb-2 font-bold text-rose-600"><FaShieldAlt /> Academic Integrity Guidance</div>
                      <p className={`text-xs mb-3 ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
                        Mini Agent cannot inspect the uploaded file or perform a verified plagiarism scan.
                      </p>
                      <div className={`text-sm prose prose-sm max-w-none ${dm ? 'prose-invert text-gray-300' : 'text-gray-700'}`}>
                        <ReactMarkdown>{authFeedback[sub.id]}</ReactMarkdown>
                      </div>
                    </motion.div>
                  )}
                  {authErrors[sub.id] && (
                    <p role="alert" className="mt-3 text-sm text-red-500">
                      Unable to get guidance: {authErrors[sub.id]}
                    </p>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
