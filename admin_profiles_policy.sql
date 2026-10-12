-- Add policies to allow admins to read all profiles and update them
CREATE POLICY "admin_all_profiles_read" ON profiles
FOR SELECT
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
);

CREATE POLICY "admin_all_profiles_update" ON profiles
FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
);
