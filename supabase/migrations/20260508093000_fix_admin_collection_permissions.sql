/*
  # Fix admin collection permissions

  Ensures admin users can create and manage collections even if the earlier
  admin policy migration was not applied cleanly.
*/

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

UPDATE user_profiles
SET is_admin = true
WHERE lower(email) = 'admin@admin.pt';

DROP POLICY IF EXISTS "Admins can manage collections" ON collections;
DROP POLICY IF EXISTS "Admins can manage stickers" ON stickers;

CREATE POLICY "Admins can manage collections"
  ON collections FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can manage stickers"
  ON stickers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.is_admin = true
    )
  );
