-- ============================================================
-- FIX: Supabase 500 Error (RLS Policy Infinite Recursion)
-- Run this in Supabase SQL Editor:
-- Dashboard > SQL Editor > New Query > Paste & Run
-- ============================================================

-- 1. Create SECURITY DEFINER Helper Functions
-- (These bypass RLS internally to prevent circular dependency loops)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_coordinator()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_coordinator = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_teacher = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;


-- 2. Fix PROFILES Policies (Remove circular admin check on SELECT)
DROP POLICY IF EXISTS "Public profiles select" ON public.profiles;
DROP POLICY IF EXISTS "Admin full profile read" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin full profile update" ON public.profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;

CREATE POLICY "Public profiles select" ON public.profiles
  FOR SELECT USING (TRUE);

CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id OR public.is_admin());


-- 3. Fix USER ROLES Policies
DROP POLICY IF EXISTS "User roles read" ON public.user_roles;
DROP POLICY IF EXISTS "User roles manage" ON public.user_roles;

CREATE POLICY "User roles read" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "User roles manage" ON public.user_roles
  FOR ALL USING (public.is_admin() OR public.is_coordinator());


-- 4. Fix TEACHER ASSIGNMENTS Policies
DROP POLICY IF EXISTS "Teacher assignments read" ON public.teacher_assignments;
DROP POLICY IF EXISTS "Teacher assignments manage" ON public.teacher_assignments;

CREATE POLICY "Teacher assignments read" ON public.teacher_assignments
  FOR SELECT USING (teacher_id = auth.uid() OR public.is_admin() OR public.is_coordinator());

CREATE POLICY "Teacher assignments manage" ON public.teacher_assignments
  FOR ALL USING (public.is_admin() OR public.is_coordinator());


-- 5. Fix COORDINATOR SUBJECTS Policies
DROP POLICY IF EXISTS "Coord subjects read" ON public.coordinator_subjects;
DROP POLICY IF EXISTS "Coord subjects manage" ON public.coordinator_subjects;

CREATE POLICY "Coord subjects read" ON public.coordinator_subjects
  FOR SELECT USING (coordinator_id = auth.uid() OR public.is_admin());

CREATE POLICY "Coord subjects manage" ON public.coordinator_subjects
  FOR ALL USING (public.is_admin());


-- 6. Fix TEACHER RESOURCE PERMISSIONS Policies
DROP POLICY IF EXISTS "TRP read" ON public.teacher_resource_permissions;
DROP POLICY IF EXISTS "TRP manage" ON public.teacher_resource_permissions;

CREATE POLICY "TRP read" ON public.teacher_resource_permissions
  FOR SELECT USING (teacher_id = auth.uid() OR public.is_admin() OR public.is_coordinator());

CREATE POLICY "TRP manage" ON public.teacher_resource_permissions
  FOR ALL USING (public.is_admin() OR public.is_coordinator());


-- 7. Fix RESOURCES Policies
DROP POLICY IF EXISTS "Public resources view" ON public.resources;
DROP POLICY IF EXISTS "Authenticated resources insert" ON public.resources;
DROP POLICY IF EXISTS "Coordinator/Elevated teacher resources update" ON public.resources;
DROP POLICY IF EXISTS "Elevated teacher resources delete" ON public.resources;

CREATE POLICY "Public resources view" ON public.resources
  FOR SELECT USING (TRUE);

CREATE POLICY "Authenticated resources insert" ON public.resources
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Coordinator/Elevated teacher resources update" ON public.resources
  FOR UPDATE USING (
    uploaded_by = auth.uid()
    OR public.is_admin()
    OR EXISTS (SELECT 1 FROM public.coordinator_subjects WHERE coordinator_id = auth.uid() AND subject_id = resources.subject_id)
    OR EXISTS (SELECT 1 FROM public.teacher_resource_permissions WHERE teacher_id = auth.uid() AND subject_id = resources.subject_id)
  );

CREATE POLICY "Elevated teacher resources delete" ON public.resources
  FOR DELETE USING (
    uploaded_by = auth.uid()
    OR public.is_admin()
    OR EXISTS (SELECT 1 FROM public.coordinator_subjects WHERE coordinator_id = auth.uid() AND subject_id = resources.subject_id)
    OR EXISTS (SELECT 1 FROM public.teacher_resource_permissions WHERE teacher_id = auth.uid() AND subject_id = resources.subject_id)
  );


-- 8. Fix FACULTY WORKSPACE Policies
DROP POLICY IF EXISTS "Faculty workspace restricted read" ON public.faculty_workspace;
DROP POLICY IF EXISTS "Faculty workspace write" ON public.faculty_workspace;
DROP POLICY IF EXISTS "Faculty workspace update own" ON public.faculty_workspace;
DROP POLICY IF EXISTS "Faculty workspace delete" ON public.faculty_workspace;

CREATE POLICY "Faculty workspace restricted read" ON public.faculty_workspace
  FOR SELECT USING (public.is_admin() OR public.is_coordinator() OR public.is_teacher() OR author_id = auth.uid());

CREATE POLICY "Faculty workspace write" ON public.faculty_workspace
  FOR INSERT WITH CHECK (public.is_admin() OR public.is_coordinator() OR public.is_teacher() OR author_id = auth.uid());

CREATE POLICY "Faculty workspace update own" ON public.faculty_workspace
  FOR UPDATE USING (author_id = auth.uid() OR public.is_admin() OR public.is_coordinator());

CREATE POLICY "Faculty workspace delete" ON public.faculty_workspace
  FOR DELETE USING (author_id = auth.uid() OR public.is_admin() OR public.is_coordinator());


-- 9. Fix MODIFICATION REQUESTS Policies
DROP POLICY IF EXISTS "MR insert" ON public.modification_requests;
DROP POLICY IF EXISTS "MR read" ON public.modification_requests;
DROP POLICY IF EXISTS "MR update" ON public.modification_requests;

CREATE POLICY "MR insert" ON public.modification_requests
  FOR INSERT WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "MR read" ON public.modification_requests
  FOR SELECT USING (auth.uid() = requester_id OR public.is_coordinator() OR public.is_admin());

CREATE POLICY "MR update" ON public.modification_requests
  FOR UPDATE USING (public.is_coordinator() OR public.is_admin());
