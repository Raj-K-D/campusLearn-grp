import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../util/supabase';

const AuthContext = createContext();

// Authority hierarchy: admin > coordinator > student
export const ROLE_HIERARCHY = {
  super_admin: 4,
  admin:       4,
  coordinator: 3,
  student:     1,
};

export function AuthProvider({ children }) {
  const [user, setUser]                   = useState(null);
  const [isAdmin, setIsAdmin]             = useState(false);
  const [isCoordinator, setIsCoordinator] = useState(false);
  const [pinnedSemester, setPinnedSemesterState] = useState(null);
  const [userRoles, setUserRoles]         = useState([]);
  const [profile, setProfile]             = useState(null);
  const [loading, setLoading]             = useState(true);

  async function fetchUserProfile(userId, userEmail = null) {
    if (!userId) {
      setIsAdmin(false);
      setIsCoordinator(false);
      setPinnedSemesterState(null);
      setUserRoles([]);
      setProfile(null);
      return;
    }

    const { data: prof } = await supabase
      .from('profiles')
      .select('is_admin, is_coordinator, full_name, email, pinned_semester')
      .eq('id', userId)
      .maybeSingle();

    // Check if user has pending coordinator invite
    const emailToCheck = prof?.email || userEmail;
    let autoGrantedCoordinator = false;
    if (emailToCheck) {
      try {
        const { data: invite } = await supabase
          .from('coordinator_invites')
          .select('id, status')
          .ilike('email', emailToCheck)
          .eq('status', 'pending')
          .maybeSingle();
        if (invite) {
          await supabase.from('profiles').update({ is_coordinator: true }).eq('id', userId);
          await supabase.from('user_roles').upsert([{ user_id: userId, role: 'coordinator' }], { onConflict: 'user_id,role,subject_id,division_id' });
          await supabase.from('coordinator_invites').update({ status: 'accepted' }).eq('id', invite.id);
          autoGrantedCoordinator = true;
        }
      } catch (err) {
        console.warn('Invite check skipped:', err);
      }
    }

    // Granular role assignments (coordinator-scoped subjects)
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role, subject_id, division_id, department, subjects(title), divisions(name)')
      .eq('user_id', userId);

    const hasCoordRole = autoGrantedCoordinator || prof?.is_coordinator === true || (roles || []).some(r => r.role === 'coordinator');

    setProfile(prof || null);
    setIsAdmin(prof?.is_admin === true);
    setIsCoordinator(hasCoordRole);
    setPinnedSemesterState(prof?.pinned_semester || null);
    setUserRoles(roles || []);
  }

  async function updateProfile(fields) {
    if (!user) return;
    await supabase.from('profiles').update(fields).eq('id', user.id);
    await fetchUserProfile(user.id, user.email);
  }

  async function setPinnedSemester(sem) {
    setPinnedSemesterState(sem);
    await supabase.from('profiles').update({ pinned_semester: sem }).eq('id', user.id);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      fetchUserProfile(u?.id, u?.email).finally(() => setLoading(false));
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      fetchUserProfile(u?.id, u?.email);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Permission Helpers ─────────────────────────────────────

  /** True if user is faculty (coordinator or admin) */
  function isFaculty() {
    return isAdmin || isCoordinator;
  }

  /** True if coordinator manages this subject directly */
  function isCoordinatorOf(subjectId) {
    if (isAdmin) return true;
    return userRoles.some(
      r => r.role === 'coordinator' && String(r.subject_id) === String(subjectId)
    );
  }

  /** Coordinators always have elevated access for their subjects */
  function hasElevatedResourceAccess(subjectId) {
    return isAdmin || isCoordinatorOf(subjectId);
  }

  /** Check specific role assignment */
  function hasRole(role, subjectId = null, divisionId = null) {
    if (isAdmin) return true;
    return userRoles.some(r => {
      if (r.role !== role) return false;
      if (subjectId && String(r.subject_id) !== String(subjectId)) return false;
      if (divisionId && String(r.division_id) !== String(divisionId)) return false;
      return true;
    });
  }

  /** Get highest-authority portal */
  function getPrimaryPortal() {
    if (isAdmin) return '/admin';
    if (isCoordinator) return '/coordinator';
    return '/dashboard';
  }

  /** Subjects this coordinator owns */
  function getCoordinatorSubjects() {
    return userRoles
      .filter(r => r.role === 'coordinator')
      .map(r => ({ ...r.subjects, id: r.subject_id }))
      .filter(s => s.id);
  }

  const value = {
    signUp:  (data) => supabase.auth.signUp(data),
    signIn:  (data) => supabase.auth.signInWithPassword(data),
    signOut: () => supabase.auth.signOut(),
    requestPasswordReset: (email) => supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    }),
    updatePassword: (password) => supabase.auth.updateUser({ password }),
    user,
    profile,
    isAdmin,
    isCoordinator,
    pinnedSemester,
    setPinnedSemester,
    userRoles,
    // Helpers
    hasRole,
    isFaculty,
    hasElevatedResourceAccess,
    isCoordinatorOf,
    getPrimaryPortal,
    getCoordinatorSubjects,
    updateProfile,
    refreshProfile: () => fetchUserProfile(user?.id),
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);