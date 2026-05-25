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

CREATE TABLE IF NOT EXISTS web_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  active boolean NOT NULL DEFAULT true,
  error_message text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

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

ALTER TABLE app_notifications
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE web_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_active ON push_tokens(user_id, active);
CREATE INDEX IF NOT EXISTS idx_web_push_subscriptions_user_active
  ON web_push_subscriptions(user_id, active);

DROP INDEX IF EXISTS idx_app_notifications_delivery;
CREATE INDEX IF NOT EXISTS idx_app_notifications_delivery
  ON app_notifications(status, scheduled_at, created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_app_notifications_user_created
  ON app_notifications(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
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
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_web_push_subscriptions_updated_at ON web_push_subscriptions;
CREATE TRIGGER set_web_push_subscriptions_updated_at
  BEFORE UPDATE ON web_push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP POLICY IF EXISTS "Users can view own push tokens" ON push_tokens;
DROP POLICY IF EXISTS "Users can insert own push tokens" ON push_tokens;
DROP POLICY IF EXISTS "Users can update own push tokens" ON push_tokens;
DROP POLICY IF EXISTS "Users can delete own push tokens" ON push_tokens;
DROP POLICY IF EXISTS "Users can view own web push subscriptions" ON web_push_subscriptions;
DROP POLICY IF EXISTS "Users can insert own web push subscriptions" ON web_push_subscriptions;
DROP POLICY IF EXISTS "Users can update own web push subscriptions" ON web_push_subscriptions;
DROP POLICY IF EXISTS "Users can delete own web push subscriptions" ON web_push_subscriptions;
DROP POLICY IF EXISTS "Users can view own app notifications" ON app_notifications;

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

CREATE POLICY "Users can view own web push subscriptions"
  ON web_push_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own web push subscriptions"
  ON web_push_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own web push subscriptions"
  ON web_push_subscriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own web push subscriptions"
  ON web_push_subscriptions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own app notifications"
  ON app_notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.queue_push_notification(
  target_user_id uuid,
  notification_title text,
  notification_body text,
  notification_data jsonb,
  notification_scheduled_at timestamptz
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

  IF NULLIF(trim(COALESCE(notification_title, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Notification title is required';
  END IF;

  IF NULLIF(trim(COALESCE(notification_body, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Notification body is required';
  END IF;

  INSERT INTO app_notifications (user_id, title, body, data, scheduled_at)
  VALUES (
    target_user_id,
    trim(notification_title),
    trim(notification_body),
    COALESCE(notification_data, '{}'::jsonb),
    COALESCE(notification_scheduled_at, now())
  )
  RETURNING id INTO notification_id;

  RETURN notification_id;
END;
$$;

REVOKE ALL ON FUNCTION public.queue_push_notification(uuid, text, text, jsonb, timestamptz) FROM public;
REVOKE ALL ON FUNCTION public.queue_push_notification(uuid, text, text, jsonb, timestamptz) FROM authenticated;

CREATE OR REPLACE FUNCTION public.queue_push_notification(
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
BEGIN
  RETURN public.queue_push_notification(
    target_user_id,
    notification_title,
    notification_body,
    COALESCE(notification_data, '{}'::jsonb),
    now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.queue_push_notification(uuid, text, text, jsonb) FROM public;
REVOKE ALL ON FUNCTION public.queue_push_notification(uuid, text, text, jsonb) FROM authenticated;

CREATE OR REPLACE FUNCTION public.admin_queue_push_notification(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_data jsonb,
  p_scheduled_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notification_id uuid;
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  notification_id := public.queue_push_notification(
    p_user_id,
    p_title,
    p_body,
    COALESCE(p_data, '{}'::jsonb),
    COALESCE(p_scheduled_at, now())
  );

  RETURN notification_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_queue_push_notification(uuid, text, text, jsonb, timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_queue_push_notification(uuid, text, text, jsonb, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_queue_push_notification(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_data jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.admin_queue_push_notification(
    p_user_id,
    p_title,
    p_body,
    COALESCE(p_data, '{}'::jsonb),
    now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_queue_push_notification(uuid, text, text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_queue_push_notification(uuid, text, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_queue_broadcast_push_notification(
  p_title text,
  p_body text,
  p_data jsonb,
  p_scheduled_at timestamptz
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  queued_count int;
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF NULLIF(trim(COALESCE(p_title, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Notification title is required';
  END IF;

  IF NULLIF(trim(COALESCE(p_body, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Notification body is required';
  END IF;

  INSERT INTO app_notifications (user_id, title, body, data, scheduled_at)
  SELECT
    user_profiles.id,
    trim(p_title),
    trim(p_body),
    COALESCE(p_data, '{}'::jsonb),
    COALESCE(p_scheduled_at, now())
  FROM user_profiles
  WHERE COALESCE(user_profiles.is_blocked, false) = false;

  GET DIAGNOSTICS queued_count = ROW_COUNT;
  RETURN queued_count;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_queue_broadcast_push_notification(text, text, jsonb, timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_queue_broadcast_push_notification(text, text, jsonb, timestamptz) TO authenticated;
