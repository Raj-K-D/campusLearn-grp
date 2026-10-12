-- ============================================================
-- RUN THIS IN YOUR SUPABASE SQL EDITOR
-- Enables coordinators to self-register for coordinating subjects
-- ============================================================

-- 1. Policy for user_roles: Allow authenticated users to insert their own coordinator roles
DROP POLICY IF EXISTS "Coordinators self insert roles" ON public.user_roles;
CREATE POLICY "Coordinators self insert roles" ON public.user_roles 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id AND role = 'coordinator'
);

-- 2. Policy for coordinator_subjects: Allow authenticated users to insert their own subject assignments
DROP POLICY IF EXISTS "Coordinators self insert assignments" ON public.coordinator_subjects;
CREATE POLICY "Coordinators self insert assignments" ON public.coordinator_subjects 
FOR INSERT 
WITH CHECK (
  auth.uid() = coordinator_id
);

-- ============================================================
-- VERIFICATION COMMANDS (Run to check existing policies)
-- ============================================================
SELECT policyname, tablename, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename IN ('user_roles', 'coordinator_subjects');
