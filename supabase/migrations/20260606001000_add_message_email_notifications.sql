-- Queue email notifications when trade/support messages are created.

CREATE TABLE IF NOT EXISTS public.app_email_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  body text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  attempts int NOT NULL DEFAULT 0,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_email_notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_app_email_notifications_delivery
  ON public.app_email_notifications(status, created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_app_email_notifications_user_created
  ON public.app_email_notifications(user_id, created_at DESC);

DROP POLICY IF EXISTS "Users can view own email notifications" ON public.app_email_notifications;
CREATE POLICY "Users can view own email notifications"
  ON public.app_email_notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.current_user_is_admin());

CREATE OR REPLACE FUNCTION public.queue_email_notification(
  target_user_id uuid,
  email_subject text,
  email_body text,
  email_data jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notification_id uuid;
BEGIN
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Target user is required';
  END IF;

  IF NULLIF(trim(COALESCE(email_subject, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Email subject is required';
  END IF;

  IF NULLIF(trim(COALESCE(email_body, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Email body is required';
  END IF;

  INSERT INTO public.app_email_notifications (user_id, subject, body, data)
  VALUES (
    target_user_id,
    trim(email_subject),
    trim(email_body),
    COALESCE(email_data, '{}'::jsonb)
  )
  RETURNING id INTO notification_id;

  RETURN notification_id;
END;
$$;

REVOKE ALL ON FUNCTION public.queue_email_notification(uuid, text, text, jsonb) FROM public;
REVOKE ALL ON FUNCTION public.queue_email_notification(uuid, text, text, jsonb) FROM authenticated;

CREATE OR REPLACE FUNCTION public.queue_trade_message_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient_id uuid;
  sender_name text;
  message_preview text;
BEGIN
  SELECT
    CASE
      WHEN trade_offers.from_user_id = NEW.user_id THEN trade_offers.to_user_id
      WHEN trade_offers.to_user_id = NEW.user_id THEN trade_offers.from_user_id
      ELSE NULL
    END,
    COALESCE(NULLIF(user_profiles.username, ''), user_profiles.email, 'Utilizador')
  INTO recipient_id, sender_name
  FROM trade_offers
  LEFT JOIN user_profiles ON user_profiles.id = NEW.user_id
  WHERE trade_offers.id = NEW.trade_id;

  message_preview := left(trim(regexp_replace(COALESCE(NEW.message, ''), '\s+', ' ', 'g')), 240);

  IF recipient_id IS NOT NULL AND recipient_id <> NEW.user_id THEN
    PERFORM public.queue_email_notification(
      recipient_id,
      'Nova mensagem numa troca',
      CASE
        WHEN message_preview = '' THEN sender_name || ' enviou uma nova mensagem numa troca.'
        ELSE sender_name || ': ' || message_preview
      END,
      jsonb_build_object(
        'type', 'trade_message',
        'trade_id', NEW.trade_id,
        'message_id', NEW.id,
        'sender_id', NEW.user_id,
        'sender_name', sender_name
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trade_message_created_email ON public.trade_messages;
CREATE TRIGGER trade_message_created_email
  AFTER INSERT ON public.trade_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_trade_message_email();

CREATE OR REPLACE FUNCTION public.queue_support_message_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ticket_owner_id uuid;
  ticket_subject text;
  sender_name text;
  message_preview text;
  admin_record record;
BEGIN
  SELECT support_tickets.user_id, support_tickets.subject
  INTO ticket_owner_id, ticket_subject
  FROM support_tickets
  WHERE support_tickets.id = NEW.ticket_id;

  SELECT COALESCE(NULLIF(user_profiles.username, ''), user_profiles.email, 'Utilizador')
  INTO sender_name
  FROM user_profiles
  WHERE user_profiles.id = NEW.user_id;

  sender_name := COALESCE(sender_name, 'Utilizador');
  message_preview := left(trim(regexp_replace(COALESCE(NEW.message, ''), '\s+', ' ', 'g')), 240);

  IF ticket_owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id <> ticket_owner_id THEN
    PERFORM public.queue_email_notification(
      ticket_owner_id,
      'Nova resposta do suporte',
      CASE
        WHEN message_preview = '' THEN 'Recebeste uma nova resposta no suporte.'
        ELSE sender_name || ': ' || message_preview
      END,
      jsonb_build_object(
        'type', 'support_message',
        'ticket_id', NEW.ticket_id,
        'message_id', NEW.id,
        'subject', ticket_subject,
        'sender_id', NEW.user_id,
        'sender_name', sender_name
      )
    );
  ELSE
    FOR admin_record IN
      SELECT id
      FROM user_profiles
      WHERE is_admin = true
        AND COALESCE(is_blocked, false) = false
        AND id <> NEW.user_id
    LOOP
      PERFORM public.queue_email_notification(
        admin_record.id,
        'Nova mensagem de suporte',
        CASE
          WHEN message_preview = '' THEN sender_name || ' enviou uma nova mensagem de suporte.'
          ELSE sender_name || ': ' || message_preview
        END,
        jsonb_build_object(
          'type', 'support_message',
          'ticket_id', NEW.ticket_id,
          'message_id', NEW.id,
          'subject', ticket_subject,
          'sender_id', NEW.user_id,
          'sender_name', sender_name
        )
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_message_created_email ON public.support_ticket_messages;
CREATE TRIGGER support_message_created_email
  AFTER INSERT ON public.support_ticket_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_support_message_email();

NOTIFY pgrst, 'reload schema';
