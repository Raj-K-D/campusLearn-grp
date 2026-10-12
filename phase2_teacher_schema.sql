-- ============================================================
-- CAMPUSLEARN — Phase 2: Teacher Layer Schema
-- FIXED: subjects.id is BIGINT in the live DB, not UUID
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. DIVISIONS TABLE
-- Represents a classroom section (e.g., SE-A, TE-B)
-- subject_id is BIGINT to match live subjects.id type
CREATE TABLE IF NOT EXISTS divisions (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name        TEXT NOT NULL,               -- e.g. "SE-A", "TE-B"
  subject_id  BIGINT REFERENCES subjects(id) ON DELETE SET NULL,
  branch      TEXT NOT NULL,               -- e.g. "CS", "IT"
  semester    INT  NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. USER ROLES TABLE
-- Stores role assignments for teachers, coordinators, dept admins
-- A user can appear multiple times with different roles
CREATE TABLE IF NOT EXISTS user_roles (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('teacher', 'coordinator', 'dept_admin', 'super_admin')),
  subject_id    BIGINT REFERENCES subjects(id) ON DELETE SET NULL,  -- bigint to match live subjects.id
  division_id   UUID REFERENCES divisions(id) ON DELETE SET NULL,
  department    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, role, subject_id, division_id)
);

-- 3. TEACHER ASSIGNMENTS TABLE
-- Maps a teacher to a specific subject + division
CREATE TABLE IF NOT EXISTS teacher_assignments (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  teacher_id  UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subject_id  BIGINT REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,  -- bigint
  division_id UUID REFERENCES divisions(id) ON DELETE CASCADE NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (teacher_id, subject_id, division_id)
);

-- 4. Add columns to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_teacher     BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name      TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_coordinator BOOLEAN DEFAULT FALSE;

-- 5. ENABLE RLS ON NEW TABLES
ALTER TABLE divisions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_assignments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- DIVISIONS: everyone can read, only admins can write
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='divisions' AND policyname='divisions_public_read') THEN
    CREATE POLICY "divisions_public_read" ON divisions FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='divisions' AND policyname='divisions_admin_write') THEN
    CREATE POLICY "divisions_admin_write" ON divisions FOR INSERT
      WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='divisions' AND policyname='divisions_admin_delete') THEN
    CREATE POLICY "divisions_admin_delete" ON divisions FOR DELETE
      USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));
  END IF;
END $$;

-- USER ROLES: own read + admin full access
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_roles' AND policyname='user_roles_own_read') THEN
    CREATE POLICY "user_roles_own_read" ON user_roles FOR SELECT
      USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_roles' AND policyname='user_roles_admin_insert') THEN
    CREATE POLICY "user_roles_admin_insert" ON user_roles FOR INSERT
      WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_roles' AND policyname='user_roles_admin_delete') THEN
    CREATE POLICY "user_roles_admin_delete" ON user_roles FOR DELETE
      USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));
  END IF;
END $$;

-- TEACHER ASSIGNMENTS: teachers see their own, admins see all
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='teacher_assignments' AND policyname='teacher_assignments_own_read') THEN
    CREATE POLICY "teacher_assignments_own_read" ON teacher_assignments FOR SELECT
      USING (teacher_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='teacher_assignments' AND policyname='teacher_assignments_admin_insert') THEN
    CREATE POLICY "teacher_assignments_admin_insert" ON teacher_assignments FOR INSERT
      WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='teacher_assignments' AND policyname='teacher_assignments_admin_delete') THEN
    CREATE POLICY "teacher_assignments_admin_delete" ON teacher_assignments FOR DELETE
      USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));
  END IF;
END $$;

-- ============================================================
-- RESOURCES TABLE: add new columns for Phase 2 visibility
-- ============================================================
ALTER TABLE resources ADD COLUMN IF NOT EXISTS division_id      UUID REFERENCES divisions(id) ON DELETE SET NULL;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS visibility       TEXT DEFAULT 'SUBJECT_WIDE';
ALTER TABLE resources ADD COLUMN IF NOT EXISTS approval_status  TEXT DEFAULT 'approved';
ALTER TABLE resources ADD COLUMN IF NOT EXISTS is_official      BOOLEAN DEFAULT FALSE;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS owner_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS uploaded_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================================
-- VERIFY — should return 3 rows
-- ============================================================
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('divisions', 'user_roles', 'teacher_assignments');
