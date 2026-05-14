-- Support tickets between users and administrators.

CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users and admins can view support tickets"
  ON support_tickets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.current_user_is_admin());

CREATE POLICY "Users can create own support tickets"
  ON support_tickets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users and admins can update related support tickets"
  ON support_tickets FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR public.current_user_is_admin())
  WITH CHECK (auth.uid() = user_id OR public.current_user_is_admin());

CREATE POLICY "Users and admins can view support messages"
  ON support_ticket_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM support_tickets
      WHERE support_tickets.id = support_ticket_messages.ticket_id
        AND (support_tickets.user_id = auth.uid() OR public.current_user_is_admin())
    )
  );

CREATE POLICY "Users and admins can create support messages"
  ON support_ticket_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM support_tickets
      WHERE support_tickets.id = support_ticket_messages.ticket_id
        AND (support_tickets.user_id = auth.uid() OR public.current_user_is_admin())
    )
  );

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id
  ON support_tickets(user_id);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status
  ON support_tickets(status);

CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket_id
  ON support_ticket_messages(ticket_id);

CREATE OR REPLACE FUNCTION set_support_ticket_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_support_ticket_updated_at
  ON support_tickets;

CREATE TRIGGER set_support_ticket_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION set_support_ticket_updated_at();

CREATE OR REPLACE FUNCTION touch_support_ticket_from_message()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE support_tickets
  SET updated_at = now()
  WHERE id = NEW.ticket_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_support_ticket_from_message
  ON support_ticket_messages;

CREATE TRIGGER touch_support_ticket_from_message
  AFTER INSERT ON support_ticket_messages
  FOR EACH ROW
  EXECUTE FUNCTION touch_support_ticket_from_message();
