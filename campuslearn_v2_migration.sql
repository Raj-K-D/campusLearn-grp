-- Phase 1 — SQL
-- 1a — profiles table
ALTER TABLE profiles
 ADD COLUMN IF NOT EXISTS pinned_semester TEXT;

-- 1b — faculty_workspace table (add TA paper fields)
ALTER TABLE faculty_workspace
 ADD COLUMN IF NOT EXISTS sub_type TEXT
 CHECK (sub_type IN ('TA1', 'TA2', NULL)),
 ADD COLUMN IF NOT EXISTS resource_url TEXT,
 ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending'
 CHECK (approval_status IN ('pending', 'approved'));

-- 1c — Update RLS on faculty_workspace
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

CREATE POLICY "faculty_workspace_update_own" ON faculty_workspace FOR UPDATE
 USING (
 author_id = auth.uid()
 OR EXISTS (
 SELECT 1 FROM profiles WHERE id = auth.uid()
 AND (is_admin = TRUE OR is_coordinator = TRUE)
 )
 );

CREATE POLICY "faculty_workspace_delete" ON faculty_workspace FOR DELETE
 USING (
 EXISTS (
 SELECT 1 FROM profiles WHERE id = auth.uid()
 AND (is_admin = TRUE OR is_coordinator = TRUE)
 )
 OR (author_id = auth.uid() AND approval_status = 'pending')
 );

-- 1d — teacher_resource_permissions table
CREATE TABLE IF NOT EXISTS teacher_resource_permissions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
 granted_by UUID REFERENCES auth.users(id),
 granted_at TIMESTAMPTZ DEFAULT NOW(),
 UNIQUE(teacher_id, subject_id)
);

ALTER TABLE teacher_resource_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trp_read" ON teacher_resource_permissions FOR SELECT
 USING (
 teacher_id = auth.uid()
 OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
 AND (is_admin = TRUE OR is_coordinator = TRUE))
 );

CREATE POLICY "trp_coord_write" ON teacher_resource_permissions FOR INSERT
 WITH CHECK (
 EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
 AND (is_admin = TRUE OR is_coordinator = TRUE))
 );

CREATE POLICY "trp_coord_delete" ON teacher_resource_permissions FOR DELETE
 USING (
 EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
 AND (is_admin = TRUE OR is_coordinator = TRUE))
 );

-- 1e — Update resources RLS
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

CREATE POLICY "elevated_teacher_can_delete_resources" ON resources FOR DELETE
 USING (
 uploaded_by = auth.uid()
 OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
 OR EXISTS (SELECT 1 FROM coordinator_subjects
 WHERE coordinator_id = auth.uid() AND subject_id = resources.subject_id)
 OR EXISTS (SELECT 1 FROM teacher_resource_permissions
 WHERE teacher_id = auth.uid() AND subject_id = resources.subject_id)
 );

-- 1f — modification_requests table
CREATE TABLE IF NOT EXISTS modification_requests (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 target_table TEXT NOT NULL
 CHECK (target_table IN ('resources', 'subjects', 'subject_timeline')),
 target_id TEXT NOT NULL,
 proposed_changes JSONB NOT NULL,
 original_snapshot JSONB,
 status TEXT NOT NULL DEFAULT 'pending'
 CHECK (status IN ('pending', 'approved', 'rejected')),
 reviewer_id UUID REFERENCES auth.users(id),
 reviewed_at TIMESTAMPTZ,
 reviewer_notes TEXT
);

ALTER TABLE modification_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mr_insert" ON modification_requests FOR INSERT
 WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "mr_read" ON modification_requests FOR SELECT
 USING (
 auth.uid() = requester_id
 OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
 AND (is_coordinator = TRUE OR is_admin = TRUE))
 );

CREATE POLICY "mr_update_coord" ON modification_requests FOR UPDATE
 USING (
 EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
 AND (is_coordinator = TRUE OR is_admin = TRUE))
 );
