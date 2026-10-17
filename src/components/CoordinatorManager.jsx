import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../util/supabase';
import { 
  FaPlus, FaTrash, FaUserTie, FaTimes, FaBook, 
  FaEnvelope, FaInfoCircle, FaCheckCircle, FaLayerGroup,
  FaArrowRight, FaCheck, FaExclamationTriangle
} from 'react-icons/fa';

export default function CoordinatorManager({ subjects = [], resourceCounts = {}, showToast }) {
  const [coordinators, setCoordinators] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [localResourceCounts, setLocalResourceCounts] = useState({});
  const [localSubjects, setLocalSubjects] = useState([]);

  // Add Coordinator Form state (Step 1: Subject -> Step 2: Coordinator)
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [addMode, setAddMode] = useState('email'); // 'email' | 'existing'
  const [coordinatorEmail, setCoordinatorEmail] = useState('');
  const [selectedCoordinatorId, setSelectedCoordinatorId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Modal assign form (for quick assign button or table action)
  const [assignModalForm, setAssignModalForm] = useState({ subject_id: '', coordinator_id: '' });
  const [showAssignModal, setShowAssignModal] = useState(false);

  // Combine parent subjects and local subjects if needed
  const allSubjects = subjects && subjects.length > 0 ? subjects : localSubjects;

  // Combine resource counts from props and local fetch
  const mergedResourceCounts = useMemo(() => {
    return { ...resourceCounts, ...localResourceCounts };
  }, [resourceCounts, localResourceCounts]);

  // All subjects sorted: subjects with resources first, then all remaining subjects
  const sortedSubjects = useMemo(() => {
    return [...allSubjects].sort((a, b) => {
      const countA = mergedResourceCounts[a.id] || 0;
      const countB = mergedResourceCounts[b.id] || 0;
      if (countB !== countA) return countB - countA;
      return (a.title || '').localeCompare(b.title || '');
    });
  }, [allSubjects, mergedResourceCounts]);

  async function fetchAll() {
    setLoading(true);

    try {
      // 1. Fetch resource counts directly to ensure live counts
      const { data: resData } = await supabase.from('resources').select('subject_id');
      const counts = {};
      (resData || []).forEach(r => {
        if (r.subject_id) counts[r.subject_id] = (counts[r.subject_id] || 0) + 1;
      });
      setLocalResourceCounts(counts);

      // 2. Fallback fetch subjects if not provided via props
      if (!subjects || subjects.length === 0) {
        const { data: sData } = await supabase.from('subjects').select('*').order('title');
        setLocalSubjects(sData || []);
      }

      // 3. Fetch all coordinators (query user_roles for IDs, then fetch profiles)
      const { data: rolesData, error: rolesErr } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'coordinator');

      if (rolesErr) console.warn('Error fetching coordinator roles:', rolesErr);

      const roleUserIds = Array.from(new Set((rolesData || []).map(r => r.user_id).filter(Boolean)));

      let fetchedProfiles = [];
      if (roleUserIds.length > 0) {
        const { data: pData } = await supabase
          .from('profiles')
          .select('id, email, full_name, is_coordinator')
          .or(`id.in.(${roleUserIds.join(',')}),is_coordinator.eq.true`);
        fetchedProfiles = pData || [];
      } else {
        const { data: pData } = await supabase
          .from('profiles')
          .select('id, email, full_name, is_coordinator')
          .eq('is_coordinator', true);
        fetchedProfiles = pData || [];
      }
      setCoordinators(fetchedProfiles);

      // 4. Fetch all subject assignments
      const { data: tas, error: tasErr } = await supabase
        .from('coordinator_subjects')
        .select('id, coordinator_id, subject_id, subjects(id, title, branch, semester)')
        .order('assigned_at', { ascending: false });

      if (tasErr) console.warn('Error fetching coordinator subjects:', tasErr);

      // Map profiles onto assignments
      const profileMap = new Map(fetchedProfiles.map(p => [p.id, p]));
      const mappedAssignments = (tas || []).map(a => ({
        ...a,
        profiles: profileMap.get(a.coordinator_id) || { email: 'Unknown', full_name: 'Coordinator' },
      }));
      setAssignments(mappedAssignments);

      // 5. Fetch pending invites
      try {
        const { data: invites } = await supabase
          .from('coordinator_invites')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: false });
        setPendingInvites(invites || []);
      } catch (e) {
        setPendingInvites([]);
      }
    } catch (err) {
      console.error('Error fetching coordinator manager data:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
  }, []);

  // Selected subject object for UI summary
  const currentSelectedSubject = useMemo(() => {
    if (!selectedSubjectId) return null;
    return allSubjects.find(s => String(s.id) === String(selectedSubjectId));
  }, [selectedSubjectId, allSubjects]);

  // Existing assignments for currently selected subject
  const currentSubjectAssignments = useMemo(() => {
    if (!selectedSubjectId) return [];
    return assignments.filter(a => String(a.subject_id) === String(selectedSubjectId));
  }, [selectedSubjectId, assignments]);

  /**
   * Primary action: First select subject, then add coordinator to that subject.
   */
  async function handleAddCoordinator(e) {
    e.preventDefault();
    if (!selectedSubjectId) {
      showToast('Please select a subject first.', 'error');
      return;
    }

    setSubmitting(true);
    const subObj = currentSelectedSubject;
    const subName = subObj ? `${subObj.title} (${subObj.branch || 'CS'})` : 'selected subject';
    const parsedSubId = isNaN(selectedSubjectId) ? selectedSubjectId : parseInt(selectedSubjectId, 10);

    try {
      if (addMode === 'existing') {
        // --- Option A: Assign an existing coordinator to this subject ---
        if (!selectedCoordinatorId) {
          showToast('Please select an existing coordinator.', 'error');
          setSubmitting(false);
          return;
        }

        // Check if already assigned
        const isAlreadyAssigned = assignments.some(
          a => String(a.coordinator_id) === String(selectedCoordinatorId) && String(a.subject_id) === String(parsedSubId)
        );
        if (isAlreadyAssigned) {
          showToast('This coordinator is already assigned to this subject.', 'error');
          setSubmitting(false);
          return;
        }

        const { error: assignErr } = await supabase.from('coordinator_subjects').insert([{
          coordinator_id: selectedCoordinatorId,
          subject_id: parsedSubId,
        }]);

        if (assignErr) throw assignErr;

        // Ensure user_roles has coordinator role
        const { data: existingRole } = await supabase
          .from('user_roles')
          .select('id')
          .eq('user_id', selectedCoordinatorId)
          .eq('role', 'coordinator')
          .eq('subject_id', parsedSubId)
          .maybeSingle();

        if (!existingRole) {
          await supabase.from('user_roles').insert([{
            user_id: selectedCoordinatorId,
            role: 'coordinator',
            subject_id: parsedSubId,
          }]);
        }

        await supabase.from('profiles').update({ is_coordinator: true }).eq('id', selectedCoordinatorId);

        showToast(`✅ Coordinator successfully assigned to ${subName}!`);
        setSelectedCoordinatorId('');
      } else {
        // --- Option B: Invite / Add coordinator by email to this subject ---
        const email = coordinatorEmail.trim().toLowerCase();
        if (!email) {
          showToast('Please enter a valid email address.', 'error');
          setSubmitting(false);
          return;
        }

        // Check if user already exists in profiles
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .ilike('email', email)
          .maybeSingle();

        if (profile) {
          // Grant coordinator role
          await supabase.from('profiles').update({ is_coordinator: true }).eq('id', profile.id);

          // Assign to the selected subject
          const { data: existingAssign } = await supabase
            .from('coordinator_subjects')
            .select('id')
            .eq('coordinator_id', profile.id)
            .eq('subject_id', parsedSubId)
            .maybeSingle();

          if (!existingAssign) {
            const { error: assignErr } = await supabase.from('coordinator_subjects').insert([{
              coordinator_id: profile.id,
              subject_id: parsedSubId,
            }]);
            if (assignErr) throw assignErr;
          }

          const { data: existingRole } = await supabase
            .from('user_roles')
            .select('id')
            .eq('user_id', profile.id)
            .eq('role', 'coordinator')
            .eq('subject_id', parsedSubId)
            .maybeSingle();

          if (!existingRole) {
            await supabase.from('user_roles').insert([{
              user_id: profile.id,
              role: 'coordinator',
              subject_id: parsedSubId,
            }]);
          }

          showToast(`✅ ${profile.full_name || email} is now Coordinator for ${subName}!`);
        } else {
          // User hasn't registered yet — save pending invite pre-assigned to this subject
          try {
            await supabase.from('coordinator_invites').upsert([{
              email,
              status: 'pending',
              invited_at: new Date().toISOString(),
              subject_ids: [parsedSubId],
            }], { onConflict: 'email' });
            showToast(`📧 Invite saved for ${email} for ${subName}. Access activates when they sign up!`, 'info');
          } catch (err) {
            showToast(`⚠️ No account found for ${email}. Please ask them to sign up first.`, 'error');
          }
        }

        setCoordinatorEmail('');
      }
    } catch (err) {
      console.error('Error adding coordinator:', err);
      showToast('Operation failed: ' + err.message, 'error');
    } finally {
      setSubmitting(false);
      fetchAll();
    }
  }

  /**
   * Modal quick assign: Assign coordinator to subject
   */
  async function handleModalAssign(e) {
    e.preventDefault();
    const { coordinator_id, subject_id } = assignModalForm;
    if (!coordinator_id || !subject_id) {
      showToast('Please select both a subject and coordinator.', 'error');
      return;
    }

    const parsedSubId = isNaN(subject_id) ? subject_id : parseInt(subject_id, 10);

    const existing = assignments.find(
      a => String(a.coordinator_id) === String(coordinator_id) && String(a.subject_id) === String(parsedSubId)
    );
    if (existing) {
      showToast('This coordinator is already assigned to that subject.', 'error');
      return;
    }

    const { error: assignErr } = await supabase.from('coordinator_subjects').insert([{
      coordinator_id,
      subject_id: parsedSubId,
    }]);

    if (assignErr) {
      showToast(assignErr.message, 'error');
      return;
    }

    const { data: existingRole } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', coordinator_id)
      .eq('role', 'coordinator')
      .eq('subject_id', parsedSubId)
      .maybeSingle();

    if (!existingRole) {
      await supabase.from('user_roles').insert([{
        user_id: coordinator_id,
        role: 'coordinator',
        subject_id: parsedSubId,
      }]);
    }

    await supabase.from('profiles').update({ is_coordinator: true }).eq('id', coordinator_id);

    showToast('Coordinator assigned to subject ✅');
    setAssignModalForm({ coordinator_id: '', subject_id: '' });
    setShowAssignModal(false);
    fetchAll();
  }

  // Remove subject assignment
  async function handleRemoveAssignment(id, coordinator_id, subject_id) {
    if (!window.confirm('Remove this subject from coordinator?')) return;
    const parsedSubId = isNaN(subject_id) ? subject_id : parseInt(subject_id, 10);
    await supabase.from('coordinator_subjects').delete().eq('id', id);
    await supabase.from('user_roles').delete()
      .eq('user_id', coordinator_id)
      .eq('role', 'coordinator')
      .eq('subject_id', parsedSubId);
    showToast('Assignment removed');
    fetchAll();
  }

  // Revoke coordinator role entirely
  async function handleRemoveRole(id, email) {
    if (!window.confirm(`Remove ALL coordinator access and subject assignments from ${email}?`)) return;
    await supabase.from('profiles').update({ is_coordinator: false }).eq('id', id);
    await supabase.from('user_roles').delete().eq('user_id', id).eq('role', 'coordinator');
    await supabase.from('coordinator_subjects').delete().eq('coordinator_id', id);
    showToast('Coordinator role and assignments removed');
    fetchAll();
  }

  return (
    <div className="animate-fade-in-up space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl bg-purple-50 text-purple-600">
            <FaUserTie />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase">Coordinators</p>
            <p className="text-2xl font-extrabold text-gray-900">{coordinators.length}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl bg-blue-50 text-blue-600">
            <FaBook />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase">Subject Assignments</p>
            <p className="text-2xl font-extrabold text-gray-900">{assignments.length}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl bg-emerald-50 text-emerald-600">
            <FaLayerGroup />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase">Available Subjects</p>
            <p className="text-2xl font-extrabold text-emerald-600">{sortedSubjects.length}</p>
          </div>
        </div>
      </div>

      {/* PRIMARY SECTION: FIRST SELECT SUBJECT, THEN ADD COORDINATOR TO THAT SUBJECT */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-gradient-to-r from-purple-50 to-indigo-50/30 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
          <div>
            <h3 className="font-extrabold text-gray-900 flex items-center gap-2 text-base">
              <FaUserTie className="text-purple-600" /> Appoint Coordinator to Subject
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Select any subject in the curriculum, then appoint or invite its faculty coordinator.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs bg-purple-100 text-purple-700 font-bold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
              <FaBook className="text-[11px]" /> {sortedSubjects.length} subjects available
            </span>
          </div>
        </div>

        <form onSubmit={handleAddCoordinator} className="p-6 space-y-6">
          {/* STEP 1: FIRST SELECT SUBJECT */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-800 uppercase tracking-wide flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[11px] font-extrabold">
                  1
                </span>
                First: Select Subject
                <span className="text-purple-600 font-semibold normal-case text-xs">
                  (Choose any subject to appoint its coordinator)
                </span>
              </label>
              <span className="text-[11px] text-gray-500 font-medium">
                {sortedSubjects.length} subjects
              </span>
            </div>

            <div className="relative">
              <select
                required
                value={selectedSubjectId}
                onChange={e => setSelectedSubjectId(e.target.value)}
                className="w-full p-3.5 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-sm font-semibold text-gray-900 transition"
              >
                <option value="">-- Choose a Subject --</option>
                {sortedSubjects.map(s => {
                  const count = mergedResourceCounts[s.id] || (s.resources ? s.resources.length : 0);
                  return (
                    <option key={s.id} value={s.id}>
                      {s.title} ({s.branch || 'CS'} · Sem {s.semester || '4'}) — {count} resources
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Subject Status Card when selected */}
            {currentSelectedSubject ? (
              <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center font-bold text-xs">
                    <FaBook />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-purple-950">
                      {currentSelectedSubject.title}
                    </p>
                    <p className="text-xs text-purple-700">
                      Branch: <strong>{currentSelectedSubject.branch || 'CS'}</strong> • Semester: <strong>{currentSelectedSubject.semester || '4'}</strong> • <strong>{mergedResourceCounts[currentSelectedSubject.id] || 0} resources</strong> online
                    </p>
                  </div>
                </div>

                <div className="text-xs">
                  {currentSubjectAssignments.length > 0 ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                      <FaCheck className="text-[10px]" />
                      Coordinator: {currentSubjectAssignments.map(a => a.profiles?.full_name || a.profiles?.email).join(', ')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-bold">
                      <FaExclamationTriangle className="text-[10px]" />
                      No coordinator assigned yet
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">
                💡 Select a subject above to appoint its faculty coordinator.
              </p>
            )}
          </div>

          <hr className="border-gray-100" />

          {/* STEP 2: THEN ADD COORDINATOR TO THAT SUBJECT */}
          <div className={`space-y-4 transition ${selectedSubjectId ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-bold text-gray-800 uppercase tracking-wide flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[11px] font-extrabold">
                  2
                </span>
                Then: Appoint Coordinator for {currentSelectedSubject ? `"${currentSelectedSubject.title}"` : 'Selected Subject'}
              </label>

              {/* Toggle: Invite by Email vs Select Existing Coordinator */}
              <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-bold self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setAddMode('email')}
                  className={`px-3 py-1.5 rounded-lg transition ${addMode === 'email' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                >
                  <FaEnvelope className="inline mr-1.5 text-[11px]" /> Enter Email (New / Any)
                </button>
                <button
                  type="button"
                  onClick={() => setAddMode('existing')}
                  disabled={coordinators.length === 0}
                  className={`px-3 py-1.5 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed ${addMode === 'existing' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                >
                  <FaUserTie className="inline mr-1.5 text-[11px]" /> Existing Coordinator ({coordinators.length})
                </button>
              </div>
            </div>

            {addMode === 'email' ? (
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <FaEnvelope className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                  <input
                    type="email"
                    required={addMode === 'email'}
                    placeholder="coordinator@gmail.com"
                    value={coordinatorEmail}
                    onChange={e => setCoordinatorEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 text-gray-900 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-sm transition"
                  />
                </div>
                <button
                  disabled={submitting || !selectedSubjectId}
                  type="submit"
                  className="flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 transition shadow-md shadow-purple-200 whitespace-nowrap text-sm"
                >
                  {submitting ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Appointing...</>
                  ) : (
                    <><FaCheckCircle /> Appoint Coordinator</>
                  )}
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <select
                    required={addMode === 'existing'}
                    value={selectedCoordinatorId}
                    onChange={e => setSelectedCoordinatorId(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-sm text-gray-900"
                  >
                    <option value="">-- Choose existing coordinator --</option>
                    {coordinators.map(c => {
                      const managed = assignments.filter(a => a.coordinator_id === c.id);
                      return (
                        <option key={c.id} value={c.id}>
                          {c.full_name || c.email} ({managed.length} subjects currently managed)
                        </option>
                      );
                    })}
                  </select>
                </div>
                <button
                  disabled={submitting || !selectedSubjectId || !selectedCoordinatorId}
                  type="submit"
                  className="flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 transition shadow-md shadow-purple-200 whitespace-nowrap text-sm"
                >
                  {submitting ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Assigning...</>
                  ) : (
                    <><FaCheckCircle /> Assign Coordinator</>
                  )}
                </button>
              </div>
            )}

            <p className="text-xs text-gray-500 flex items-center gap-1.5">
              <FaInfoCircle className="text-purple-500 shrink-0" />
              <span>
                {addMode === 'email'
                  ? 'If user is already registered, coordinator access to this subject is granted immediately. If not yet registered, it auto-activates upon signup!'
                  : 'Assigns this existing coordinator to also manage the selected subject.'}
              </span>
            </p>
          </div>
        </form>
      </div>

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <div className="bg-amber-50 rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-amber-200 flex justify-between items-center">
            <div>
              <h3 className="font-extrabold text-amber-800 flex items-center gap-2">
                <FaInfoCircle /> Pending Coordinator Invites ({pendingInvites.length})
              </h3>
              <p className="text-xs text-amber-700 mt-0.5">These people will become coordinators when they sign up.</p>
            </div>
          </div>
          <div className="divide-y divide-amber-100">
            {pendingInvites.map(inv => (
              <div key={inv.id || inv.email} className="px-6 py-3 flex justify-between items-center">
                <div>
                  <span className="text-sm font-semibold text-amber-900">{inv.email}</span>
                  {inv.subject_ids && inv.subject_ids.length > 0 && (
                    <span className="text-xs text-amber-700 ml-2">
                      ({inv.subject_ids.length} subject pre-assigned)
                    </span>
                  )}
                </div>
                <span className="text-[10px] bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                  Pending Signup
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Coordinator Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <div>
            <h3 className="font-extrabold text-gray-900">All Appointed Coordinators ({coordinators.length})</h3>
            <p className="text-xs text-gray-500 mt-0.5">Faculty members managing subject content and permissions.</p>
          </div>
          <button
            onClick={() => {
              setAssignModalForm({ subject_id: selectedSubjectId || '', coordinator_id: '' });
              setShowAssignModal(true);
            }}
            disabled={coordinators.length === 0 || sortedSubjects.length === 0}
            className="flex items-center gap-2 bg-purple-50 text-purple-700 hover:bg-purple-100 px-3.5 py-1.5 rounded-xl font-bold text-xs disabled:opacity-50 transition border border-purple-200"
          >
            <FaPlus /> Quick Assign
          </button>
        </div>

        {loading ? (
          <div className="p-10 text-center text-gray-400">Loading coordinators...</div>
        ) : coordinators.length === 0 ? (
          <div className="p-10 text-center">
            <FaUserTie className="text-4xl text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm font-semibold">No coordinators appointed yet.</p>
            <p className="text-gray-400 text-xs mt-1">Select a subject with resources above and appoint a coordinator.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-bold border-b">
                <tr>
                  <th className="px-6 py-4">Coordinator</th>
                  <th className="px-6 py-4">Managed Subjects with Resources</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {coordinators.map(c => {
                  const myAssigns = assignments.filter(a => a.coordinator_id === c.id);
                  return (
                    <tr key={c.id} className="hover:bg-gray-50 transition">
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
                            <span className="text-xs text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full font-medium italic">
                              No subject assigned yet
                            </span>
                          ) : (
                            myAssigns.map(a => {
                              const sObj = a.subjects;
                              const resCount = mergedResourceCounts[a.subject_id] || 0;
                              return (
                                <span
                                  key={a.id}
                                  className="text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-1 rounded-full flex items-center gap-1.5"
                                >
                                  <FaBook className="text-[10px] text-purple-400" />
                                  {sObj?.title || `Subject #${a.subject_id}`}
                                  {resCount > 0 && (
                                    <span className="text-[10px] bg-purple-200/70 text-purple-800 px-1.5 py-0.2 rounded-full font-extrabold">
                                      {resCount} res
                                    </span>
                                  )}
                                  <button
                                    onClick={() => handleRemoveAssignment(a.id, c.id, a.subject_id)}
                                    className="hover:text-red-600 ml-1 text-sm font-extrabold"
                                    title="Remove this subject assignment"
                                  >
                                    ×
                                  </button>
                                </span>
                              );
                            })
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => {
                            setAssignModalForm({ coordinator_id: c.id, subject_id: selectedSubjectId || '' });
                            setShowAssignModal(true);
                          }}
                          className="text-gray-400 hover:text-purple-600 p-2 rounded-lg transition mr-1"
                          title="Assign to another subject"
                        >
                          <FaPlus />
                        </button>
                        <button
                          onClick={() => handleRemoveRole(c.id, c.email)}
                          className="text-gray-400 hover:text-red-600 p-2 rounded-lg transition"
                          title="Revoke coordinator role"
                        >
                          <FaTrash />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assign Modal (Subject First -> Coordinator) */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-gray-900">Assign Subject to Coordinator</h3>
                <p className="text-xs text-gray-500">Pick a subject with resources, then select coordinator.</p>
              </div>
              <button onClick={() => setShowAssignModal(false)} className="text-gray-400 hover:text-gray-700">
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleModalAssign} className="p-6 space-y-4">
              {/* Step 1: Subject First */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  1. Subject
                </label>
                <select
                  required
                  value={assignModalForm.subject_id}
                  onChange={e => setAssignModalForm({ ...assignModalForm, subject_id: e.target.value })}
                  className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-sm font-medium"
                >
                  <option value="">-- Select Subject --</option>
                  {sortedSubjects.map(s => {
                    const count = mergedResourceCounts[s.id] || 0;
                    return (
                      <option key={s.id} value={s.id}>
                        {s.title} ({s.branch || 'CS'} · Sem {s.semester || '4'}) — {count} resources
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Step 2: Coordinator */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  2. Coordinator
                </label>
                <select
                  required
                  value={assignModalForm.coordinator_id}
                  onChange={e => setAssignModalForm({ ...assignModalForm, coordinator_id: e.target.value })}
                  className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-sm font-medium"
                >
                  <option value="">-- Select Coordinator --</option>
                  {coordinators.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.full_name || c.email} ({c.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="w-1/2 py-3 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-50 transition text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-purple-600 text-white font-bold py-3 rounded-xl hover:bg-purple-700 transition shadow-md shadow-purple-200 text-sm"
                >
                  Assign Subject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
