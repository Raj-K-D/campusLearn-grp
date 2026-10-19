import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../util/supabase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  FaCheckCircle, FaFolderOpen, FaSignOutAlt, FaTimesCircle,
  FaCalendarAlt, FaComments, FaPlus, FaTrash, FaCloudUploadAlt,
  FaUsers, FaEdit, FaTachometerAlt, FaUserGraduate, FaInbox,
  FaBook, FaTimes, FaClock, FaExclamationCircle, FaEye, FaMoon, FaSun,
  FaChevronRight, FaChevronDown, FaChevronUp, FaExternalLinkAlt
} from 'react-icons/fa';
import { resolveResourceUrl } from '../util/resourceUrls';
import { MAX_UPLOAD_SIZE_BYTES, safeStorageFileName, validateUploadFile } from '../util/uploadValidation';

// ── Toast ─────────────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 animate-fade-in-up">
      <div className={`flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl text-white font-medium ${type === 'success' ? 'bg-gray-900' : 'bg-red-600'}`}>
        {type === 'success'
          ? <FaCheckCircle className="text-green-400 text-xl" />
          : <FaExclamationCircle className="text-white text-xl" />}
        {message}
        <button onClick={onClose} className="ml-4 text-gray-400 hover:text-white"><FaTimes /></button>
      </div>
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────
function StatCard({ icon, label, value, color, gradient = 'from-indigo-500 to-blue-600' }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition">
      <div className={`h-1.5 bg-gradient-to-r ${gradient}`} />
      <div className="p-5 flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${color}`}>{icon}</div>
        <div>
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wide">{label}</p>
          <h3 className="text-3xl font-extrabold text-gray-900 mt-0.5">{value}</h3>
        </div>
      </div>
    </div>
  );
}

// ── Upload Modal ───────────────────────────────────────────────
const ALL_TYPES = [
  { id: 'note', label: 'Notes' }, { id: 'ppt', label: 'PPTs' },
  { id: 'assignment', label: 'Assignment' }, { id: 'book', label: 'Books' },
  { id: 'handout', label: 'Handout' }, { id: 'question_bank', label: 'Question Bank' },
  { id: 'question_papers', label: 'Question Papers' }, { id: 'extra', label: 'Extras' },
  { id: 'experiential', label: 'Experiential' }, { id: 'participative', label: 'Participative' },
  { id: 'problem_solving', label: 'Problem Solving' }, { id: 'lesson_plan', label: 'Lesson Plan' },
  { id: 'ta_paper_1', label: 'TA1 Paper' }, { id: 'ta_paper_2', label: 'TA2 Paper' },
];

const VISIBILITY_OPTIONS = [
  { id: 'SUBJECT_WIDE', label: 'All Divisions', desc: 'Every student enrolled in this subject' },
  { id: 'DIVISION_ONLY', label: 'Specific Division', desc: 'Only students in a specific class' },
  { id: 'DRAFT', label: 'Draft (hidden)', desc: 'Only visible to you' },
];

function UploadModal({ open, onClose, subjects, showToast, onUploaded, defaultSubjectId = '' }) {
  const { user } = useAuth();
  const [form, setForm] = useState({ subject_id: defaultSubjectId || '', type: 'note', title: '', url: '', visibility: 'SUBJECT_WIDE' });
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(f => ({ ...f, subject_id: defaultSubjectId || f.subject_id || '' }));
    }
  }, [open, defaultSubjectId]);

  if (!open) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.subject_id) { showToast('Select a subject first', 'error'); return; }
    if (files.length === 0 && !form.url) { showToast('Please select a file or enter a URL', 'error'); return; }
    const invalidFile = files.find(file => validateUploadFile(file, MAX_UPLOAD_SIZE_BYTES));
    if (invalidFile) {
      showToast(`${invalidFile.name}: ${validateUploadFile(invalidFile, MAX_UPLOAD_SIZE_BYTES)}`, 'error');
      return;
    }
    setLoading(true);

    const isTaPaper = form.type === 'ta_paper_1' || form.type === 'ta_paper_2';

    const processEntry = async (fileOrNull, urlOverride = null) => {
      let finalUrl = urlOverride || form.url;
      if (fileOrNull) {
        const path = `coordinator/${user.id}/${Date.now()}_${safeStorageFileName(fileOrNull.name)}`;
        const { error: upErr } = await supabase.storage.from('materials').upload(path, fileOrNull);
        if (upErr) { showToast(`Upload failed for ${fileOrNull.name}: ${upErr.message}`, 'error'); return false; }
        finalUrl = supabase.storage.from('materials').getPublicUrl(path).data.publicUrl;
      }

      const titleStr = files.length > 1 && fileOrNull ? `${form.title} - ${fileOrNull.name}` : form.title;

      if (isTaPaper) {
        const { error } = await supabase.from('faculty_workspace').insert({
          subject_id: form.subject_id,
          title: titleStr,
          type: 'resource',
          sub_type: form.type === 'ta_paper_1' ? 'TA1' : 'TA2',
          resource_url: finalUrl,
          content: 'TA Paper uploaded by coordinator',
          author_id: user.id,
          approval_status: 'approved',
        });
        if (error) { showToast('DB Error: ' + error.message, 'error'); return false; }
      } else {
        const { error } = await supabase.from('resources').insert({
          subject_id: form.subject_id,
          title: titleStr,
          type: form.type,
          url: finalUrl,
          visibility: form.visibility,
          approval_status: 'approved', // coordinator uploads are always approved
          is_official: true,
          owner_id: user.id,
          uploaded_by: user.id,
        });
        if (error) { showToast('DB Error: ' + error.message, 'error'); return false; }
      }
      return true;
    };

    let successCount = 0;
    let failedCount = 0;
    const successfulFiles = [];
    try {
      if (files.length > 0) {
        for (const f of files) {
          const ok = await processEntry(f, null);
          if (ok) {
            successCount++;
            successfulFiles.push(f);
          }
          else failedCount++;
        }
      } else {
        const ok = await processEntry(null, form.url);
        if (ok) successCount = 1;
        else failedCount = 1;
      }

      if (successCount > 0) {
        if (failedCount > 0) {
          showToast(`Uploaded ${successCount} item(s); ${failedCount} failed. Failed files remain selected so you can retry.`, 'error');
          setFiles(currentFiles => currentFiles.filter(file => !successfulFiles.includes(file)));
        } else {
          showToast(`Uploaded ${successCount} item(s) — live immediately`, 'success');
          setForm({ subject_id: '', type: 'note', title: '', url: '', visibility: 'SUBJECT_WIDE' });
          setFiles([]);
        }
        onUploaded();
        if (failedCount === 0) onClose();
      }
    } catch (error) {
      showToast(`Upload failed: ${error.message || 'Please try again.'}`, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-auto">
        <div className="px-6 py-4 bg-gray-50 border-b flex justify-between items-center sticky top-0 z-10">
          <h3 className="font-extrabold text-gray-900 text-lg">Upload Material</h3>
          <button onClick={onClose}><FaTimes className="text-gray-400 hover:text-gray-700" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Subject */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Subject</label>
            <select required value={form.subject_id} onChange={e => setForm({ ...form, subject_id: e.target.value })}
              className="w-full p-3 bg-gray-50 border border-gray-300 text-gray-900 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">Choose subject…</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
              Title {files.length > 1 && '(Prefix for all)'}
            </label>
            <input required type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Unit 2 Notes"
              className="w-full p-3 bg-gray-50 border border-gray-300 text-gray-900 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Content Type</label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {ALL_TYPES.map(t => (
                <button type="button" key={t.id} onClick={() => setForm({ ...form, type: t.id })}
                  className={`p-2 rounded-lg text-[10px] sm:text-xs font-bold border transition ${form.type === t.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Visibility (only for non-TA types) */}
          {!['ta_paper_1', 'ta_paper_2'].includes(form.type) && (
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Visibility</label>
              <div className="space-y-2">
                {VISIBILITY_OPTIONS.map(v => (
                  <label key={v.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${form.visibility === v.id ? 'border-indigo-500 bg-indigo-50 shadow-inner' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <input type="radio" name="visibility" value={v.id} checked={form.visibility === v.id} onChange={() => setForm({ ...form, visibility: v.id })} />
                    <div>
                      <p className="font-bold text-sm text-gray-800">{v.label}</p>
                      <p className="text-xs text-gray-500">{v.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Files or URL */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Files or URL</label>
            <div className="space-y-3">
              <div className="border-2 border-dashed border-indigo-200 bg-indigo-50/30 rounded-xl p-6 text-center hover:bg-indigo-50 transition cursor-pointer relative group">
                <input type="file" multiple accept=".pdf,.ppt,.pptx,.doc,.docx,.txt,.zip" onChange={e => setFiles(Array.from(e.target.files))} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                <FaCloudUploadAlt className="text-3xl text-indigo-400 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-bold text-indigo-600 block mb-1">Select files (bulk upload supported)</span>
                <span className="text-xs text-gray-500">{files.length > 0 ? `${files.length} file(s) selected` : 'Drag and drop or click to browse'}</span>
              </div>
              {files.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {files.map((f, i) => <span key={i} className="text-[10px] bg-gray-100 px-2 py-1 rounded text-gray-600 font-medium truncate max-w-[150px] border">{f.name}</span>)}
                </div>
              )}
              <div className="flex items-center gap-2">
                <hr className="flex-1" /><span className="text-xs text-gray-400 font-bold uppercase">OR</span><hr className="flex-1" />
              </div>
              <input type="text" placeholder="Paste a URL (Drive, YouTube, etc)" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} disabled={files.length > 0}
                className="w-full p-3 bg-gray-50 border border-gray-300 text-gray-900 rounded-xl outline-none text-sm disabled:opacity-50" />
            </div>
          </div>

          <button disabled={loading} className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-extrabold py-4 rounded-xl transition-all shadow-lg shadow-indigo-200 flex justify-center items-center gap-2">
            {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {loading ? `Uploading ${files.length || 1} item(s)...` : `Upload ${files.length > 1 ? 'Files' : 'Material'} Now`}
          </button>
          <p className="text-center text-xs text-green-600 mt-1 font-medium">⭐ Coordinator uploads are live immediately — no approval needed.</p>
        </form>
      </div>
    </div>
  );
}

// ── Edit Resource Modal ───────────────────────────────────────
function EditResourceModal({ open, onClose, resource, showToast, onSaved }) {
  const [form, setForm] = useState({ title: '', type: 'note', url: '', visibility: 'SUBJECT_WIDE' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (resource) {
      setForm({
        title: resource.title || '',
        type: resource.type || resource.sub_type || 'note',
        url: resource.url || resource.resource_url || '',
        visibility: resource.visibility || 'SUBJECT_WIDE',
      });
    }
  }, [resource, open]);

  if (!open || !resource) return null;

  async function handleSave(e) {
    e.preventDefault();
    setLoading(true);
    const table = resource.sub_type ? 'faculty_workspace' : 'resources';
    const updatePayload = resource.sub_type
      ? { title: form.title, sub_type: form.type, resource_url: form.url }
      : { title: form.title, type: form.type, url: form.url, visibility: form.visibility };

    const { error } = await supabase.from(table).update(updatePayload).eq('id', resource.id);
    setLoading(false);
    if (error) {
      showToast('Error updating resource: ' + error.message, 'error');
    } else {
      showToast('Resource updated successfully! ✅', 'success');
      onSaved();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-auto">
        <div className="px-6 py-4 bg-gray-50 border-b flex justify-between items-center sticky top-0 z-10">
          <h3 className="font-extrabold text-gray-900 text-lg flex items-center gap-2">
            <FaEdit className="text-indigo-600" /> Modify Resource
          </h3>
          <button onClick={onClose}><FaTimes className="text-gray-400 hover:text-gray-700" /></button>
        </div>
        <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Title</label>
            <input
              required
              type="text"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              className="w-full p-3 bg-gray-50 border border-gray-300 text-gray-900 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Content Type</label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {ALL_TYPES.map(t => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => setForm({ ...form, type: t.id })}
                  className={`p-2 rounded-lg text-[10px] sm:text-xs font-bold border transition ${
                    form.type === t.id
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {!resource.sub_type && (
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Visibility</label>
              <div className="space-y-2">
                {VISIBILITY_OPTIONS.map(v => (
                  <label
                    key={v.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                      form.visibility === v.id ? 'border-indigo-500 bg-indigo-50 shadow-inner' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="visibility_edit"
                      value={v.id}
                      checked={form.visibility === v.id}
                      onChange={() => setForm({ ...form, visibility: v.id })}
                    />
                    <div>
                      <p className="font-bold text-sm text-gray-800">{v.label}</p>
                      <p className="text-xs text-gray-500">{v.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Resource URL</label>
            <input
              required
              type="text"
              value={form.url}
              onChange={e => setForm({ ...form, url: e.target.value })}
              className="w-full p-3 bg-gray-50 border border-gray-300 text-gray-900 rounded-xl outline-none text-xs focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            disabled={loading}
            className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-extrabold py-3.5 rounded-xl transition-all shadow-lg shadow-indigo-200 flex justify-center items-center gap-2"
          >
            {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {loading ? 'Saving Changes...' : 'Save Modifications'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── MAIN COORDINATOR DASHBOARD ─────────────────────────────────
export default function CoordinatorDashboard() {
  const { user, signOut, getCoordinatorSubjects, isCoordinator, isAdmin, refreshProfile } = useAuth();
  const { darkMode, setDarkMode } = useTheme();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('overview');
  const [subjects, setSubjects] = useState([]);
  const [allDbSubjects, setAllDbSubjects] = useState([]);
  const [selectedRegSubId, setSelectedRegSubId] = useState('');
  const [registeringSub, setRegisteringSub] = useState(false);
  const [resources, setResources] = useState([]);
  const [taPapers, setTaPapers] = useState([]);
  const [modRequests, setModRequests] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [posts, setPosts] = useState([]);
  const [students, setStudents] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [activeUploadSubjectId, setActiveUploadSubjectId] = useState('');
  const [expandedSubjectId, setExpandedSubjectId] = useState(null);
  const [contentSubjectFilter, setContentSubjectFilter] = useState('all');
  const [editingResource, setEditingResource] = useState(null);
  const [toast, setToast] = useState({ message: '', type: '' });

  // Timeline form
  const [showTimelineForm, setShowTimelineForm] = useState(false);
  const [tForm, setTForm] = useState({ subject_id: '', week_number: 1, title: '', description: '', type: 'topic' });

  // Workspace post form
  const [showPostForm, setShowPostForm] = useState(false);
  const [pForm, setPForm] = useState({ subject_id: '', title: '', content: '', type: 'announcement' });

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: '', type: '' }), 4000);
  };

  async function fetchData() {
    if (!user || (!isCoordinator && !isAdmin)) return;
    let mySubjects = getCoordinatorSubjects() || [];

    // Fallback: If not hydrated through context yet, query coordinator_subjects directly
    if (mySubjects.length === 0 && user) {
      try {
        const { data: directCoordSubs } = await supabase
          .from('coordinator_subjects')
          .select('subject_id, subjects(*)')
          .eq('coordinator_id', user.id);
        if (directCoordSubs && directCoordSubs.length > 0) {
          mySubjects = directCoordSubs.map(cs => ({ ...cs.subjects, id: cs.subject_id })).filter(s => s && s.id);
        }
      } catch (err) {
        console.warn('Direct subject check failed:', err);
      }
    }

    // Fetch all available subjects in the database for self-registration or admin access
    const { data: dbSubs } = await supabase.from('subjects').select('*').order('title', { ascending: true });
    setAllDbSubjects(dbSubs || []);

    // If admin has no specific subject assigned, allow them to view all subjects
    if (isAdmin && mySubjects.length === 0 && dbSubs && dbSubs.length > 0) {
      mySubjects = dbSubs;
    }

    setSubjects(mySubjects || []);

    if (mySubjects.length > 0) {
      const sIds = mySubjects.map(s => s.id);
      const [rData, tData, pData, modData, enrData, subData] = await Promise.all([
        supabase.from('resources').select('*, subjects(title)').in('subject_id', sIds).order('created_at', { ascending: false }),
        supabase.from('subject_timeline').select('*, subjects(title)').in('subject_id', sIds).order('week_number', { ascending: true }),
        supabase.from('faculty_workspace').select('*, subjects(title)').in('subject_id', sIds).order('created_at', { ascending: false }),
        supabase.from('modification_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
        supabase.from('batch_enrollments').select('*'),
        supabase.from('submissions').select('*').order('submitted_at', { ascending: false }).limit(200),
      ]);

      const rawResources = rData.data || [];
      const rawPosts = pData.data || [];

      // Fetch uploader profiles safely
      const uploaderIds = [...new Set([
        ...rawResources.map(r => r.uploaded_by || r.owner_id),
        ...rawPosts.map(p => p.author_id)
      ].filter(Boolean))];

      let profMap = {};
      if (uploaderIds.length > 0) {
        try {
          const { data: profs } = await supabase.from('profiles').select('id, full_name, email').in('id', uploaderIds);
          (profs || []).forEach(p => { profMap[p.id] = p; });
        } catch (e) {
          console.warn('Profile enrichment skipped:', e);
        }
      }

      const enrichedResources = rawResources.map(r => ({
        ...r,
        profiles: profMap[r.uploaded_by || r.owner_id] || null
      }));

      const enrichedPosts = rawPosts.map(p => ({
        ...p,
        profiles: profMap[p.author_id] || null
      }));

      setResources(enrichedResources);
      setTimeline(tData.data || []);
      setPosts(enrichedPosts.filter(p => !['TA1', 'TA2'].includes(p.sub_type)));
      setTaPapers(enrichedPosts.filter(p => ['TA1', 'TA2'].includes(p.sub_type)));
      setModRequests(modData.data || []);
      setStudents(enrData.data || []);
      setSubmissions(subData.data || []);
    }
    setLoading(false);
  }

  async function handleSelfRegisterSubject(e) {
    e.preventDefault();
    if (!selectedRegSubId) return;
    setRegisteringSub(true);
    const parsedSubId = isNaN(selectedRegSubId) ? selectedRegSubId : parseInt(selectedRegSubId, 10);

    // Check if user_roles entry already exists
    const { data: existingRole } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', user.id)
      .eq('role', 'coordinator')
      .eq('subject_id', parsedSubId)
      .maybeSingle();

    if (!existingRole) {
      const { error: roleErr } = await supabase.from('user_roles').insert({
        user_id: user.id,
        role: 'coordinator',
        subject_id: parsedSubId
      });

      if (roleErr) {
        showToast('Error registering subject role: ' + roleErr.message, 'error');
        setRegisteringSub(false);
        return;
      }
    }

    // Check if coordinator_subjects entry already exists
    const { data: existingAssign } = await supabase
      .from('coordinator_subjects')
      .select('id')
      .eq('coordinator_id', user.id)
      .eq('subject_id', parsedSubId)
      .maybeSingle();

    if (!existingAssign) {
      const { error: assignErr } = await supabase.from('coordinator_subjects').insert({
        coordinator_id: user.id,
        subject_id: parsedSubId
      });

      if (assignErr) {
        showToast('Error assigning subject: ' + assignErr.message, 'error');
        setRegisteringSub(false);
        return;
      }
    }

    await supabase.from('profiles').update({ is_coordinator: true }).eq('id', user.id);

    setRegisteringSub(false);
    showToast('Successfully registered as coordinator! 🎉', 'success');
    setSelectedRegSubId('');
    if (refreshProfile) await refreshProfile();
    fetchData();
  }

  useEffect(() => { fetchData(); }, [user, isCoordinator, isAdmin]);

  // ── Action Handlers ───────────────────────────────────────

  async function handleStatusUpdate(id, newStatus, table = 'resources') {
    const { error } = await supabase.from(table).update({ approval_status: newStatus }).eq('id', id);
    if (!error) { showToast(`Status updated to ${newStatus}`, 'success'); fetchData(); }
    else showToast('Error: ' + error.message, 'error');
  }

  async function handleDeleteResource(id, table = 'resources') {
    if (!window.confirm('Permanently delete this item?')) return;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (!error) { showToast('Deleted successfully', 'success'); fetchData(); }
    else showToast('Error: ' + error.message, 'error');
  }

  async function handleModRequest(reqId, status, req) {
    if (status === 'approved') {
      const updateData = { ...req.proposed_changes };
      delete updateData.note;
      if (Object.keys(updateData).length > 0) {
        const { error: applyErr } = await supabase.from(req.target_table).update(updateData).eq('id', req.target_id);
        if (applyErr) { showToast('Failed to apply changes: ' + applyErr.message, 'error'); return; }
      }
    }
    const { error } = await supabase.from('modification_requests').update({ status, reviewer_id: user.id, reviewed_at: new Date() }).eq('id', reqId);
    if (!error) { showToast(status === 'approved' ? '✅ Request approved' : '❌ Request rejected', 'success'); fetchData(); }
    else showToast('Error: ' + error.message, 'error');
  }

  async function handleAddTimeline(e) {
    e.preventDefault();
    const { error } = await supabase.from('subject_timeline').insert([{ ...tForm, created_by: user.id }]);
    if (error) showToast(error.message, 'error');
    else { setShowTimelineForm(false); showToast('Week added!', 'success'); fetchData(); }
  }

  async function handleDeleteTimeline(id) {
    if (!window.confirm('Delete this timeline entry?')) return;
    const { error } = await supabase.from('subject_timeline').delete().eq('id', id);
    if (!error) { showToast('Deleted', 'success'); fetchData(); }
    else showToast('Error: ' + error.message, 'error');
  }

  async function handleAddPost(e) {
    e.preventDefault();
    const { error } = await supabase.from('faculty_workspace').insert([{ ...pForm, author_id: user.id }]);
    if (error) showToast(error.message, 'error');
    else { setShowPostForm(false); showToast('Post published!', 'success'); fetchData(); }
  }

  async function handleDeletePost(id) {
    if (!window.confirm('Delete this post?')) return;
    const { error } = await supabase.from('faculty_workspace').delete().eq('id', id);
    if (!error) { showToast('Deleted', 'success'); fetchData(); }
    else showToast('Error: ' + error.message, 'error');
  }

  // ── Computed ──────────────────────────────────────────────

  const pending = resources.filter(r => r.approval_status === 'pending');
  const pendingTa = taPapers.filter(r => r.approval_status === 'pending');
  const pendingMods = modRequests; // already filtered to pending in fetchData
  const totalPending = pending.length + pendingTa.length + pendingMods.length;

  const uniqueStudents = new Set(students.map(s => s.user_id)).size;

  const sidebarItems = [
    { id: 'overview',   label: 'Overview',           icon: <FaTachometerAlt /> },
    { id: 'approvals',  label: 'Approval Queue',      icon: <FaCheckCircle />,     badge: totalPending },
    { id: 'uploads',    label: 'All Content',         icon: <FaFolderOpen /> },
    { id: 'timeline',   label: 'Subject Timeline',    icon: <FaCalendarAlt /> },
    { id: 'workspace',  label: 'Faculty Workspace',   icon: <FaComments /> },
    { id: 'students',   label: 'My Students',         icon: <FaUserGraduate /> },
    { id: 'submissions',label: 'Submissions Inbox',   icon: <FaInbox /> },
    { id: 'subjects',   label: 'Manage Subjects',     icon: <FaBook /> },
  ];

  const tabTitle = {
    overview:    'Overview',
    approvals:   'Approval Queue',
    uploads:     'All Content',
    timeline:    'Subject Timeline',
    workspace:   'Faculty Workspace',
    students:    'My Students',
    submissions: 'Submissions Inbox',
    subjects:    'Manage Subjects',
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 font-medium">Loading coordinator portal…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: '' })} />
      <UploadModal 
        open={showUploadModal} 
        onClose={() => { setShowUploadModal(false); setActiveUploadSubjectId(''); }} 
        subjects={subjects} 
        defaultSubjectId={activeUploadSubjectId}
        showToast={showToast} 
        onUploaded={fetchData} 
      />

      {/* ── SIDEBAR ─── */}
      <div className="w-64 bg-gradient-to-b from-gray-950 to-gray-900 text-white flex flex-col z-20 shadow-2xl flex-shrink-0">
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-extrabold text-white text-base shadow-lg shadow-indigo-500/20">
              CP
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">Campus<span className="text-indigo-400">Learn</span></h1>
              <p className="text-gray-400 text-[10px] uppercase font-bold tracking-wider mt-0.5">Coordinator Portal</p>
            </div>
          </div>
        </div>

        <div className="flex-1 py-5 px-3 space-y-1 overflow-y-auto">
          {sidebarItems.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium transition-all text-sm relative ${
                activeTab === item.id 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 font-bold' 
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}>
              <span className={`text-base ${activeTab === item.id ? 'text-white' : 'text-gray-400'}`}>{item.icon}</span>
              <span>{item.label}</span>
              {item.badge > 0 && (
                <span className="ml-auto bg-red-500 text-white text-[10px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center">
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              )}
              {activeTab === item.id && !item.badge && (
                <span className="ml-auto w-1.5 h-4 rounded-full bg-white/60" />
              )}
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-white/5 space-y-2">
          {user && (
            <div className="flex items-center gap-2.5 px-2 py-1.5 mb-1 bg-white/5 rounded-xl">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-xs text-white">
                {(user.email || 'C').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-200 truncate">{user.email}</p>
                <p className="text-[10px] text-gray-500">Subject Coordinator</p>
              </div>
            </div>
          )}
          <button onClick={() => navigate('/')}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white/5 text-gray-300 rounded-xl hover:bg-white/10 hover:text-white transition-all text-xs font-semibold">
            ← Back to CampusLearn
          </button>
          <button onClick={async () => { await signOut(); navigate('/login'); }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white/5 text-gray-300 rounded-xl hover:bg-red-500/20 hover:text-red-400 transition-all text-xs font-semibold">
            <FaSignOutAlt /> Sign Out
          </button>
        </div>
      </div>

      {/* ── MAIN ─── */}
      <div className="flex-1 overflow-y-auto p-8 lg:p-12 relative bg-gray-50">
        {/* Page header */}
        <div className="flex justify-between items-center mb-8 border-b border-gray-200 pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-gray-400 mb-1">
              <span>Coordinator</span>
              <span>/</span>
              <span className="text-indigo-600">{tabTitle[activeTab]}</span>
            </div>
            <h2 className="text-3xl font-extrabold text-gray-900">{tabTitle[activeTab]}</h2>
            <p className="text-gray-400 text-xs mt-1">
              {subjects.length} subject{subjects.length !== 1 ? 's' : ''} under your coordination
            </p>
          </div>
          <div className="flex items-center gap-3">
            {['uploads', 'overview'].includes(activeTab) && (
              <button onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:from-indigo-700 hover:to-blue-700 transition shadow-lg shadow-indigo-200 text-sm">
                <FaCloudUploadAlt /> Upload Material
              </button>
            )}
            {activeTab === 'timeline' && (
              <button onClick={() => setShowTimelineForm(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:from-indigo-700 hover:to-blue-700 transition shadow-lg shadow-indigo-200 text-sm">
                <FaPlus /> Add Week
              </button>
            )}
            {activeTab === 'workspace' && (
              <button onClick={() => setShowPostForm(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:from-indigo-700 hover:to-blue-700 transition shadow-lg shadow-indigo-200 text-sm">
                <FaPlus /> New Post
              </button>
            )}
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 border-2 border-white shadow-md flex items-center justify-center font-extrabold text-white text-sm">
              {(user?.email || 'C').charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        {subjects.length === 0 && !['overview', 'subjects'].includes(activeTab) && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
            <div className="text-5xl mb-4">📭</div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">No Subjects Assigned Yet</h3>
            <p className="text-gray-400 text-sm max-w-md mx-auto mb-6">
              You haven't been assigned any subjects yet. You can self-register for any subject in the catalogue or contact your administrator.
            </p>
            <button
              onClick={() => setActiveTab('subjects')}
              className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition shadow-md shadow-indigo-100 text-sm"
            >
              Go to Manage Subjects →
            </button>
          </div>
        )}

        {/* ── OVERVIEW TAB ── */}
        {activeTab === 'overview' && (
          <div className="animate-fade-in-up space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
              <StatCard icon={<FaBook />} label="Subjects" value={subjects.length} color="bg-indigo-50 text-indigo-600" gradient="from-indigo-500 to-blue-600" />
              <StatCard icon={<FaUserGraduate />} label="Total Students" value={uniqueStudents} color="bg-purple-50 text-purple-600" gradient="from-purple-500 to-violet-600" />
              <StatCard icon={<FaFolderOpen />} label="Total Resources" value={resources.length} color="bg-blue-50 text-blue-600" gradient="from-blue-500 to-cyan-600" />
              <StatCard icon={<FaCheckCircle />} label="Pending Actions" value={totalPending} color="bg-amber-50 text-amber-600" gradient="from-amber-500 to-orange-600" />
            </div>

            {/* Quick subject list */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-800">My Subjects</h3>
                <button onClick={() => setShowUploadModal(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-indigo-700 transition">
                  <FaCloudUploadAlt /> Upload
                </button>
              </div>
              {subjects.length === 0 ? (
                <p className="text-gray-400 text-sm">No subjects assigned yet.</p>
              ) : subjects.map(s => (
                <div key={s.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-bold text-lg">
                      {s.title?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">{s.title}</p>
                      <p className="text-xs text-gray-400">{s.branch || '—'} · Sem {s.semester || '—'}</p>
                    </div>
                  </div>
                  <Link to={`/subject/${s.id}`} state={{ from: 'coordinator' }} className="flex items-center gap-1 text-indigo-600 text-sm font-bold hover:text-indigo-800 transition">
                    View <FaChevronRight className="text-xs" />
                  </Link>
                </div>
              ))}
            </div>

            {/* Recent pending resources */}
            {pending.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
                <h3 className="font-bold text-amber-800 mb-3">⚠️ {totalPending} Pending Item(s) Need Your Attention</h3>
                <button onClick={() => setActiveTab('approvals')}
                  className="bg-amber-500 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-amber-600 transition">
                  Go to Approval Queue →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── APPROVALS TAB ── */}
        {activeTab === 'approvals' && subjects.length > 0 && (
          <div className="space-y-8 animate-fade-in-up">
            {/* Pending Resources */}
            <ResourceTable
              title="Pending Resources"
              rows={pending}
              emptyText="No pending resources. ✅"
              onApprove={id => handleStatusUpdate(id, 'approved', 'resources')}
              onReject={id => handleStatusUpdate(id, 'rejected', 'resources')}
              onDelete={id => handleDeleteResource(id, 'resources')}
              showActions
              urlKey="url"
            />

            {/* Pending TA Papers */}
            <ResourceTable
              title="Pending TA Papers"
              rows={pendingTa}
              emptyText="No pending TA papers. ✅"
              onApprove={id => handleStatusUpdate(id, 'approved', 'faculty_workspace')}
              onReject={id => handleStatusUpdate(id, 'rejected', 'faculty_workspace')}
              onDelete={id => handleDeleteResource(id, 'faculty_workspace')}
              showActions
              urlKey="resource_url"
              typeKey="sub_type"
            />

            {/* Edit Suggestions */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b bg-gray-50">
                <h3 className="font-bold text-gray-800">Edit Suggestions ({pendingMods.length})</h3>
              </div>
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase border-b">
                  <tr>
                    <th className="px-6 py-4">Requested By</th>
                    <th className="px-6 py-4">Proposed Changes</th>
                    <th className="px-6 py-4">Note</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pendingMods.length === 0 ? (
                    <tr><td colSpan="4" className="text-center py-10 text-gray-400">No edit suggestions. ✅</td></tr>
                  ) : pendingMods.map(m => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-600">{m.requester_id?.substring(0, 8)}…</td>
                      <td className="px-6 py-4">
                        <pre className="text-xs bg-gray-100 p-2 rounded text-gray-800 max-w-xs overflow-auto">
                          {JSON.stringify(m.proposed_changes, null, 2)}
                        </pre>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{m.proposed_changes?.note || '—'}</td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button onClick={() => handleModRequest(m.id, 'approved', m)} className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-sm font-bold inline-flex items-center gap-1"><FaCheckCircle /> Approve</button>
                        <button onClick={() => handleModRequest(m.id, 'rejected', m)} className="px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 text-sm font-bold inline-flex items-center gap-1"><FaTimesCircle /> Reject</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── ALL CONTENT TAB ── */}
        {activeTab === 'uploads' && subjects.length > 0 && (() => {
          const filteredResources = contentSubjectFilter === 'all' 
            ? resources 
            : resources.filter(r => String(r.subject_id) === String(contentSubjectFilter));
          const filteredTaPapers = contentSubjectFilter === 'all' 
            ? taPapers 
            : taPapers.filter(r => String(r.subject_id) === String(contentSubjectFilter));

          return (
            <div className="space-y-6 animate-fade-in-up">
              {/* Subject Filter Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Subject Filter:</span>
                  <select
                    value={contentSubjectFilter}
                    onChange={e => setContentSubjectFilter(e.target.value)}
                    className="p-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="all">All Coordinated Subjects ({subjects.length})</option>
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.title} ({s.branch || 'CS'} · Sem {s.semester || '—'})
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => {
                    setActiveUploadSubjectId(contentSubjectFilter !== 'all' ? contentSubjectFilter : (subjects[0]?.id || ''));
                    setShowUploadModal(true);
                  }}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold text-xs hover:bg-indigo-700 transition shadow-sm"
                >
                  <FaCloudUploadAlt /> + Upload to This Subject
                </button>
              </div>

              <ResourceTable
                title={`All Resources ${contentSubjectFilter !== 'all' ? `(${filteredResources.length})` : `(${resources.length})`}`}
                rows={filteredResources}
                emptyText="No resources found for this filter. Upload your first material above."
                onEdit={setEditingResource}
                onDelete={id => handleDeleteResource(id, 'resources')}
                showApprovalBadge
                urlKey="url"
              />
              <ResourceTable
                title={`TA Papers ${contentSubjectFilter !== 'all' ? `(${filteredTaPapers.length})` : `(${taPapers.length})`}`}
                rows={filteredTaPapers}
                emptyText="No TA papers uploaded for this filter."
                onApprove={id => handleStatusUpdate(id, 'approved', 'faculty_workspace')}
                onReject={id => handleStatusUpdate(id, 'rejected', 'faculty_workspace')}
                onEdit={setEditingResource}
                onDelete={id => handleDeleteResource(id, 'faculty_workspace')}
                showActions
                showApprovalBadge
                urlKey="resource_url"
                typeKey="sub_type"
              />
            </div>
          );
        })()}

        {/* ── TIMELINE TAB ── */}
        {activeTab === 'timeline' && subjects.length > 0 && (
          <div className="space-y-4 animate-fade-in-up">
            {timeline.length === 0 ? (
              <div className="bg-white p-10 rounded-2xl text-center shadow-sm border border-gray-100">
                <FaClock className="text-4xl text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-bold">No timeline events added yet.</p>
                <button onClick={() => setShowTimelineForm(true)} className="mt-4 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-700 transition">
                  <FaPlus className="inline mr-2" />Add First Week
                </button>
              </div>
            ) : timeline.map(t => (
              <div key={t.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex gap-4 hover:shadow-md transition group">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-xl flex flex-col items-center justify-center font-extrabold flex-shrink-0">
                  <span className="text-xs uppercase text-indigo-400">Week</span>
                  <span className="text-2xl">{t.week_number}</span>
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 text-lg">{t.title}</h3>
                  <p className="text-gray-500 text-sm mt-1">{t.description}</p>
                  <div className="mt-2 flex gap-2">
                    <span className="text-xs font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded">{t.type}</span>
                    <span className="text-xs font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded">{t.subjects?.title}</span>
                  </div>
                </div>
                <button onClick={() => handleDeleteTimeline(t.id)}
                  className="opacity-0 group-hover:opacity-100 transition text-gray-300 hover:text-red-500 self-start mt-1">
                  <FaTrash />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── WORKSPACE TAB ── */}
        {activeTab === 'workspace' && subjects.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in-up">
            {posts.length === 0 ? (
              <div className="col-span-full bg-white p-10 rounded-2xl text-center shadow-sm border border-gray-100">
                <FaComments className="text-4xl text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-bold">No faculty posts yet. Create the first one!</p>
              </div>
            ) : posts.map(p => (
              <div key={p.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition group">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-gray-900 text-lg">{p.title}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold bg-purple-50 text-purple-600 px-2 py-1 rounded">{p.type}</span>
                    <button onClick={() => handleDeletePost(p.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition">
                      <FaTrash className="text-sm" />
                    </button>
                  </div>
                </div>
                <p className="text-gray-600 text-sm mb-4 line-clamp-3">{p.content}</p>
                <div className="flex justify-between items-center text-xs text-gray-400 border-t pt-3">
                  <span>By {p.profiles?.full_name || p.profiles?.email}</span>
                  <span className="font-bold text-indigo-500">{p.subjects?.title}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── STUDENTS TAB ── */}
        {activeTab === 'students' && subjects.length > 0 && (
          <div className="animate-fade-in-up">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h3 className="font-bold text-gray-800">Enrolled Students ({uniqueStudents} unique)</h3>
                <p className="text-xs text-gray-400 mt-1">All students enrolled in your coordinated subjects.</p>
              </div>
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-bold border-b">
                  <tr>
                    <th className="px-6 py-4">Student Name</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">Branch / Sem</th>
                    <th className="px-6 py-4">Enrolled Subject</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {students.length === 0 ? (
                    <tr><td colSpan="4" className="text-center py-10 text-gray-400">No students enrolled yet.</td></tr>
                  ) : students.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-semibold text-gray-900 text-sm">{s.profiles?.full_name || '—'}</td>
                      <td className="px-6 py-4 text-xs text-gray-500">{s.profiles?.email}</td>
                      <td className="px-6 py-4 text-xs text-gray-500">{s.profiles?.branch || '—'} / Sem {s.profiles?.semester || '—'}</td>
                      <td className="px-6 py-4 text-xs font-bold text-indigo-600 bg-indigo-50/50">{s.subjects?.title}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── SUBMISSIONS TAB ── */}
        {activeTab === 'submissions' && subjects.length > 0 && (
          <div className="animate-fade-in-up">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h3 className="font-bold text-gray-800">Student Submissions ({submissions.length})</h3>
                <p className="text-xs text-gray-400 mt-1">All submissions to your subjects.</p>
              </div>
              {submissions.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="text-5xl mb-4">📭</div>
                  <p className="text-gray-400 font-medium">No submissions received yet.</p>
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-bold border-b">
                    <tr>
                      <th className="px-6 py-4">Student</th>
                      <th className="px-6 py-4">Title</th>
                      <th className="px-6 py-4">Type</th>
                      <th className="px-6 py-4">File</th>
                      <th className="px-6 py-4">Submitted</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {submissions.map(s => (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-600">{s.student_id?.substring(0, 8) || 'Anonymous'}…</td>
                        <td className="px-6 py-4 font-semibold text-gray-900 text-sm">{s.title}</td>
                        <td className="px-6 py-4">
                          <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase px-2 py-1 rounded-full">{s.type}</span>
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-500">
                          {s.file_url ? (
                            <a href={s.file_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-medium">
                              {s.file_name || 'Download'}
                            </a>
                          ) : (s.file_name || '—')}
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-400">
                          {s.submitted_at ? new Date(s.submitted_at).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── MANAGE SUBJECTS TAB ── */}
        {activeTab === 'subjects' && (
          <div className="space-y-4 animate-fade-in-up">
            {/* Self-registration Form */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-extrabold text-gray-800 text-lg mb-2">Self-Register a Coordinated Subject</h3>
              <p className="text-gray-400 text-xs mb-4">
                Assign yourself as the coordinator for any subject in the database to manage its resources, timeline, and student submissions.
              </p>
              <form onSubmit={handleSelfRegisterSubject} className="flex flex-col sm:flex-row gap-3">
                <select
                  required
                  value={selectedRegSubId}
                  onChange={e => setSelectedRegSubId(e.target.value)}
                  className="flex-1 p-3 bg-gray-50 border rounded-xl outline-none text-sm font-semibold text-gray-800 focus:border-indigo-500"
                >
                  <option value="">Select a Subject to Coordinate...</option>
                  {allDbSubjects
                    .filter(dbSub => !subjects.some(s => String(s.id) === String(dbSub.id)))
                    .map(sub => (
                      <option key={sub.id} value={sub.id}>
                        {sub.title} ({sub.branch || 'General'} · Sem {sub.semester || '—'})
                      </option>
                    ))
                  }
                </select>
                <button
                  type="submit"
                  disabled={registeringSub || !selectedRegSubId}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-extrabold rounded-xl transition text-sm flex items-center justify-center gap-2"
                >
                  {registeringSub ? 'Registering...' : 'Register Subject 🚀'}
                </button>
              </form>
            </div>

            {subjects.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
                <div className="text-5xl mb-4">📋</div>
                <h3 className="text-xl font-bold text-gray-700 mb-2">No Coordinated Subjects</h3>
                <p className="text-gray-400 max-w-sm mx-auto">Select a subject above to self-register, or ask your admin to assign one.</p>
              </div>
            ) : subjects.map(s => {
              const subResources = resources.filter(r => String(r.subject_id) === String(s.id));
              const subStudents  = new Set(students.filter(e => String(e.subject_id) === String(s.id)).map(e => e.user_id)).size;
              const isExpanded = expandedSubjectId === s.id;

              return (
                <div key={s.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition">
                  <div className="px-6 py-4 bg-gradient-to-r from-indigo-50 to-white border-b flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-extrabold text-xl shadow-md shadow-indigo-100">
                        {s.title?.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-extrabold text-gray-900 text-base">{s.title}</h3>
                        <p className="text-xs text-gray-500 font-medium">{s.branch || 'General'} · Semester {s.semester || '—'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveUploadSubjectId(s.id);
                          setShowUploadModal(true);
                        }}
                        className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 px-3.5 py-2 rounded-xl font-bold text-xs transition"
                      >
                        <FaCloudUploadAlt /> + Upload Material
                      </button>
                      <Link 
                        to={`/subject/${s.id}`}
                        state={{ from: 'coordinator' }}
                        className="flex items-center gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700 px-3.5 py-2 rounded-xl font-bold text-xs transition shadow-sm"
                      >
                        <FaEye /> View Subject
                      </Link>
                    </div>
                  </div>

                  <div className="p-5 grid grid-cols-3 gap-4 border-b border-gray-100">
                    <div className="text-center">
                      <div className="text-2xl font-extrabold text-indigo-600">{subResources.length}</div>
                      <div className="text-xs text-gray-500 mt-1 font-medium">Total Resources</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-extrabold text-green-600">
                        {subResources.filter(r => r.approval_status === 'approved').length}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 font-medium">Approved</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-extrabold text-purple-600">{subStudents}</div>
                      <div className="text-xs text-gray-500 mt-1 font-medium">Enrolled Students</div>
                    </div>
                  </div>

                  {/* Resource Drawer Accordion Header */}
                  <div className="px-6 py-3 bg-gray-50/80 flex items-center justify-between border-b border-gray-100">
                    <button
                      type="button"
                      onClick={() => setExpandedSubjectId(isExpanded ? null : s.id)}
                      className="text-xs font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-2 py-1"
                    >
                      <span>{isExpanded ? <FaChevronUp className="inline text-[10px]" /> : <FaChevronDown className="inline text-[10px]" />}</span>
                      <span>{isExpanded ? 'Hide Subject Resources' : `Watch & Edit Resources (${subResources.length})`}</span>
                    </button>
                    <span className="text-[11px] text-gray-400">
                      {isExpanded ? 'Showing uploaded items' : 'Click to inspect or delete'}
                    </span>
                  </div>

                  {/* Inline Resource Management Drawer */}
                  {isExpanded && (
                    <div className="p-4 bg-gray-50 divide-y divide-gray-200/60 max-h-96 overflow-y-auto">
                      {subResources.length === 0 ? (
                        <div className="text-center py-8 text-gray-400 text-xs">
                          <p>No resources uploaded yet for this subject.</p>
                          <button
                            type="button"
                            onClick={() => { setActiveUploadSubjectId(s.id); setShowUploadModal(true); }}
                            className="mt-2 text-indigo-600 font-bold hover:underline inline-flex items-center gap-1"
                          >
                            <FaPlus className="text-[10px]" /> Upload First Material
                          </button>
                        </div>
                      ) : (
                        subResources.map(r => (
                          <div key={r.id} className="py-3 px-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white rounded-xl transition">
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-xs text-gray-900 truncate">{r.title}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="bg-gray-200 text-gray-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                                  {r.type}
                                </span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  r.approval_status === 'approved' ? 'bg-green-100 text-green-700' :
                                  r.approval_status === 'rejected' ? 'bg-red-100 text-red-700' :
                                  'bg-amber-100 text-amber-700'
                                }`}>
                                  {r.approval_status || 'approved'}
                                </span>
                                {r.is_official && <span className="text-[10px] text-indigo-600 font-bold">⭐ Official</span>}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {r.url && (
                                <a
                                  href={resolveResourceUrl(r.url)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-1.5 text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold px-3 py-1.5 rounded-lg border border-indigo-200 transition"
                                >
                                  <FaExternalLinkAlt className="text-[10px]" /> Watch / Open
                                </a>
                              )}
                              {r.approval_status === 'pending' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleStatusUpdate(r.id, 'approved', 'resources')}
                                    className="text-xs bg-green-50 text-green-700 hover:bg-green-100 font-bold px-2.5 py-1.5 rounded-lg border border-green-200 transition"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleStatusUpdate(r.id, 'rejected', 'resources')}
                                    className="text-xs bg-amber-50 text-amber-700 hover:bg-amber-100 font-bold px-2.5 py-1.5 rounded-lg border border-amber-200 transition"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() => setEditingResource(r)}
                                className="text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold p-2 rounded-lg border border-indigo-200 transition"
                                title="Modify Resource"
                              >
                                <FaEdit className="text-[11px]" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteResource(r.id, 'resources')}
                                className="text-xs bg-red-50 text-red-600 hover:bg-red-100 font-bold p-2 rounded-lg border border-red-200 transition"
                                title="Delete Resource"
                              >
                                <FaTrash className="text-[11px]" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── TIMELINE MODAL ── */}
      {showTimelineForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleAddTimeline} className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-xl font-bold mb-4">Add Weekly Plan</h3>
            <select required value={tForm.subject_id} onChange={e => setTForm({ ...tForm, subject_id: e.target.value })} className="w-full mb-3 p-3 bg-gray-50 border rounded-xl">
              <option value="">Select Subject...</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <input required type="number" min="1" placeholder="Week #" value={tForm.week_number} onChange={e => setTForm({ ...tForm, week_number: e.target.value })} className="w-full p-3 bg-gray-50 border rounded-xl" />
              <select value={tForm.type} onChange={e => setTForm({ ...tForm, type: e.target.value })} className="w-full p-3 bg-gray-50 border rounded-xl">
                <option value="topic">Topic</option>
                <option value="assignment">Assignment</option>
                <option value="quiz">Quiz</option>
                <option value="exam">Exam</option>
              </select>
            </div>
            <input required type="text" placeholder="Title (e.g. Intro to Arrays)" value={tForm.title} onChange={e => setTForm({ ...tForm, title: e.target.value })} className="w-full mb-3 p-3 bg-gray-50 border rounded-xl" />
            <textarea placeholder="Description..." value={tForm.description} onChange={e => setTForm({ ...tForm, description: e.target.value })} className="w-full mb-4 p-3 bg-gray-50 border rounded-xl" rows="3" />
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowTimelineForm(false)} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold">Cancel</button>
              <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold">Save</button>
            </div>
          </form>
        </div>
      )}

      {/* ── POST MODAL ── */}
      {showPostForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleAddPost} className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-xl font-bold mb-4">New Faculty Post</h3>
            <select required value={pForm.subject_id} onChange={e => setPForm({ ...pForm, subject_id: e.target.value })} className="w-full mb-3 p-3 bg-gray-50 border rounded-xl">
              <option value="">Select Subject...</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
            <select value={pForm.type} onChange={e => setPForm({ ...pForm, type: e.target.value })} className="w-full mb-3 p-3 bg-gray-50 border rounded-xl">
              <option value="announcement">Announcement</option>
              <option value="discussion">Discussion</option>
              <option value="resource">Resource Link</option>
            </select>
            <input required type="text" placeholder="Post Title" value={pForm.title} onChange={e => setPForm({ ...pForm, title: e.target.value })} className="w-full mb-3 p-3 bg-gray-50 border rounded-xl" />
            <textarea required placeholder="Write your message to the faculty..." value={pForm.content} onChange={e => setPForm({ ...pForm, content: e.target.value })} className="w-full mb-4 p-3 bg-gray-50 border rounded-xl" rows="4" />
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowPostForm(false)} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold">Cancel</button>
              <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold">Post</button>
            </div>
          </form>
        </div>
      )}

      {/* ── EDIT RESOURCE MODAL ── */}
      <EditResourceModal
        open={!!editingResource}
        resource={editingResource}
        onClose={() => setEditingResource(null)}
        onSaved={fetchData}
        showToast={showToast}
      />
    </div>
  );
}

// ── Reusable Resource Table ────────────────────────────────────
function ResourceTable({ title, rows, emptyText, onApprove, onReject, onEdit, onDelete, showActions = false, showApprovalBadge = false, urlKey = 'url', typeKey = 'type' }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
        <h3 className="font-bold text-gray-800">{title}</h3>
      </div>
      <table className="w-full text-left">
        <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase border-b">
          <tr>
            <th className="px-6 py-4">Resource</th>
            <th className="px-6 py-4">Type</th>
            <th className="px-6 py-4">Uploaded By</th>
            {showApprovalBadge && <th className="px-6 py-4">Status</th>}
            <th className="px-6 py-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.length === 0 ? (
            <tr><td colSpan="5" className="text-center py-10 text-gray-400">{emptyText}</td></tr>
          ) : rows.map(r => (
            <tr key={r.id} className="hover:bg-gray-50">
              <td className="px-6 py-4">
                <p className="font-semibold text-gray-900 text-sm">{r.title}</p>
                {r[urlKey] && (
                  <a href={resolveResourceUrl(r[urlKey])} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">View File</a>
                )}
                {r.subjects?.title && <p className="text-[10px] text-gray-400 mt-0.5">{r.subjects.title}</p>}
              </td>
              <td className="px-6 py-4">
                <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs uppercase font-bold">
                  {r[typeKey]}
                </span>
              </td>
              <td className="px-6 py-4 text-sm text-gray-600">
                {r.profiles?.full_name || r.profiles?.email || (r.uploaded_by || r.author_id)?.substring(0, 8) + '…' || 'Unknown'}
              </td>
              {showApprovalBadge && (
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                    r.approval_status === 'approved' ? 'bg-green-100 text-green-700' :
                    r.approval_status === 'rejected' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {r.approval_status || 'pending'} {r.is_official && '⭐'}
                  </span>
                </td>
              )}
              <td className="px-6 py-4 text-right space-x-2">
                {showActions && r.approval_status === 'pending' && onApprove && (
                  <button onClick={() => onApprove(r.id)} className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-sm font-bold inline-flex items-center gap-1">
                    <FaCheckCircle /> Approve
                  </button>
                )}
                {showActions && r.approval_status === 'pending' && onReject && (
                  <button onClick={() => onReject(r.id)} className="px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 text-sm font-bold inline-flex items-center gap-1">
                    <FaTimesCircle /> Reject
                  </button>
                )}
                {onEdit && (
                  <button onClick={() => onEdit(r)} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 text-sm font-bold inline-flex items-center gap-1" title="Modify Details">
                    <FaEdit /> Edit
                  </button>
                )}
                {onDelete && (
                  <button onClick={() => onDelete(r.id)} className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm font-bold inline-flex items-center gap-1">
                    <FaTrash /> Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
