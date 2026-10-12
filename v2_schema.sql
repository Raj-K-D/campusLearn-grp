-- ============================================================
-- CAMPUSLEARN v2 — Phase 1 Schema Patch
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Add pinned_semester to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS pinned_semester TEXT;

-- 2. Add TA paper fields to faculty_workspace
ALTER TABLE faculty_workspace
  ADD COLUMN IF NOT EXISTS sub_type TEXT
    CHECK (sub_type IN ('TA1', 'TA2')),
  ADD COLUMN IF NOT EXISTS resource_url TEXT,
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved'));

-- 3. Update faculty_workspace RLS — block students entirely
DROP POLICY IF EXISTS "faculty_workspace_restricted_read" ON faculty_workspace;
CREATE POLICY "faculty_workspace_restricted_read" ON faculty_workspace FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid()
      AND (is_admin = TRUE OR is_coordinator = TRUE OR is_teacher = TRUE)
    )
  );

DROP POLICY IF EXISTS "faculty_workspace_write" ON faculty_workspace;
CREATE POLICY "faculty_workspace_write" ON faculty_workspace FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid()
      AND (is_admin = TRUE OR is_coordinator = TRUE OR is_teacher = TRUE)
    )
  );

DROP POLICY IF EXISTS "faculty_workspace_update_own" ON faculty_workspace;
CREATE POLICY "faculty_workspace_update_own" ON faculty_workspace FOR UPDATE
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid()
      AND (is_admin = TRUE OR is_coordinator = TRUE)
    )
  );

DROP POLICY IF EXISTS "faculty_workspace_delete" ON faculty_workspace;
CREATE POLICY "faculty_workspace_delete" ON faculty_workspace FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
      AND (is_admin = TRUE OR is_coordinator = TRUE))
    OR (author_id = auth.uid() AND approval_status = 'pending')
  );

-- 4. teacher_resource_permissions table
CREATE TABLE IF NOT EXISTS teacher_resource_permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id  BIGINT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  granted_by  UUID REFERENCES auth.users(id),
  granted_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teacher_id, subject_id)
);

ALTER TABLE teacher_resource_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trp_read" ON teacher_resource_permissions;
CREATE POLICY "trp_read" ON teacher_resource_permissions FOR SELECT
  USING (
    teacher_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
      AND (is_admin = TRUE OR is_coordinator = TRUE))
  );

DROP POLICY IF EXISTS "trp_coord_write" ON teacher_resource_permissions;
CREATE POLICY "trp_coord_write" ON teacher_resource_permissions FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
      AND (is_admin = TRUE OR is_coordinator = TRUE))
  );

DROP POLICY IF EXISTS "trp_coord_delete" ON teacher_resource_permissions;
CREATE POLICY "trp_coord_delete" ON teacher_resource_permissions FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
      AND (is_admin = TRUE OR is_coordinator = TRUE))
  );

-- 5. Update resources RLS — include elevated teachers
DROP POLICY IF EXISTS "coordinator_can_update_subject_resources" ON resources;
CREATE POLICY "coordinator_can_update_subject_resources" ON resources FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
    OR EXISTS (SELECT 1 FROM coordinator_subjects
               WHERE coordinator_id = auth.uid() AND subject_id = resources.subject_id)
    OR uploaded_by = auth.uid()
    OR EXISTS (SELECT 1 FROM teacher_resource_permissions
               WHERE teacher_id = auth.uid() AND subject_id = resources.subject_id)
  );

DROP POLICY IF EXISTS "elevated_teacher_can_delete_resources" ON resources;
CREATE POLICY "elevated_teacher_can_delete_resources" ON resources FOR DELETE
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
    OR EXISTS (SELECT 1 FROM coordinator_subjects
               WHERE coordinator_id = auth.uid() AND subject_id = resources.subject_id)
    OR EXISTS (SELECT 1 FROM teacher_resource_permissions
               WHERE teacher_id = auth.uid() AND subject_id = resources.subject_id)
  );

-- 6. modification_requests table
CREATE TABLE IF NOT EXISTS modification_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  requester_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_table      TEXT NOT NULL
    CHECK (target_table IN ('resources', 'subjects', 'subject_timeline')),
  target_id         TEXT NOT NULL,
  proposed_changes  JSONB NOT NULL,
  original_snapshot JSONB,
  status            TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewer_id       UUID REFERENCES auth.users(id),
  reviewed_at       TIMESTAMPTZ,
  reviewer_notes    TEXT
);

ALTER TABLE modification_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mr_insert" ON modification_requests;
CREATE POLICY "mr_insert" ON modification_requests FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

DROP POLICY IF EXISTS "mr_read" ON modification_requests;
CREATE POLICY "mr_read" ON modification_requests FOR SELECT
  USING (
    auth.uid() = requester_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
      AND (is_coordinator = TRUE OR is_admin = TRUE))
  );

DROP POLICY IF EXISTS "mr_update_coord" ON modification_requests;
CREATE POLICY "mr_update_coord" ON modification_requests FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
      AND (is_coordinator = TRUE OR is_admin = TRUE))
  );

-- ============================================================
-- VERIFY
-- ============================================================
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('teacher_resource_permissions','modification_requests','faculty_workspace');
