-- ============================================================
-- CAMPUSLEARN — Phase 3: Coordinator Schema Patch
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Add is_coordinator flag to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_coordinator BOOLEAN DEFAULT FALSE;

-- 2. Create coordinator_subjects table
-- Links a coordinator to the subject(s) they manage
CREATE TABLE IF NOT EXISTS coordinator_subjects (
  id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  coordinator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subject_id     BIGINT REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
  assigned_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (coordinator_id, subject_id)
);

ALTER TABLE coordinator_subjects ENABLE ROW LEVEL SECURITY;

-- Coordinators can read their own assignments; admins see all
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='coordinator_subjects' AND policyname='coord_subjects_read') THEN
    CREATE POLICY "coord_subjects_read" ON coordinator_subjects FOR SELECT
      USING (coordinator_id = auth.uid() OR EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='coordinator_subjects' AND policyname='coord_subjects_admin_write') THEN
    CREATE POLICY "coord_subjects_admin_write" ON coordinator_subjects FOR INSERT
      WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='coordinator_subjects' AND policyname='coord_subjects_admin_delete') THEN
    CREATE POLICY "coord_subjects_admin_delete" ON coordinator_subjects FOR DELETE
      USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));
  END IF;
END $$;

-- 3. Coordinator can UPDATE resources in their subjects
--    (approve, reject, promote to official)
--    This is enforced at app layer; add RLS update policy for resources

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='resources' AND policyname='coordinator_can_update_subject_resources') THEN
    CREATE POLICY "coordinator_can_update_subject_resources" ON resources FOR UPDATE
      USING (
        -- Admin can update all
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
        OR
        -- Coordinator can update resources in their assigned subjects
        EXISTS (
          SELECT 1 FROM coordinator_subjects
          WHERE coordinator_id = auth.uid()
          AND subject_id = resources.subject_id
        )
        OR
        -- Teacher can update their own uploads (e.g. edit title/url before approval)
        uploaded_by = auth.uid()
      );
  END IF;
END $$;

-- 4. Subject Timeline Table
-- Coordinator defines the week-by-week academic roadmap
CREATE TABLE IF NOT EXISTS subject_timeline (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  subject_id   BIGINT REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
  week_number  INT NOT NULL,
  title        TEXT NOT NULL,           -- e.g. "Week 1 — Unit 1: Introduction"
  description  TEXT,
  type         TEXT DEFAULT 'topic',    -- topic | assignment | quiz | practical | exam
  due_date     DATE,
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (subject_id, week_number)
);

ALTER TABLE subject_timeline ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='subject_timeline' AND policyname='timeline_public_read') THEN
    CREATE POLICY "timeline_public_read" ON subject_timeline FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='subject_timeline' AND policyname='timeline_coord_write') THEN
    CREATE POLICY "timeline_coord_write" ON subject_timeline FOR INSERT
      WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
        OR
        EXISTS (SELECT 1 FROM coordinator_subjects WHERE coordinator_id = auth.uid() AND subject_id = subject_timeline.subject_id)
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='subject_timeline' AND policyname='timeline_coord_delete') THEN
    CREATE POLICY "timeline_coord_delete" ON subject_timeline FOR DELETE
      USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
        OR
        EXISTS (SELECT 1 FROM coordinator_subjects WHERE coordinator_id = auth.uid() AND subject_id = subject_timeline.subject_id)
      );
  END IF;
END $$;

-- 5. Faculty Workspace Posts (private — students never see these)
CREATE TABLE IF NOT EXISTS faculty_workspace (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  subject_id   BIGINT REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
  author_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  content      TEXT,
  type         TEXT DEFAULT 'note',  -- note | announcement | resource | discussion
  url          TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE faculty_workspace ENABLE ROW LEVEL SECURITY;

-- Only teachers and coordinators of that subject can see faculty workspace
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='faculty_workspace' AND policyname='faculty_workspace_restricted_read') THEN
    CREATE POLICY "faculty_workspace_restricted_read" ON faculty_workspace FOR SELECT
      USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
        OR
        EXISTS (SELECT 1 FROM coordinator_subjects WHERE coordinator_id = auth.uid() AND subject_id = faculty_workspace.subject_id)
        OR
        EXISTS (SELECT 1 FROM teacher_assignments WHERE teacher_id = auth.uid() AND subject_id = faculty_workspace.subject_id)
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='faculty_workspace' AND policyname='faculty_workspace_write') THEN
    CREATE POLICY "faculty_workspace_write" ON faculty_workspace FOR INSERT
      WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
        OR
        EXISTS (SELECT 1 FROM coordinator_subjects WHERE coordinator_id = auth.uid() AND subject_id = faculty_workspace.subject_id)
        OR
        EXISTS (SELECT 1 FROM teacher_assignments WHERE teacher_id = auth.uid() AND subject_id = faculty_workspace.subject_id)
      );
  END IF;
END $$;

-- ============================================================
-- VERIFY
-- ============================================================
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('coordinator_subjects', 'subject_timeline', 'faculty_workspace');
