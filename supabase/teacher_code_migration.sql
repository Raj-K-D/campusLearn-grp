-- ============================================================
-- CampusLearn Teacher Code System Migration
-- Run these in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. Add teacher_code column to teacher_assignments (if not exists)
ALTER TABLE teacher_assignments
  ADD COLUMN IF NOT EXISTS teacher_code TEXT UNIQUE;

-- Optional: generate codes for any existing assignments that don't have one
UPDATE teacher_assignments
SET teacher_code = LPAD(FLOOR(RANDOM() * 900 + 100)::TEXT, 3, '0')
WHERE teacher_code IS NULL;

-- 2. Create submissions table (for student → teacher submissions via code)
CREATE TABLE IF NOT EXISTS submissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  subject_id  TEXT NOT NULL,
  teacher_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  teacher_code TEXT,
  title       TEXT NOT NULL,
  type        TEXT DEFAULT 'assignment',
  file_name   TEXT,
  file_url    TEXT,
  status      TEXT DEFAULT 'submitted',
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for submissions
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- Students can insert their own submissions
CREATE POLICY "Students can insert submissions"
  ON submissions FOR INSERT
  WITH CHECK (auth.uid() = student_id OR student_id IS NULL);

-- Students can view their own submissions
CREATE POLICY "Students can view own submissions"
  ON submissions FOR SELECT
  USING (auth.uid() = student_id);

-- Teachers can view submissions sent to them
CREATE POLICY "Teachers can view their submissions"
  ON submissions FOR SELECT
  USING (auth.uid() = teacher_id);

-- Admins/coordinators can view all
CREATE POLICY "Admins can view all submissions"
  ON submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND (is_admin = TRUE OR is_coordinator = TRUE)
    )
  );

-- 3. Coordinator invites table (track pending invitations)
CREATE TABLE IF NOT EXISTS coordinator_invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE NOT NULL,
  status      TEXT DEFAULT 'pending',  -- 'pending' | 'accepted'
  invited_at  TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ
);

ALTER TABLE coordinator_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage coordinator invites"
  ON coordinator_invites FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- 4. Teacher invites table
CREATE TABLE IF NOT EXISTS teacher_invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE NOT NULL,
  status      TEXT DEFAULT 'pending',
  invited_at  TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ
);

ALTER TABLE teacher_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and coordinators can manage teacher invites"
  ON teacher_invites FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND (is_admin = TRUE OR is_coordinator = TRUE)
    )
  );

-- 5. Auto-grant role when invited user signs up
--    (Supabase trigger on profiles insert)
CREATE OR REPLACE FUNCTION handle_new_profile_invite()
RETURNS TRIGGER AS $$
BEGIN
  -- Check coordinator_invites
  IF EXISTS (SELECT 1 FROM coordinator_invites WHERE email = NEW.email AND status = 'pending') THEN
    UPDATE profiles SET is_coordinator = TRUE WHERE id = NEW.id;
    INSERT INTO user_roles (user_id, role) VALUES (NEW.id, 'coordinator')
      ON CONFLICT DO NOTHING;
    UPDATE coordinator_invites SET status = 'accepted', accepted_at = NOW() WHERE email = NEW.email;
  END IF;

  -- Check teacher_invites
  IF EXISTS (SELECT 1 FROM teacher_invites WHERE email = NEW.email AND status = 'pending') THEN
    UPDATE profiles SET is_teacher = TRUE WHERE id = NEW.id;
    INSERT INTO user_roles (user_id, role) VALUES (NEW.id, 'teacher')
      ON CONFLICT DO NOTHING;
    UPDATE teacher_invites SET status = 'accepted', accepted_at = NOW() WHERE email = NEW.email;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_profile_check_invites ON profiles;
CREATE TRIGGER on_new_profile_check_invites
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_new_profile_invite();

-- 6. Storage bucket policy for submissions (if using 'materials' bucket)
-- Run this if you want students to be able to upload to submissions/
-- INSERT INTO storage.buckets (id, name, public) VALUES ('materials', 'materials', true)
-- ON CONFLICT DO NOTHING;
