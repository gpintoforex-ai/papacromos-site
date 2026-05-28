-- Persist read state for the admin inbox per administrator and latest item key.

CREATE TABLE IF NOT EXISTS admin_inbox_reads (
  admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  read_key text NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (admin_user_id, item_key)
);

ALTER TABLE admin_inbox_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view own inbox reads" ON admin_inbox_reads;
CREATE POLICY "Admins can view own inbox reads"
  ON admin_inbox_reads FOR SELECT
  TO authenticated
  USING (admin_user_id = auth.uid() AND public.current_user_is_admin());

DROP POLICY IF EXISTS "Admins can upsert own inbox reads" ON admin_inbox_reads;
CREATE POLICY "Admins can upsert own inbox reads"
  ON admin_inbox_reads FOR INSERT
  TO authenticated
  WITH CHECK (admin_user_id = auth.uid() AND public.current_user_is_admin());

DROP POLICY IF EXISTS "Admins can update own inbox reads" ON admin_inbox_reads;
CREATE POLICY "Admins can update own inbox reads"
  ON admin_inbox_reads FOR UPDATE
  TO authenticated
  USING (admin_user_id = auth.uid() AND public.current_user_is_admin())
  WITH CHECK (admin_user_id = auth.uid() AND public.current_user_is_admin());

CREATE INDEX IF NOT EXISTS idx_admin_inbox_reads_admin_user_id
  ON admin_inbox_reads(admin_user_id);

NOTIFY pgrst, 'reload schema';
