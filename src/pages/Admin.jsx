import { useState, useEffect } from 'react';
import { supabase } from '../util/supabase';
import { useAuth } from '../context/AuthContext';
import { 
  FaCloudUploadAlt, FaYoutube, FaChalkboardTeacher, 
  FaUsers, FaChartBar, FaTachometerAlt, FaBook, FaSignOutAlt,
  FaPlus, FaTrash, FaTimes, FaCheckCircle, FaExclamationCircle, FaFolderOpen, FaLink, FaUserTie
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import BatchLinkManager from '../components/BatchLinkManager';
import CoordinatorManager from '../components/CoordinatorManager';

// --- PROFESSIONAL TOAST NOTIFICATION COMPONENT ---
const Toast = ({ message, type, onClose }) => {
  if (!message) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 animate-fade-in-up">
      <div className={`flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl text-white font-medium ${type === 'success' ? 'bg-gray-900' : 'bg-red-600'}`}>
        {type === 'success' ? <FaCheckCircle className="text-green-400 text-xl"/> : <FaExclamationCircle className="text-white text-xl"/>}
        {message}
        <button onClick={onClose} className="ml-4 text-gray-400 hover:text-white transition"><FaTimes /></button>
      </div>
    </div>
  );
};

export default function Admin() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  // --- GLOBAL STATES ---
  const [toast, setToast] = useState({ message: '', type: '' });
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: '', type: '' }), 4000);
  };

  // --- DATA STATES ---
  const [subjects, setSubjects] = useState([]);
  const [stats, setStats] = useState({ totalSubjects: 0, totalResources: 0, totalVideos: 0, totalQuizzes: 0 });
  const [analyticsData, setAnalyticsData] = useState({
    typeCounts: {},
    branchCounts: {},
    semesterCounts: {},
    studentCount: 0,
    coordinatorCount: 0,
    assignedCount: 0,
    recentMaterials: [],
  });
  const [loading, setLoading] = useState(false);

  // --- LIBRARY MANAGEMENT STATES ---
  const [libraryMaterials, setLibraryMaterials] = useState([]);
  const [libFilterSubject, setLibFilterSubject] = useState('');
  const [libFilterType, setLibFilterType] = useState('');
  const [libSearching, setLibSearching] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  // --- SUBJECT MANAGEMENT STATES ---
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [newSubject, setNewSubject] = useState({ title: '', code: '', description: '', branch: '', semester: '1', degree_id: 'btech' });
  const [confirmDelete, setConfirmDelete] = useState(null); // { id, title }
  const [resourceCounts, setResourceCounts] = useState({}); // { subjectId: count }

  // --- CONTENT UPLOAD STATES ---
  const [formData, setFormData] = useState({ subject_id: '', type: 'note', title: '', url: '' });
  const [file, setFile] = useState(null);

  // --- BULK UPLOAD STATES ---
  const [bulkFiles, setBulkFiles] = useState([]);
  const [bulkSubject, setBulkSubject] = useState('');
  const [bulkType, setBulkType] = useState('note');
  const [bulkUploading, setBulkUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const ALL_TYPES = [
    { id: 'note', label: 'Notes' },
    { id: 'ppt', label: 'PPTs' },
    { id: 'handout', label: 'Course Handout' },
    { id: 'assignment', label: 'Assignment' },
    { id: 'book', label: 'Books' },
    { id: 'experiential', label: 'Experiential' },
    { id: 'participative', label: 'Participative' },
    { id: 'problem_solving', label: 'Problem Solving' },
    { id: 'question_bank', label: 'Question Bank' },
    { id: 'question_papers', label: 'Question Papers' },
    { id: 'lesson_plan', label: 'Lesson Plan' },
    { id: 'extra', label: 'Extras' },
  ];

  function addFilesToQueue(newFiles) {
    const items = Array.from(newFiles).map(f => ({
      file: f,
      id: `${f.name}-${Date.now()}-${Math.random()}`,
      status: 'pending', // pending | uploading | done | error
      error: null,
    }));
    setBulkFiles(prev => [...prev, ...items]);
  }

  function removeFromQueue(id) {
    setBulkFiles(prev => prev.filter(f => f.id !== id));
  }

  async function handleBulkUpload() {
    if (!bulkSubject) { showToast('Please select a subject first', 'error'); return; }
    if (bulkFiles.length === 0) { showToast('Add at least one file', 'error'); return; }
    setBulkUploading(true);

    for (const item of bulkFiles) {
      if (item.status === 'done') continue;
      setBulkFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'uploading' } : f));

      try {
        const ext = item.file.name.split('.').pop();
        const safeName = `${Date.now()}_${item.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const storagePath = `bulk/${bulkType}/${safeName}`;
        const { error: storErr } = await supabase.storage.from('materials').upload(storagePath, item.file);
        if (storErr) throw storErr;
        const { data: urlData } = supabase.storage.from('materials').getPublicUrl(storagePath);
        const title = item.file.name.replace(`.${ext}`, '');
        const { error: dbErr } = await supabase.from('resources').insert([{
          subject_id: bulkSubject, title, type: bulkType, url: urlData.publicUrl,
        }]);
        if (dbErr) throw dbErr;
        setBulkFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'done' } : f));
      } catch (err) {
        setBulkFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'error', error: err.message } : f));
      }
    }
    setBulkUploading(false);
    fetchAdminData();
    showToast('Bulk upload complete!');
  }

  // Fetch Initial Data
  useEffect(() => {
    fetchAdminData();
  }, [activeTab]);

  async function fetchAdminData() {
    const { data: subData } = await supabase.from('subjects').select('*').order('created_at', { ascending: false });
    setSubjects(subData || []);

    // Resource counts per subject
    if (subData?.length) {
      const { data: resCounts } = await supabase
        .from('resources')
        .select('subject_id');
      const counts = {};
      (resCounts || []).forEach(r => { counts[r.subject_id] = (counts[r.subject_id] || 0) + 1; });
      setResourceCounts(counts);
    }

    const [
      { count: resCount },
      { count: vidCount },
      { count: qzCount },
      { count: studCount },
      { count: coordCount },
      { data: allResTypes },
      { data: coordSubs },
      { data: recentRes },
    ] = await Promise.all([
      supabase.from('resources').select('*', { count: 'exact', head: true }),
      supabase.from('videos').select('*', { count: 'exact', head: true }),
      supabase.from('quizzes').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('user_roles').select('user_id', { count: 'exact', head: true }).eq('role', 'coordinator'),
      supabase.from('resources').select('type'),
      supabase.from('coordinator_subjects').select('subject_id'),
      supabase.from('resources').select('id, title, type, created_at, subjects(title, branch)').order('created_at', { ascending: false }).limit(6),
    ]);

    setStats({
      totalSubjects: subData?.length || 0,
      totalResources: resCount || 0,
      totalVideos: vidCount || 0,
      totalQuizzes: qzCount || 0,
    });

    const typeCounts = {};
    (allResTypes || []).forEach(r => {
      typeCounts[r.type] = (typeCounts[r.type] || 0) + 1;
    });

    const branchCounts = {};
    const semesterCounts = {};
    (subData || []).forEach(s => {
      const b = (s.branch || 'OTHER').toUpperCase();
      branchCounts[b] = (branchCounts[b] || 0) + 1;
      const sem = s.semester ? `Sem ${s.semester}` : 'Unassigned';
      semesterCounts[sem] = (semesterCounts[sem] || 0) + 1;
    });

    setAnalyticsData({
      typeCounts,
      branchCounts,
      semesterCounts,
      studentCount: studCount || 0,
      coordinatorCount: coordCount || 0,
      assignedCount: new Set((coordSubs || []).map(cs => cs.subject_id)).size,
      recentMaterials: recentRes || [],
    });

    if (activeTab === 'library') {
      fetchLibraryData();
    }
  }

  async function fetchLibraryData() {
    setLibSearching(true);
    let query = supabase.from('resources').select('*, subjects(title, branch, semester)');
    
    if (libFilterSubject) query = query.eq('subject_id', libFilterSubject);
    if (libFilterType) query = query.eq('type', libFilterType);
    
    const { data, error } = await query.order('created_at', { ascending: false });
    if (!error) setLibraryMaterials(data || []);
    setLibSearching(false);
  }

  useEffect(() => {
    if (activeTab === 'library') fetchLibraryData();
  }, [libFilterSubject, libFilterType]);

  async function handleDeleteMaterial(id, title) {
    if (!window.confirm(`Delete "${title}"?`)) return;
    setLoading(true);
    const { error } = await supabase.from('resources').delete().eq('id', id);
    setLoading(false);
    if (error) showToast(error.message, 'error');
    else {
      showToast('Material removed');
      fetchLibraryData();
      fetchAdminData();
    }
  }

  async function handleBatchDelete() {
    if (!window.confirm(`Delete ${selectedIds.length} selected items?`)) return;
    setLoading(true);
    const { error } = await supabase.from('resources').delete().in('id', selectedIds);
    setLoading(false);
    if (error) showToast(error.message, 'error');
    else {
      showToast(`${selectedIds.length} materials removed`);
      setSelectedIds([]);
      fetchLibraryData();
      fetchAdminData();
    }
  }

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === libraryMaterials.length) setSelectedIds([]);
    else setSelectedIds(libraryMaterials.map(m => m.id));
  };

  // --- ACTION: ADD NEW SUBJECT ---
  async function handleAddSubject(e) {
    e.preventDefault();
    if (!newSubject.branch) { showToast('Please select a branch', 'error'); return; }
    setLoading(true);
    const payload = {
      title: newSubject.title.trim(),
      code: newSubject.code.trim().toUpperCase(),
      description: newSubject.description.trim(),
      branch: newSubject.branch.trim(),
      semester: parseInt(newSubject.semester),
      degree_id: newSubject.degree_id,
    };
    const { error } = await supabase.from('subjects').insert([payload]);
    setLoading(false);
    if (error) { showToast(error.message, 'error'); }
    else {
      showToast('Subject added successfully!');
      setShowSubjectModal(false);
      setNewSubject({ title: '', code: '', description: '', branch: '', semester: '1' });
      fetchAdminData();
    }
  }

  // --- ACTION: DELETE SUBJECT (cascade resources first) ---
  async function handleDeleteSubject(id) {
    setLoading(true);
    // Delete resources, videos, quizzes linked to this subject first
    await supabase.from('resources').delete().eq('subject_id', id);
    await supabase.from('videos').delete().eq('subject_id', id);
    await supabase.from('quizzes').delete().eq('subject_id', id);
    const { error } = await supabase.from('subjects').delete().eq('id', id);
    setLoading(false);
    setConfirmDelete(null);
    if (error) showToast('Error deleting subject: ' + error.message, 'error');
    else { showToast('Subject and all its materials deleted.'); fetchAdminData(); }
  }

  // --- EXISTING UPLOAD LOGIC ---
  async function handleUploadSubmit(e) {
    e.preventDefault();
    setLoading(true);
    let finalUrl = formData.url;

    if (file && ['note', 'ppt', 'extra'].includes(formData.type)) {
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${formData.type}s/${fileName}`;
        
        const { error: uploadError } = await supabase.storage.from('materials').upload(filePath, file);
        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('materials').getPublicUrl(filePath);
        finalUrl = data.publicUrl;
      } catch (err) {
        showToast('Upload Failed: ' + err.message, 'error');
        setLoading(false);
        return;
      }
    }

    let table = 'resources';
    let payload = { subject_id: formData.subject_id, title: formData.title };

    if (formData.type === 'video') { 
      table = 'videos'; 
      payload.video_id = file ? finalUrl : formData.url; 
    } 
    else if (formData.type === 'quiz') { 
      table = 'quizzes'; 
      payload.link = file ? finalUrl : formData.url; 
    } 
    else { 
      payload.type = formData.type; 
      payload.url = finalUrl; 
    }
    
    const { error } = await supabase.from(table).insert([payload]);

    if (error) {
      showToast('Error: ' + error.message, 'error');
    } else {
      showToast('Material uploaded successfully!');
      setFormData({ ...formData, title: '', url: '' });
      setFile(null);
    }
    setLoading(false);
  }

  // --- RENDER HELPERS ---
  const menuItems = [
    { id: 'dashboard',    label: 'Overview',          icon: <FaTachometerAlt /> },
    { id: 'subjects',     label: 'Subjects & Depts',  icon: <FaFolderOpen /> },
    { id: 'coordinators', label: 'Coordinators',      icon: <FaUserTie /> },
    { id: 'library',      label: 'Manage Library',    icon: <FaBook /> },
    { id: 'batchlinks',   label: 'Batch Links',       icon: <FaLink /> },
    { id: 'content',      label: 'Upload Materials',  icon: <FaCloudUploadAlt /> },
    { id: 'students',     label: 'Students',           icon: <FaUsers /> },
    { id: 'analytics',    label: 'Analytics',          icon: <FaChartBar /> },
  ];

  const adminEmail = user?.email || 'admin@campuslearn.com';
  const adminInitial = adminEmail.charAt(0).toUpperCase();

  return (
    <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: '' })} />

      {/* SIDEBAR */}
      <div className="w-64 bg-gradient-to-b from-gray-950 to-gray-900 text-white flex flex-col shadow-2xl z-20 flex-shrink-0">
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-extrabold text-white text-base shadow-lg shadow-blue-500/20">
              CA
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">
                Campus<span className="text-blue-400">Admin</span>
              </h1>
              <p className="text-gray-400 text-[10px] uppercase font-bold tracking-wider mt-0.5">Workspace Portal</p>
            </div>
          </div>
        </div>
        
        <div className="flex-1 py-5 px-3 space-y-1 overflow-y-auto">
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium transition-all text-sm ${
                activeTab === item.id 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-bold' 
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className={`text-base ${activeTab === item.id ? 'text-white' : 'text-gray-400'}`}>{item.icon}</span>
              <span>{item.label}</span>
              {activeTab === item.id && (
                <span className="ml-auto w-1.5 h-4 rounded-full bg-white/60" />
              )}
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-white/5 space-y-2">
          {user && (
            <div className="flex items-center gap-2.5 px-2 py-1.5 mb-1 bg-white/5 rounded-xl">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-xs text-white">
                {adminInitial}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-200 truncate">{adminEmail}</p>
                <p className="text-[10px] text-gray-500">Super Administrator</p>
              </div>
            </div>
          )}
          <button
            onClick={() => navigate('/')}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white/5 text-gray-300 rounded-xl hover:bg-white/10 hover:text-white transition-all text-xs font-semibold"
          >
            ← Back to CampusLearn
          </button>
          <button
            onClick={async () => { await signOut(); navigate('/login'); }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white/5 text-gray-300 rounded-xl hover:bg-red-500/20 hover:text-red-400 transition-all text-xs font-semibold"
          >
            <FaSignOutAlt /> Sign Out
          </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 overflow-y-auto p-8 lg:p-12 relative bg-gray-50">
        
        {/* TOP HEADER */}
        <div className="flex justify-between items-center mb-8 border-b border-gray-200 pb-4">
          <div>
            <h2 className="text-3xl font-extrabold text-gray-900 capitalize">
              {activeTab === 'dashboard' ? 'Platform Overview'
                : activeTab === 'batchlinks' ? 'Batch Enrollment Links'
                : activeTab.replace('-', ' ')}
            </h2>
            <p className="text-xs text-gray-400 mt-1">Management and administrative controls</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 border-2 border-white shadow-md flex items-center justify-center font-extrabold text-white">
              {adminInitial}
            </div>
          </div>
        </div>

        {/* TAB: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="animate-fade-in-up">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
              {[
                { label: 'Total Subjects', value: stats.totalSubjects, icon: <FaBook />, color: 'bg-blue-50 text-blue-600' },
                { label: 'Study Materials', value: stats.totalResources, icon: <FaCloudUploadAlt />, color: 'bg-green-50 text-green-600' },
                { label: 'Video Lectures', value: stats.totalVideos, icon: <FaChartBar />, color: 'bg-red-50 text-red-600' },
                { label: 'Quizzes', value: stats.totalQuizzes, icon: <FaUsers />, color: 'bg-purple-50 text-purple-600' },
              ].map((card, i) => (
                <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl ${card.color}`}>{card.icon}</div>
                  <div>
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-wide">{card.label}</p>
                    <h3 className="text-3xl font-extrabold text-gray-900">{card.value}</h3>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-4">Recent Subjects</h3>
              {subjects.slice(0, 5).map(s => (
                <div key={s.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-bold text-lg">
                      {s.title.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">{s.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 uppercase">{s.code || 'NO CODE'}</span>
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded uppercase ${s.degree_id === 'mtech' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                          {s.degree_id || 'B.Tech'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1 rounded-full">{s.branch}</span>
                </div>
              ))}
              {subjects.length === 0 && <p className="text-gray-400 text-sm">No subjects yet.</p>}
            </div>
          </div>
        )}

        {/* TAB: SUBJECTS */}
        {activeTab === 'subjects' && (
          <div className="animate-fade-in-up">
            <div className="flex justify-between items-center mb-6">
              <p className="text-gray-500 text-sm">Manage all courses. Deleting a subject removes <strong>all its materials</strong>.</p>
              <button onClick={() => setShowSubjectModal(true)}
                className="bg-gray-900 text-white px-5 py-2.5 rounded-xl font-bold shadow-md hover:bg-gray-800 transition flex items-center gap-2">
                <FaPlus /> Add Subject
              </button>
            </div>

            {/* Table */}
            <div className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-bold border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4">Subject</th>
                    <th className="px-6 py-4">Branch</th>
                    <th className="px-6 py-4">Sem</th>
                    <th className="px-6 py-4">Materials</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {subjects.length === 0 ? (
                    <tr><td colSpan="5" className="text-center py-10 text-gray-400">No subjects found. Add one above.</td></tr>
                  ) : subjects.map(sub => (
                    <tr key={sub.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-bold text-lg">
                            {sub.title.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900">{sub.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 uppercase">{sub.code || 'NO CODE'}</span>
                              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded uppercase ${sub.degree_id === 'mtech' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                {sub.degree_id || 'B.Tech'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-blue-50 text-blue-700 border border-blue-100 px-3 py-1 rounded-full text-xs font-bold">{sub.branch}</span>
                      </td>
                      <td className="px-6 py-4 text-gray-600 font-medium text-sm">Sem {sub.semester}</td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-gray-700">{resourceCounts[sub.id] || 0}</span>
                        <span className="text-xs text-gray-400 ml-1">files</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => setConfirmDelete({ id: sub.id, title: sub.title })}
                          className="text-gray-400 hover:text-red-600 transition p-2 rounded-lg hover:bg-red-50">
                          <FaTrash />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── CONFIRM DELETE MODAL ── */}
            {confirmDelete && (
              <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-8 text-center">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FaTrash className="text-red-500 text-2xl" />
                  </div>
                  <h3 className="text-xl font-extrabold text-gray-900 mb-2">Delete Subject?</h3>
                  <p className="text-gray-500 mb-1">You are about to delete:</p>
                  <p className="font-bold text-gray-800 mb-1">"{confirmDelete.title}"</p>
                  <p className="text-sm text-red-500 mb-6">This will permanently delete the subject and <strong>all {resourceCounts[confirmDelete.id] || 0} materials</strong> linked to it.</p>
                  <div className="flex gap-3">
                    <button onClick={() => setConfirmDelete(null)}
                      className="flex-1 py-3 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition">Cancel</button>
                    <button onClick={() => handleDeleteSubject(confirmDelete.id)} disabled={loading}
                      className="flex-1 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition flex items-center justify-center gap-2">
                      {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <FaTrash />}
                      {loading ? 'Deleting…' : 'Yes, Delete'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── ADD SUBJECT MODAL ── */}
            {showSubjectModal && (
              <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="text-xl font-bold text-gray-800">Add New Subject</h3>
                    <button onClick={() => setShowSubjectModal(false)} className="text-gray-400 hover:text-gray-700"><FaTimes className="text-xl"/></button>
                  </div>
                  <form onSubmit={handleAddSubject} className="p-6 space-y-4">

                    {/* Title */}
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Subject Title <span className="text-red-500">*</span></label>
                      <input type="text" required placeholder="e.g. Data Structures & Algorithms"
                        className="w-full p-3 bg-gray-50 border border-gray-300 text-gray-900 shadow-sm focus:border-gray-900 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none"
                        value={newSubject.title} onChange={e => setNewSubject({...newSubject, title: e.target.value})} />
                    </div>

                    {/* Code + Semester */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Subject Code</label>
                        <input type="text" placeholder="e.g. CS301"
                          className="w-full p-3 bg-gray-50 border border-gray-300 text-gray-900 shadow-sm focus:border-gray-900 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none uppercase"
                          value={newSubject.code} onChange={e => setNewSubject({...newSubject, code: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Degree</label>
                        <select value={newSubject.degree_id} onChange={e => setNewSubject({...newSubject, degree_id: e.target.value})}
                          className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none">
                          <option value="btech">B.Tech</option>
                          <option value="mtech">M.Tech</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Semester <span className="text-red-500">*</span></label>
                        <select required className="w-full p-3 bg-gray-50 border border-gray-300 text-gray-900 shadow-sm focus:border-gray-900 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none"
                          value={newSubject.semester} onChange={e => setNewSubject({...newSubject, semester: e.target.value})}>
                          {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>Semester {n}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Branch */}
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Branch / Department <span className="text-red-500">*</span></label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {['CS','IT','ENTC','MECH','CIVIL','mtech_cs','mtech_ai'].map(b => (
                          <button type="button" key={b}
                            onClick={() => setNewSubject({...newSubject, branch: b})}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                              newSubject.branch === b ? 'bg-gray-900 text-white border-gray-900' : 'bg-gray-50 text-gray-600 border-gray-300 text-gray-900 shadow-sm focus:border-gray-900 hover:border-gray-400'
                            }`}>{b}</button>
                        ))}
                      </div>
                      <input type="text" placeholder="Or type a custom branch…"
                        className="w-full p-3 bg-gray-50 border border-gray-300 text-gray-900 shadow-sm focus:border-gray-900 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none"
                        value={newSubject.branch} onChange={e => setNewSubject({...newSubject, branch: e.target.value})} />
                    </div>

                    {/* Description (optional) */}
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Short Description <span className="text-gray-400 font-normal">(optional)</span></label>
                      <textarea rows="2" placeholder="Briefly describe what this course covers…"
                        className="w-full p-3 bg-gray-50 border border-gray-300 text-gray-900 shadow-sm focus:border-gray-900 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none resize-none"
                        value={newSubject.description} onChange={e => setNewSubject({...newSubject, description: e.target.value})} />
                    </div>

                    <div className="pt-2 flex gap-3">
                      <button type="button" onClick={() => setShowSubjectModal(false)}
                        className="flex-1 py-3 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition">Cancel</button>
                      <button type="submit" disabled={loading}
                        className="flex-1 py-3 rounded-xl font-bold text-white bg-gray-900 hover:bg-black transition flex justify-center items-center gap-2">
                        {loading ? <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> : <FaPlus />}
                        {loading ? 'Saving…' : 'Add Subject'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}



        {/* TAB: COORDINATORS */}
        {activeTab === 'coordinators' && (
          <CoordinatorManager subjects={subjects} showToast={showToast} />
        )}

        {/* TAB: BATCH LINKS */}
        {activeTab === 'batchlinks' && (
          <BatchLinkManager showToast={showToast} />
        )}

        {/* TAB: CONTENT MANAGER */}
        {activeTab === 'content' && (
          <div className="animate-fade-in-up space-y-8">

            {/* ── BULK UPLOADER ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-300 text-gray-900 shadow-sm focus:border-gray-900 overflow-hidden">
              <div className="px-8 py-5 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-white flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-lg"><FaCloudUploadAlt /></div>
                <div>
                  <h3 className="font-extrabold text-gray-900 text-lg">Bulk Upload</h3>
                  <p className="text-xs text-gray-500">Drop many files at once — they all go to the same subject & tab</p>
                </div>
              </div>
              <div className="p-8 space-y-6">
                {/* Subject + Type selectors */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Subject</label>
                    <select value={bulkSubject} onChange={e => setBulkSubject(e.target.value)}
                      className="w-full p-3 bg-gray-50 border border-gray-300 text-gray-900 shadow-sm focus:border-gray-900 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                      <option value="">Choose subject…</option>
                      {subjects.map(s => <option key={s.id} value={s.id}>{s.title} ({s.branch} Sem {s.semester})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Tab / Type</label>
                    <select value={bulkType} onChange={e => setBulkType(e.target.value)}
                      className="w-full p-3 bg-gray-50 border border-gray-300 text-gray-900 shadow-sm focus:border-gray-900 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                      {ALL_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                  </div>
                </div>

                {/* Drag & Drop Zone */}
                <div
                  onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={e => { e.preventDefault(); setIsDragging(false); addFilesToQueue(e.dataTransfer.files); }}
                  className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer ${
                    isDragging ? 'border-indigo-500 bg-indigo-50 scale-[1.01]' : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
                  }`}
                >
                  <input type="file" multiple className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    onChange={e => addFilesToQueue(e.target.files)} />
                  <FaCloudUploadAlt className={`text-5xl mx-auto mb-3 transition-colors ${ isDragging ? 'text-indigo-500' : 'text-gray-300' }`} />
                  <p className="font-bold text-gray-600">Drag & drop files here, or click to browse</p>
                  <p className="text-xs text-gray-400 mt-1">PDF, DOCX, PPTX — any number of files</p>
                </div>

                {/* File Queue */}
                {bulkFiles.length > 0 && (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {bulkFiles.map(item => (
                      <div key={item.id} className={`flex items-center gap-3 p-3 rounded-xl border text-sm transition-all ${
                        item.status === 'done' ? 'bg-green-50 border-green-200' :
                        item.status === 'error' ? 'bg-red-50 border-red-200' :
                        item.status === 'uploading' ? 'bg-indigo-50 border-indigo-200' :
                        'bg-gray-50 border-gray-300 text-gray-900 shadow-sm focus:border-gray-900'
                      }`}>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 truncate">{item.file.name}</p>
                          {item.error && <p className="text-xs text-red-500 mt-0.5">{item.error}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {item.status === 'pending' && <span className="text-xs text-gray-400 font-medium">Pending</span>}
                          {item.status === 'uploading' && <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />}
                          {item.status === 'done' && <span className="text-green-600 font-bold text-xs">✓ Done</span>}
                          {item.status === 'error' && <span className="text-red-500 font-bold text-xs">✗ Failed</span>}
                          {item.status !== 'uploading' && item.status !== 'done' && (
                            <button onClick={() => removeFromQueue(item.id)} className="text-gray-400 hover:text-red-500 transition"><FaTimes /></button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Action Row */}
                <div className="flex items-center justify-between pt-2">
                  {bulkFiles.length > 0 && (
                    <button onClick={() => setBulkFiles([])} disabled={bulkUploading}
                      className="text-sm text-gray-400 hover:text-red-500 transition font-medium">
                      Clear all ({bulkFiles.length})
                    </button>
                  )}
                  <button onClick={handleBulkUpload} disabled={bulkUploading || bulkFiles.length === 0}
                    className="ml-auto flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-bold px-8 py-3 rounded-xl transition shadow-lg shadow-indigo-200">
                    {bulkUploading
                      ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Uploading…</>
                      : <><FaCloudUploadAlt /> Upload {bulkFiles.length > 0 ? `${bulkFiles.length} File${bulkFiles.length > 1 ? 's' : ''}` : 'Files'}</>}
                  </button>
                </div>
              </div>
            </div>

            {/* ── SINGLE FILE UPLOAD (collapsible) ── */}
            <details className="bg-white rounded-2xl shadow-sm border border-gray-300 text-gray-900 shadow-sm focus:border-gray-900 overflow-hidden group">
              <summary className="px-8 py-5 font-bold text-gray-700 cursor-pointer flex items-center gap-2 hover:bg-gray-50 list-none">
                <span className="text-gray-400 group-open:rotate-90 transition-transform inline-block">▶</span>
                Single File / URL Upload
              </summary>
              <div className="px-8 pb-8">
                <form onSubmit={handleUploadSubmit} className="space-y-5 pt-4">
                  <div>
                    <label className="block text-sm font-bold mb-1 text-gray-700">Select Subject</label>
                    <select className="w-full p-3 bg-gray-50 border border-gray-300 text-gray-900 shadow-sm focus:border-gray-900 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none" onChange={e => setFormData({...formData, subject_id: e.target.value})} value={formData.subject_id} required>
                      <option value="">Choose a subject...</option>
                      {subjects.map(s => (<option key={s.id} value={s.id}>{s.title} ({s.branch} - Sem {s.semester})</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1 text-gray-700">Content Type / Tab</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                      {[
                        ...ALL_TYPES,
                        { id: 'video', label: 'Video' },
                        { id: 'quiz', label: 'Quiz' }
                      ].map(type => (
                        <button type="button" key={type.id} onClick={() => setFormData({...formData, type: type.id})}
                          className={`p-2 rounded-lg text-[10px] font-bold capitalize transition border ${ formData.type === type.id ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-300 text-gray-900 shadow-sm focus:border-gray-900 hover:bg-gray-50' }`}>
                          {type.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1 text-gray-700">Material Title</label>
                    <input type="text" className="w-full p-3 bg-gray-50 border border-gray-300 text-gray-900 shadow-sm focus:border-gray-900 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none" placeholder="e.g. Unit 1: Introduction" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1 text-gray-700">
                      {formData.type === 'video' ? 'YouTube Video ID' : formData.type === 'quiz' ? 'Google Form Link' : 'File or URL'}
                    </label>
                    {!['video','quiz'].includes(formData.type) ? (
                      <div className="space-y-3">
                        <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:bg-gray-50 transition cursor-pointer relative">
                          <input type="file" onChange={e => setFile(e.target.files[0])} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"/>
                          <FaCloudUploadAlt className="text-2xl text-gray-400 mx-auto mb-1" />
                          <span className="text-sm text-gray-500">{file ? file.name : 'Click to pick a file'}</span>
                        </div>
                        <input type="text" className="w-full p-3 bg-gray-50 border border-gray-300 text-gray-900 shadow-sm focus:border-gray-900 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none" placeholder="Or paste a URL" value={formData.url} onChange={e => setFormData({...formData, url: e.target.value})} />
                      </div>
                    ) : (
                      <input type="text" className="w-full p-3 bg-gray-50 border border-gray-300 text-gray-900 shadow-sm focus:border-gray-900 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none" placeholder={formData.type === 'video' ? 'YouTube video ID' : 'Google Form URL'} value={formData.url} onChange={e => setFormData({...formData, url: e.target.value})} required />
                    )}
                  </div>
                  <button disabled={loading} className="w-full bg-gray-900 text-white font-bold py-3.5 rounded-xl hover:bg-black transition flex justify-center items-center gap-2">
                    {loading && <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />}
                    {loading ? 'Uploading…' : 'Upload Material'}
                  </button>
                </form>
              </div>
            </details>
          </div>
        )}

        {/* TAB: LIBRARY MANAGER */}
        {activeTab === 'library' && (
          <div className="animate-fade-in-up space-y-6 relative pb-20">
            <div className="bg-white p-6 rounded-2xl border border-gray-300 text-gray-900 shadow-sm focus:border-gray-900 shadow-sm flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Filter by Subject</label>
                <select value={libFilterSubject} onChange={e => setLibFilterSubject(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-300 text-gray-900 shadow-sm focus:border-gray-900 rounded-xl text-sm focus:ring-2 focus:ring-gray-900 outline-none">
                  <option value="">All Subjects</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.title} ({s.branch})</option>)}
                </select>
              </div>
              <div className="w-full md:w-64">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Filter by Tab</label>
                <select value={libFilterType} onChange={e => setLibFilterType(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-300 text-gray-900 shadow-sm focus:border-gray-900 rounded-xl text-sm focus:ring-2 focus:ring-gray-900 outline-none">
                  <option value="">All Tabs</option>
                  {ALL_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={fetchLibraryData} className="bg-gray-100 text-gray-700 px-6 py-3 rounded-xl font-bold hover:bg-gray-200 transition flex items-center gap-2">
                  Refresh
                </button>
              </div>
            </div>

            <div className="bg-white border border-gray-300 text-gray-900 shadow-sm focus:border-gray-900 shadow-sm rounded-2xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-bold border-b border-gray-300 text-gray-900 shadow-sm focus:border-gray-900">
                  <tr>
                    <th className="px-6 py-4 w-12 text-center">
                      <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        checked={libraryMaterials.length > 0 && selectedIds.length === libraryMaterials.length}
                        onChange={toggleSelectAll} />
                    </th>
                    <th className="px-6 py-4">Title</th>
                    <th className="px-6 py-4">Subject</th>
                    <th className="px-6 py-4">Tab</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {libSearching ? (
                    <tr><td colSpan="5" className="py-10 text-center"><div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto" /></td></tr>
                  ) : libraryMaterials.length === 0 ? (
                    <tr><td colSpan="5" className="py-10 text-center text-gray-400">No materials found matching filters.</td></tr>
                  ) : libraryMaterials.map(m => (
                    <tr key={m.id} className={`hover:bg-gray-50 transition ${selectedIds.includes(m.id) ? 'bg-indigo-50/50' : ''}`}>
                      <td className="px-6 py-4 text-center">
                        <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          checked={selectedIds.includes(m.id)}
                          onChange={() => toggleSelect(m.id)} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gray-100 rounded-lg text-gray-400"><FaBook className="text-sm"/></div>
                          <div>
                            <p className="font-bold text-gray-900 truncate max-w-[250px]">{m.title}</p>
                            <a href={m.url} target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline">View File</a>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-gray-700">{m.subjects?.title}</p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">{m.subjects?.branch} • Sem {m.subjects?.semester}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase">
                          {ALL_TYPES.find(t => t.id === m.type)?.label || m.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => handleDeleteMaterial(m.id, m.title)} className="text-gray-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition">
                          <FaTrash />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Sticky Batch Action Bar */}
            {selectedIds.length > 0 && (
              <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 animate-fade-in-up">
                <div className="bg-gray-900 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-8 border border-gray-800">
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Selected</span>
                    <span className="text-lg font-black text-indigo-400">{selectedIds.length} <span className="text-white">Items</span></span>
                  </div>
                  <div className="h-10 w-px bg-gray-800" />
                  <div className="flex gap-3">
                    <button onClick={() => setSelectedIds([])} className="px-4 py-2 text-sm font-bold text-gray-400 hover:text-white transition">Deselect All</button>
                    <button onClick={handleBatchDelete} disabled={loading}
                      className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition shadow-lg shadow-red-900/40">
                      {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <FaTrash />}
                      {loading ? 'Deleting...' : 'Delete Selected'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {/* TAB: ANALYTICS */}
        {activeTab === 'analytics' && (
          <div className="animate-fade-in-up space-y-8">
            {/* Top Primary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {[
                { label: 'Total Subjects', value: stats.totalSubjects, emoji: '📚', color: 'from-blue-500 to-indigo-600', sub: 'Across all degrees' },
                { label: 'Study Materials', value: stats.totalResources, emoji: '📄', color: 'from-emerald-500 to-teal-600', sub: 'Files, notes & docs' },
                { label: 'Video Lectures', value: stats.totalVideos, emoji: '🎬', color: 'from-red-500 to-rose-600', sub: 'Linked lectures' },
                { label: 'Interactive Quizzes', value: stats.totalQuizzes, emoji: '🧠', color: 'from-purple-500 to-violet-600', sub: 'Practice assessments' },
              ].map((item, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition">
                  <div className={`h-1.5 bg-gradient-to-r ${item.color}`} />
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl">{item.emoji}</span>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{item.sub}</span>
                    </div>
                    <div className="text-3xl font-extrabold text-gray-900 mb-0.5">{item.value}</div>
                    <div className="text-xs font-bold text-gray-500 uppercase">{item.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* User & Coordinator Coverage Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-2xl font-bold">
                  👥
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Registered Students</p>
                  <p className="text-3xl font-extrabold text-gray-900">{analyticsData.studentCount}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Active users across branches</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center text-2xl font-bold">
                  🧑‍🏫
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Faculty Coordinators</p>
                  <p className="text-3xl font-extrabold text-gray-900">{analyticsData.coordinatorCount}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Subject coordinators appointed</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl font-bold">
                  🛡️
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Coordinator Coverage</p>
                  <p className="text-3xl font-extrabold text-gray-900">
                    {stats.totalSubjects > 0 ? Math.round((analyticsData.assignedCount / stats.totalSubjects) * 100) : 0}%
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {analyticsData.assignedCount} of {stats.totalSubjects} subjects covered
                  </p>
                </div>
              </div>
            </div>

            {/* Grid 2: Resource Types & Branch Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Materials by Content Type */}
              <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                <div className="flex justify-between items-center mb-5">
                  <h3 className="font-extrabold text-gray-900">Materials by Category</h3>
                  <span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-bold">
                    {stats.totalResources} total
                  </span>
                </div>
                <div className="space-y-3">
                  {ALL_TYPES.map(t => {
                    const count = analyticsData.typeCounts[t.id] || 0;
                    const pct = stats.totalResources > 0 ? Math.round((count / stats.totalResources) * 100) : 0;
                    return (
                      <div key={t.id} className="space-y-1">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-gray-600">{t.label}</span>
                          <span className="text-gray-900">{count} <span className="text-gray-400 font-normal">({pct}%)</span></span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Branch & Semester Distribution */}
              <div className="space-y-6">
                {/* Branch Breakdown */}
                <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                  <h3 className="font-extrabold text-gray-900 mb-4">Subjects by Department / Branch</h3>
                  <div className="space-y-3">
                    {Object.keys(analyticsData.branchCounts).length === 0 ? (
                      <p className="text-xs text-gray-400">No subjects added yet.</p>
                    ) : (
                      Object.entries(analyticsData.branchCounts).map(([branch, count]) => {
                        const pct = stats.totalSubjects > 0 ? Math.round((count / stats.totalSubjects) * 100) : 0;
                        return (
                          <div key={branch} className="space-y-1">
                            <div className="flex justify-between text-xs font-bold">
                              <span className="text-gray-600 uppercase">{branch}</span>
                              <span className="text-gray-900">{count} courses <span className="text-gray-400 font-normal">({pct}%)</span></span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Semester Breakdown */}
                <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                  <h3 className="font-extrabold text-gray-900 mb-4">Subjects by Semester</h3>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 text-center">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => {
                      const count = analyticsData.semesterCounts[`Sem ${sem}`] || 0;
                      return (
                        <div key={sem} className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                          <p className="text-[10px] font-bold text-gray-400 uppercase">Sem {sem}</p>
                          <p className="text-lg font-black text-indigo-600 mt-0.5">{count}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Uploads Activity */}
            {analyticsData.recentMaterials.length > 0 && (
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-50 flex justify-between items-center">
                  <h3 className="font-extrabold text-gray-900">Recently Added Materials</h3>
                  <button onClick={() => setActiveTab('library')} className="text-xs font-bold text-blue-600 hover:text-blue-800">
                    Open Library →
                  </button>
                </div>
                <div className="divide-y divide-gray-50">
                  {analyticsData.recentMaterials.map(m => (
                    <div key={m.id} className="px-6 py-3.5 flex items-center justify-between hover:bg-gray-50/50 transition">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold uppercase">
                          {m.type?.slice(0, 3)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-800">{m.title}</p>
                          <p className="text-[10px] text-gray-400">
                            {m.subjects?.title} ({m.subjects?.branch}) • {new Date(m.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold uppercase bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">
                        {m.type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: STUDENTS */}
        {activeTab === 'students' && (
          <div className="animate-fade-in-up">
            <div className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm text-center">
              <div className="text-5xl mb-4">👥</div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Student Management</h3>
              <p className="text-gray-500 max-w-md mx-auto mb-6">
                Students who sign up via Supabase Auth are automatically registered. 
                Use the Supabase Dashboard → Authentication → Users to view and manage all users.
              </p>
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-black transition"
              >
                Open Supabase Dashboard ↗
              </a>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}