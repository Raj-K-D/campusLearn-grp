import { useState, useEffect } from 'react';
import { supabase } from '../util/supabase';
import {
  FaLink, FaPlus, FaTimes, FaCheck, FaCopy, FaTrash, FaWhatsapp,
  FaEnvelope, FaKey, FaRedo, FaUsers, FaEye, FaEyeSlash, FaToggleOn, FaToggleOff,
} from 'react-icons/fa';
import { SCHOOLS, DEGREES, BRANCHES, BATCHES } from '../data/universityData';

// ─── helpers ────────────────────────────────────────────────────────────────────
function generateToken() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function generateCode() {
  const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const SECTIONS = ['A', 'B', 'C', 'D', 'E'];

// ─── Pill badge ─────────────────────────────────────────────────────────────────
function Badge({ color, children }) {
  const map = {
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    blue:   'bg-blue-50   text-blue-700   border-blue-200',
    green:  'bg-emerald-50 text-emerald-700 border-emerald-200',
    red:    'bg-red-50    text-red-600     border-red-200',
    gray:   'bg-gray-100  text-gray-500    border-gray-200',
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${map[color] || map.gray}`}>
      {children}
    </span>
  );
}

// ─── Copy button ─────────────────────────────────────────────────────────────────
function CopyBtn({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition ${
        copied ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {copied ? <FaCheck /> : <FaCopy />} {copied ? 'Copied!' : label}
    </button>
  );
}

// ─── Enrollment Drawer ────────────────────────────────────────────────────────
function EnrollmentDrawer({ link, onClose }) {
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('batch_enrollments')
        .select('*')
        .eq('batch_link_id', link.id)
        .order('enrolled_at', { ascending: false });
      setEnrollments(data || []);
      setLoading(false);
    }
    fetch();
  }, [link.id]);

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
          <div>
            <h3 className="font-bold text-gray-800 text-lg">
              {link.degree_name} · {link.branch_name} · Section {link.section}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">{enrollments.length} student(s) enrolled</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition"><FaTimes className="text-xl" /></button>
        </div>

        {/* Table */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">Loading…</div>
          ) : enrollments.length === 0 ? (
            <div className="text-center py-12">
              <FaUsers className="text-4xl mx-auto mb-3 text-gray-300" />
              <p className="text-gray-400 font-medium">No students have enrolled yet.</p>
              <p className="text-gray-400 text-sm mt-1">Share the magic link with your class!</p>
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-bold border-b border-gray-100 sticky top-0">
                <tr>
                  <th className="px-5 py-3 text-left">#</th>
                  <th className="px-5 py-3 text-left">Name</th>
                  <th className="px-5 py-3 text-left">Roll No.</th>
                  <th className="px-5 py-3 text-left">Enroll No.</th>
                  <th className="px-5 py-3 text-left">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {enrollments.map((e, i) => (
                  <tr key={e.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-3 text-gray-400 font-mono text-xs">{i + 1}</td>
                    <td className="px-5 py-3 font-semibold text-gray-800">{e.full_name}</td>
                    <td className="px-5 py-3 font-mono text-indigo-600 text-xs">{e.roll_no}</td>
                    <td className="px-5 py-3 font-mono text-gray-500 text-xs">{e.enroll_no}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs">
                      {new Date(e.enrolled_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main BatchLinkManager ───────────────────────────────────────────────────
export default function BatchLinkManager({ showToast }) {
  const [links, setLinks]             = useState([]);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [showModal, setShowModal]     = useState(false);
  const [saving, setSaving]           = useState(false);
  const [drawerLink, setDrawerLink]   = useState(null);
  const [showCode, setShowCode]       = useState({});

  // Form state
  const [form, setForm] = useState({
    schoolId: '', degreeId: '', branchId: '', batchId: '', section: '',
    currentSemester: '4',
    token: generateToken(),
    accessCode: generateCode(),
  });

  const availDegrees  = DEGREES.filter(d => d.schoolId === form.schoolId);
  const availBranches = BRANCHES.filter(b => b.degreeId === form.degreeId);
  const chosenSchool  = SCHOOLS.find(s => s.id === form.schoolId);
  const chosenDegree  = DEGREES.find(d => d.id === form.degreeId);
  const chosenBranch  = BRANCHES.find(b => b.id === form.branchId);
  const chosenBatch   = BATCHES.find(b => b.id === form.batchId);
  // Show only batches matching the degree duration
  const isTwoYear    = ['mtech', 'mca', 'mba'].includes(form.degreeId) ||
                       DEGREES.find(d => d.id === form.degreeId)?.years === 2;
  const availBatches = BATCHES.filter(b => isTwoYear ? b.type === 'mtech' : b.type !== 'mtech');
  // Max semesters depends on degree
  const maxSems = isTwoYear ? 4 : 8;

  const baseUrl = window.location.origin;

  // ── Fetch all links ────────────────────────────────────────────────────────
  const fetchLinks = async () => {
    setLoadingLinks(true);
    const { data } = await supabase
      .from('batch_links')
      .select('*')
      .order('created_at', { ascending: false });
    setLinks(data || []);
    setLoadingLinks(false);
  };

  useEffect(() => { fetchLinks(); }, []);

  // ── Regenerate token/code ──────────────────────────────────────────────────
  const regenToken = () => setForm(f => ({ ...f, token: generateToken() }));
  const regenCode  = () => setForm(f => ({ ...f, accessCode: generateCode() }));

  // ── Save new batch link ────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.schoolId || !form.degreeId || !form.branchId || !form.batchId || !form.section) {
      showToast('Please fill all required fields.', 'error');
      return;
    }
    setSaving(true);

    const payload = {
      token:            form.token,
      access_code:      form.accessCode,
      school_id:        form.schoolId,
      school_name:      chosenSchool?.name || '',
      degree_id:        form.degreeId,
      degree_name:      chosenDegree?.name || '',
      branch_id:        form.branchId,
      branch_name:      chosenBranch?.name || '',
      branch_code:      chosenBranch?.code?.toLowerCase() || '',
      batch_id:         form.batchId,
      batch_name:       chosenBatch?.name || '',
      section:          form.section,
      current_semester: Number(form.currentSemester),
      is_active:        true,
    };

    const { error } = await supabase.from('batch_links').insert([payload]);
    setSaving(false);

    if (error) {
      showToast('Error creating link: ' + error.message, 'error');
    } else {
      showToast('Magic link created successfully! 🎉');
      setShowModal(false);
      // Reset form with fresh token/code
      setForm({
        schoolId: '', degreeId: '', branchId: '', batchId: '', section: '',
        currentSemester: '4',
        token: generateToken(),
        accessCode: generateCode(),
      });
      fetchLinks();
    }
  };

  // ── Toggle link active/inactive ────────────────────────────────────────────
  const toggleActive = async (link) => {
    await supabase.from('batch_links').update({ is_active: !link.is_active }).eq('id', link.id);
    fetchLinks();
    showToast(link.is_active ? 'Link deactivated.' : 'Link activated!');
  };

  // ── Delete link ────────────────────────────────────────────────────────────
  const handleDelete = async (link) => {
    if (!window.confirm('Delete this batch link? All enrolled students will lose access.')) return;
    await supabase.from('batch_links').delete().eq('id', link.id);
    showToast('Batch link deleted.');
    fetchLinks();
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in-up space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-sm">Generate secure enrollment links for your class batches.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-gray-900 text-white px-5 py-2.5 rounded-xl font-bold shadow-md hover:bg-gray-800 transition flex items-center gap-2"
        >
          <FaPlus /> Generate Magic Link
        </button>
      </div>

      {/* Links Table */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden">
        {loadingLinks ? (
          <div className="py-12 text-center text-gray-400">Loading batch links…</div>
        ) : links.length === 0 ? (
          <div className="py-16 text-center">
            <FaLink className="text-5xl text-gray-200 mx-auto mb-4" />
            <h3 className="font-bold text-gray-600 mb-1">No batch links yet</h3>
            <p className="text-gray-400 text-sm max-w-sm mx-auto">Click "Generate Magic Link" to create your first enrollment link.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {links.map(link => {
              const url = `${baseUrl}/enroll/${link.token}`;
              const waMsg = encodeURIComponent(`🎓 Join our class on CampusLearn!\n\n${url}\n\nAccess Code: *${link.access_code}*\n\nThis link is valid only for ${link.degree_name} (${link.branch_name}) — Section ${link.section}.`);
              return (
                <div key={link.id} className="p-5 hover:bg-gray-50 transition">
                  <div className="flex items-start justify-between gap-4">
                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className="font-bold text-gray-900 text-sm">{link.degree_name} · {link.branch_name}</span>
                        <Badge color="indigo">Section {link.section}</Badge>
                        <Badge color="blue">Sem {link.current_semester}</Badge>
                        <Badge color={link.is_active ? 'green' : 'red'}>
                          {link.is_active ? '● Active' : '○ Inactive'}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 mb-2">{link.school_name} · Batch {link.batch_name}</p>

                      {/* URL row */}
                      <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 mb-2">
                        <span className="text-xs font-mono text-indigo-600 flex-1 truncate">{url}</span>
                        <CopyBtn text={url} label="URL" />
                      </div>

                      {/* Code row */}
                      <div className="flex items-center gap-2">
                        <FaKey className="text-gray-400 text-xs" />
                        <span className="text-xs text-gray-500 font-medium">Access Code:</span>
                        <span className={`font-mono font-extrabold text-sm tracking-widest transition ${showCode[link.id] ? 'text-indigo-600' : 'text-gray-300'}`}>
                          {showCode[link.id] ? link.access_code : '●●●●●●'}
                        </span>
                        <button
                          onClick={() => setShowCode(s => ({ ...s, [link.id]: !s[link.id] }))}
                          className="text-gray-400 hover:text-gray-700 transition text-xs"
                        >
                          {showCode[link.id] ? <FaEyeSlash /> : <FaEye />}
                        </button>
                        {showCode[link.id] && <CopyBtn text={link.access_code} label="Code" />}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 flex-shrink-0 items-end">
                      {/* Share */}
                      <div className="flex gap-2">
                        <a
                          href={`https://wa.me/?text=${waMsg}`}
                          target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 bg-green-50 text-green-700 rounded-lg border border-green-200 hover:bg-green-100 transition"
                        >
                          <FaWhatsapp /> WhatsApp
                        </a>
                        <a
                          href={`mailto:?subject=Join your class on CampusLearn&body=Click this link to join: ${url}%0A%0AAccess Code: ${link.access_code}`}
                          className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg border border-blue-200 hover:bg-blue-100 transition"
                        >
                          <FaEnvelope /> Email
                        </a>
                      </div>
                      {/* View enrollments */}
                      <button
                        onClick={() => setDrawerLink(link)}
                        className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-200 hover:bg-indigo-100 transition"
                      >
                        <FaUsers /> View Students
                      </button>
                      {/* Toggle + Delete */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => toggleActive(link)}
                          className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg border transition ${
                            link.is_active
                              ? 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100'
                              : 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
                          }`}
                        >
                          {link.is_active ? <FaToggleOn /> : <FaToggleOff />}
                          {link.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleDelete(link)}
                          className="text-gray-400 hover:text-red-600 hover:bg-red-50 transition p-1.5 rounded-lg border border-transparent hover:border-red-200"
                        >
                          <FaTrash className="text-xs" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── CREATE MODAL ── */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-xl font-bold text-gray-800">Generate Magic Link</h3>
                <p className="text-xs text-gray-500 mt-0.5">Create a secure enrollment link for your batch.</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-700 transition"><FaTimes className="text-xl" /></button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* School */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">🏫 School / Faculty</label>
                <select
                  value={form.schoolId}
                  onChange={e => setForm(f => ({ ...f, schoolId: e.target.value, degreeId: '', branchId: '' }))}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none"
                >
                  <option value="">Select school…</option>
                  {SCHOOLS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              {/* Degree */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">🎓 Degree / Programme</label>
                <select
                  value={form.degreeId}
                  onChange={e => setForm(f => ({ ...f, degreeId: e.target.value, branchId: '' }))}
                  disabled={!form.schoolId}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none disabled:opacity-50"
                >
                  <option value="">Select degree…</option>
                  {availDegrees.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              {/* Branch + Section + Batch row */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">⚙️ Branch</label>
                  <select
                    value={form.branchId}
                    onChange={e => setForm(f => ({ ...f, branchId: e.target.value }))}
                    disabled={!form.degreeId}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none disabled:opacity-50"
                  >
                    <option value="">Branch…</option>
                    {availBranches.map(b => <option key={b.id} value={b.id}>{b.code}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">📋 Section</label>
                  <select
                    value={form.section}
                    onChange={e => setForm(f => ({ ...f, section: e.target.value }))}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none"
                  >
                    <option value="">Sec…</option>
                    {SECTIONS.map(s => <option key={s} value={s}>Section {s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">📅 Semester</label>
                  <select
                    value={form.currentSemester}
                    onChange={e => setForm(f => ({ ...f, currentSemester: e.target.value }))}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none"
                  >
                  {[1, 2, 3, 4, ...(maxSems > 4 ? [5, 6, 7, 8] : [])].map(s => <option key={s} value={s}>Sem {s}</option>)}
                  </select>
                </div>
              </div>

              {/* Batch */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">🗓 Batch Year</label>
                <div className="grid grid-cols-2 gap-2">
                  {availBatches.map(b => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, batchId: b.id }))}
                      className={`py-2.5 rounded-xl border text-sm font-bold transition ${
                        form.batchId === b.id
                          ? 'bg-gray-900 text-white border-gray-900'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {b.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Generated Token + Code */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 space-y-3">
                <h4 className="text-sm font-bold text-indigo-800 flex items-center gap-2"><FaKey /> Security Settings</h4>

                {/* Token */}
                <div>
                  <label className="text-xs font-semibold text-indigo-600 block mb-1">URL Token (auto-generated)</label>
                  <div className="flex items-center gap-2">
                    <span className="flex-1 font-mono text-sm bg-white border border-indigo-200 rounded-lg px-3 py-2 text-indigo-800 truncate">{form.token}</span>
                    <button onClick={regenToken} className="p-2 bg-white border border-indigo-200 rounded-lg text-indigo-500 hover:bg-indigo-50 transition" title="Regenerate"><FaRedo className="text-xs" /></button>
                    <CopyBtn text={`${window.location.origin}/enroll/${form.token}`} label="URL" />
                  </div>
                </div>

                {/* Access Code */}
                <div>
                  <label className="text-xs font-semibold text-indigo-600 block mb-1">Access Code (share with students separately)</label>
                  <div className="flex items-center gap-2">
                    <span className="flex-1 font-mono text-xl font-extrabold tracking-[0.3em] bg-white border border-indigo-200 rounded-lg px-3 py-2 text-indigo-700">{form.accessCode}</span>
                    <button onClick={regenCode} className="p-2 bg-white border border-indigo-200 rounded-lg text-indigo-500 hover:bg-indigo-50 transition" title="Regenerate"><FaRedo className="text-xs" /></button>
                    <CopyBtn text={form.accessCode} label="Code" />
                  </div>
                  <p className="text-[10px] text-indigo-500 mt-1.5">⚠️ Share this code separately from the link (e.g., verbally in class, or in a separate message).</p>
                </div>
              </div>

              {/* Preview */}
              {form.branchId && form.section && form.batchId && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                  <p className="text-emerald-800 text-sm font-semibold">
                    ✅ Preview: <span className="font-bold">{chosenDegree?.name} ({chosenBranch?.name}) — Section {form.section} · {chosenBatch?.name}</span>
                  </p>
                  <p className="text-emerald-600 text-xs mt-0.5">Semester {form.currentSemester} subjects will be automatically injected for enrolled students.</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-gray-900 hover:bg-black transition flex justify-center items-center gap-2 disabled:opacity-60"
              >
                {saving ? <><div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> Saving…</> : <><FaLink /> Generate Link</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enrollment Drawer */}
      {drawerLink && <EnrollmentDrawer link={drawerLink} onClose={() => setDrawerLink(null)} />}
    </div>
  );
}
