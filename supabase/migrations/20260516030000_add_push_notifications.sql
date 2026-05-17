/*
  # Push notifications

  Stores mobile push tokens and queues app notifications that can be delivered
  by the send-push-notifications Edge Function.
*/

CREATE TABLE IF NOT EXISTS push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  platform text NOT NULL DEFAULT 'android',
  active boolean NOT NULL DEFAULT true,
  error_message text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own push tokens"
  ON push_tokens FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own push tokens"
  ON push_tokens FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own push tokens"
  ON push_tokens FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own push tokens"
  ON push_tokens FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_active ON push_tokens(user_id, active);

CREATE TABLE IF NOT EXISTS app_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  attempts int NOT NULL DEFAULT 0,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own app notifications"
  ON app_notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_app_notifications_delivery
  ON app_notifications(status, created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_app_notifications_user_created
  ON app_notifications(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_push_tokens_updated_at ON push_tokens;
CREATE TRIGGER set_push_tokens_updated_at
  BEFORE UPDATE ON push_tokens
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION queue_push_notification(
  target_user_id uuid,
  notification_title text,
  notification_body text,
  notification_data jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notification_id uuid;
BEGIN
  INSERT INTO app_notifications (user_id, title, body, data)
  VALUES (target_user_id, notification_title, notification_body, COALESCE(notification_data, '{}'::jsonb))
  RETURNING id INTO notification_id;

  RETURN notification_id;
END;
$$;

REVOKE ALL ON FUNCTION queue_push_notification(uuid, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION queue_push_notification(uuid, text, text, jsonb) FROM authenticated;

CREATE OR REPLACE FUNCTION notify_trade_offer_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM queue_push_notification(
    NEW.to_user_id,
    'Nova proposta de troca',
    'Recebeste uma nova proposta de troca.',
    jsonb_build_object('type', 'trade_offer', 'trade_id', NEW.id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trade_offer_created_push ON trade_offers;
CREATE TRIGGER trade_offer_created_push
  AFTER INSERT ON trade_offers
  FOR EACH ROW
  EXECUTE FUNCTION notify_trade_offer_created();

CREATE OR REPLACE FUNCTION notify_trade_status_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  status_label text;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  status_label := CASE NEW.status
    WHEN 'accepted' THEN 'aceite'
    WHEN 'completed' THEN 'concluida'
    WHEN 'rejected' THEN 'anulada'
    ELSE NEW.status
  END;

  PERFORM queue_push_notification(
    NEW.from_user_id,
    'Troca atualizada',
    'A tua troca foi ' || status_label || '.',
    jsonb_build_object('type', 'trade_status', 'trade_id', NEW.id, 'status', NEW.status)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trade_status_changed_push ON trade_offers;
CREATE TRIGGER trade_status_changed_push
  AFTER UPDATE OF status ON trade_offers
  FOR EACH ROW
  EXECUTE FUNCTION notify_trade_status_changed();

CREATE OR REPLACE FUNCTION notify_trade_message_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient_id uuid;
BEGIN
  SELECT CASE
    WHEN trade_offers.from_user_id = NEW.user_id THEN trade_offers.to_user_id
    ELSE trade_offers.from_user_id
  END
  INTO recipient_id
  FROM trade_offers
  WHERE trade_offers.id = NEW.trade_id;

  IF recipient_id IS NOT NULL THEN
    PERFORM queue_push_notification(
      recipient_id,
      'Nova mensagem',
      'Recebeste uma nova mensagem numa troca.',
      jsonb_build_object('type', 'trade_message', 'trade_id', NEW.trade_id, 'message_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trade_message_created_push ON trade_messages;
CREATE TRIGGER trade_message_created_push
  AFTER INSERT ON trade_messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_trade_message_created();
