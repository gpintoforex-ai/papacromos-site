-- Allow administrators to monitor trade conversations from the admin inbox.

DROP POLICY IF EXISTS "Admins can view all trade messages" ON trade_messages;

CREATE POLICY "Admins can view all trade messages"
  ON trade_messages FOR SELECT
  TO authenticated
  USING (public.current_user_is_admin());

NOTIFY pgrst, 'reload schema';
