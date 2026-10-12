import { useState, useEffect } from 'react';
import { supabase } from '../util/supabase';
import { FaPlus, FaTrash, FaUserTie, FaTimes, FaBook, FaEnvelope, FaInfoCircle, FaCheckCircle } from 'react-icons/fa';

export default function CoordinatorManager({ subjects, showToast }) {
  const [coordinators, setCoordinators] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pendingInvites, setPendingInvites] = useState([]);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  // Assign form
  const [assignForm, setAssignForm] = useState({ coordinator_id: '', subject_id: '' });
  const [showAssignModal, setShowAssignModal] = useState(false);

  async function fetchAll() {
    setLoading(true);

    // Fetch all users with coordinator role
    const { data: rolesData, error: rolesErr } = await supabase
      .from('user_roles')
      .select('user_id, profiles(id, email, full_name)')
      .eq('role', 'coordinator');

    if (rolesErr) console.error('Error fetching coordinator roles:', rolesErr);

    const uniqueCoordinators = [];
    const seenIds = new Set();
    if (rolesData) {
      rolesData.forEach(r => {
        if (r.profiles && !seenIds.has(r.user_id)) {
          seenIds.add(r.user_id);
          uniqueCoordinators.push(r.profiles);
        }
      });
    }
    setCoordinators(uniqueCoordinators);

    // Fetch all assignments
    const { data: tas } = await supabase
      .from('coordinator_subjects')
      .select('id, coordinator_id, subject_id, subjects(title, branch), profiles(email, full_name)')
      .order('assigned_at', { ascending: false });
    setAssignments(tas || []);

    // Fetch pending invites (coordinator_invites table if exists, else we track locally)
    try {
      const { data: invites } = await supabase
        .from('coordinator_invites')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      setPendingInvites(invites || []);
    } catch (e) {
      // Table might not exist yet
      setPendingInvites([]);
    }

    setLoading(false);
  }

  useEffect(() => { fetchAll(); }, []);

  /**
   * Invite coordinator logic:
   * 1. Check if user exists in profiles table by email
   * 2a. If YES → directly grant coordinator role via user_roles
   * 2b. If NO  → record the pending invite; when that person signs up, 
   *              the onboarding flow or a trigger can auto-assign the role.
   *              We also store it in coordinator_invites for visibility.
   */
  async function handleInvite(e) {
    e.preventDefault();
    setInviting(true);

    const email = inviteEmail.trim().toLowerCase();

    // Check if profile exists
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .ilike('email', email)
      .maybeSingle();

    if (profile) {
      // User already has an account — grant role directly
      await supabase
        .from('profiles')
        .update({ is_coordinator: true })
        .eq('id', profile.id);

      const { error: rolesError } = await supabase
        .from('user_roles')
        .upsert([{ user_id: profile.id, role: 'coordinator' }], {
          onConflict: 'user_id,role,subject_id,division_id',
        });

      setInviting(false);
      if (rolesError) {
        showToast('Role grant failed: ' + rolesError.message, 'error');
        return;
      }
      showToast(`✅ ${email} has been granted Coordinator access!`);
    } else {
      // User hasn't signed up yet — record the invite
      // Try inserting into coordinator_invites table
      try {
        await supabase.from('coordinator_invites').upsert([{
          email,
          status: 'pending',
          invited_at: new Date().toISOString(),
        }], { onConflict: 'email' });
        showToast(`📧 Invite recorded for ${email}. They'll get coordinator access when they sign up.`, 'info');
      } catch (err) {
        // Fallback: just inform admin
        showToast(`⚠️ No account found for ${email}. Ask them to sign up at CampusLearn first, then invite again.`, 'error');
      }
    }

    setInviteEmail('');
    fetchAll();
  }

  // Assign coordinator to a subject
  async function handleAssign(e) {
    e.preventDefault();

    // Check for duplicate
    const existing = assignments.find(
      a => a.coordinator_id === assignForm.coordinator_id && a.subject_id === assignForm.subject_id
    );
    if (existing) {
      showToast('This coordinator is already assigned to that subject.', 'error');
      return;
    }

    const { error } = await supabase.from('coordinator_subjects').insert([{
      coordinator_id: assignForm.coordinator_id,
      subject_id: assignForm.subject_id,
    }]);

    // Also upsert into user_roles for fine-grained permission checks
    await supabase.from('user_roles').upsert([{
      user_id: assignForm.coordinator_id,
      role: 'coordinator',
      subject_id: assignForm.subject_id,
    }], { onConflict: 'user_id,role,subject_id,division_id' });

    if (error) { showToast(error.message, 'error'); return; }
    showToast('Coordinator assigned to subject ✅');
    setAssignForm({ coordinator_id: '', subject_id: '' });
    setShowAssignModal(false);
    fetchAll();
  }

  // Remove subject assignment
  async function handleRemoveAssignment(id, coordinator_id, subject_id) {
    if (!window.confirm('Remove this subject from coordinator?')) return;
    await supabase.from('coordinator_subjects').delete().eq('id', id);
    await supabase.from('user_roles').delete()
      .match({ user_id: coordinator_id, role: 'coordinator', subject_id });
    showToast('Assignment removed');
    fetchAll();
  }

  // Revoke coordinator role entirely
  async function handleRemoveRole(id, email) {
    if (!window.confirm(`Remove ALL coordinator access from ${email}?`)) return;
    await supabase.from('profiles').update({ is_coordinator: false }).eq('id', id);
    await supabase.from('user_roles').delete().eq('user_id', id).eq('role', 'coordinator');
    await supabase.from('coordinator_subjects').delete().eq('coordinator_id', id);
    showToast('Coordinator role removed');
    fetchAll();
  }

  return (
    <div className="animate-fade-in-up space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl bg-purple-50 text-purple-600"><FaUserTie /></div>
          <div><p className="text-xs font-bold text-gray-500 uppercase">Coordinators</p><p className="text-2xl font-extrabold text-gray-900">{coordinators.length}</p></div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl bg-blue-50 text-blue-600"><FaBook /></div>
          <div><p className="text-xs font-bold text-gray-500 uppercase">Subject Assignments</p><p className="text-2xl font-extrabold text-gray-900">{assignments.length}</p></div>
        </div>
      </div>

      {/* Action Button */}
      <div className="flex gap-3">
        <button
          onClick={() => setShowAssignModal(true)}
          disabled={coordinators.length === 0}
          className="flex items-center gap-2 bg-purple-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-md shadow-purple-200"
        >
          <FaPlus /> Assign Coordinator to Subject
        </button>
      </div>

      {/* Invite Section */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-gradient-to-r from-purple-50 to-white">
          <h3 className="font-extrabold text-gray-900 flex items-center gap-2">
            <FaEnvelope className="text-purple-500" /> Invite Subject Coordinator
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Normal email addresses (e.g. <strong>coordinator@gmail.com</strong>) are fully supported. If they already have a CampusLearn account, they'll get instant access. If they haven't registered yet, their coordinator role activates automatically upon signup!
          </p>
        </div>
        <form onSubmit={handleInvite} className="p-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <FaEnvelope className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
              <input
                type="email"
                required
                placeholder="coordinator@gmail.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 text-gray-900 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 transition"
              />
            </div>
            <button
              disabled={inviting}
              type="submit"
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 transition shadow-md shadow-purple-200 whitespace-nowrap"
            >
              {inviting ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Granting Access...</>
              ) : (
                <><FaCheckCircle /> Grant Coordinator Role</>
              )}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
            💡 <span>Tip: Accepts any valid email address (@gmail.com, outlook, etc.).</span>
          </p>
        </form>
      </div>

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <div className="bg-amber-50 rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-amber-200">
            <h3 className="font-extrabold text-amber-800 flex items-center gap-2">
              <FaInfoCircle /> Pending Invites ({pendingInvites.length})
            </h3>
            <p className="text-xs text-amber-700 mt-0.5">These people will become coordinators when they sign up.</p>
          </div>
          <div className="divide-y divide-amber-100">
            {pendingInvites.map(inv => (
              <div key={inv.id} className="px-6 py-3 flex justify-between items-center">
                <span className="text-sm font-medium text-amber-900">{inv.email}</span>
                <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-bold uppercase">Pending</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Coordinator Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h3 className="font-extrabold text-gray-900">All Coordinators ({coordinators.length})</h3>
        </div>
        {loading ? (
          <div className="p-10 text-center text-gray-400">Loading...</div>
        ) : coordinators.length === 0 ? (
          <div className="p-10 text-center">
            <FaUserTie className="text-4xl text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No coordinators yet. Invite one above.</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-bold border-b">
              <tr>
                <th className="px-6 py-4">Coordinator</th>
                <th className="px-6 py-4">Managed Subjects</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {coordinators.map(c => {
                const myAssigns = assignments.filter(a => a.coordinator_id === c.id);
                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center font-extrabold text-sm">
                          {(c.full_name || c.email || 'C').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{c.full_name || '—'}</p>
                          <p className="text-xs text-gray-400">{c.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {myAssigns.length === 0 ? (
                          <span className="text-xs text-gray-400 italic">No subjects assigned yet</span>
                        ) : myAssigns.map(a => (
                          <span key={a.id} className="text-[10px] font-bold bg-purple-50 text-purple-700 px-2 py-1 rounded-full flex items-center gap-1">
                            {a.subjects?.title}
                            <button onClick={() => handleRemoveAssignment(a.id, c.id, a.subject_id)} className="hover:text-red-600 ml-0.5" title="Remove assignment">×</button>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => { setAssignForm({ coordinator_id: c.id, subject_id: '' }); setShowAssignModal(true); }}
                        className="text-gray-400 hover:text-purple-600 p-2 rounded-lg transition mr-1"
                        title="Assign to subject"
                      >
                        <FaPlus />
                      </button>
                      <button onClick={() => handleRemoveRole(c.id, c.email)} className="text-gray-400 hover:text-red-600 p-2 rounded-lg transition" title="Remove coordinator role">
                        <FaTrash />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b flex justify-between items-center">
              <h3 className="font-extrabold text-gray-900">Assign Subject to Coordinator</h3>
              <button onClick={() => setShowAssignModal(false)}><FaTimes className="text-gray-400" /></button>
            </div>
            <form onSubmit={handleAssign} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Coordinator</label>
                <select
                  required
                  value={assignForm.coordinator_id}
                  onChange={e => setAssignForm({ ...assignForm, coordinator_id: e.target.value })}
                  className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select coordinator…</option>
                  {coordinators.map(c => (
                    <option key={c.id} value={c.id}>{c.full_name || c.email}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Subject</label>
                <select
                  required
                  value={assignForm.subject_id}
                  onChange={e => setAssignForm({ ...assignForm, subject_id: e.target.value })}
                  className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select subject…</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.title} ({s.branch})</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="w-full bg-purple-600 text-white font-bold py-3 rounded-xl hover:bg-purple-700 transition">
                Assign Subject
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
