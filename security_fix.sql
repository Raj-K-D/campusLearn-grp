-- ============================================================
-- RUN THIS in your Supabase SQL Editor
-- Fixes the profiles table and sets you as admin
-- ============================================================

-- Step 1: Add the is_admin column if it doesn't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Step 2: Set your account as admin
UPDATE profiles SET is_admin = TRUE WHERE email = 'rajdugane00@gmail.com';

-- Step 3: If the UPDATE affected 0 rows, your profile row may not exist yet.
-- In that case, insert it manually (get your user ID from Auth > Users in Supabase):
-- INSERT INTO profiles (id, email, is_admin)
-- VALUES ('<YOUR-USER-UUID-HERE>', 'rajdugane00@gmail.com', TRUE)
-- ON CONFLICT (id) DO UPDATE SET is_admin = TRUE, email = 'rajdugane00@gmail.com';

-- Step 4: Re-enable RLS on subjects and resources (CRITICAL)
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

-- Step 5: Ensure public read policies exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_policies WHERE tablename = 'subjects' AND policyname = 'Public subjects are viewable by everyone'
  ) THEN
    CREATE POLICY "Public subjects are viewable by everyone" ON subjects FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT FROM pg_policies WHERE tablename = 'resources' AND policyname = 'Public resources are viewable by everyone'
  ) THEN
    CREATE POLICY "Public resources are viewable by everyone" ON resources FOR SELECT USING (true);
  END IF;
END $$;

-- Step 6: Verify — should show your row with is_admin = TRUE
SELECT id, email, is_admin FROM profiles WHERE email = 'rajdugane00@gmail.com';

-- ============================================================
-- DONE
-- ============================================================
