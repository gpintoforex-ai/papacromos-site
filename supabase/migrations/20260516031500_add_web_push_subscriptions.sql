/*
  # Web push subscriptions

  Stores browser Push API subscriptions for the PWA/web app. These records are
  delivered by the same send-push-notifications Edge Function as native tokens.
*/

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

ALTER TABLE web_push_subscriptions ENABLE ROW LEVEL SECURITY;

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

CREATE INDEX IF NOT EXISTS idx_web_push_subscriptions_user_active
  ON web_push_subscriptions(user_id, active);

DROP TRIGGER IF EXISTS set_web_push_subscriptions_updated_at ON web_push_subscriptions;
CREATE TRIGGER set_web_push_subscriptions_updated_at
  BEFORE UPDATE ON web_push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
