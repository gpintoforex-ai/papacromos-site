-- Store per-user collection visibility preferences.
-- Collections are active by default; this table records explicit user choices.

CREATE TABLE IF NOT EXISTS user_collection_preferences (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, collection_id)
);

ALTER TABLE user_collection_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own collection preferences"
  ON user_collection_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can view inactive collection preferences for matching"
  ON user_collection_preferences FOR SELECT
  TO authenticated
  USING (is_active = false);

CREATE POLICY "Users can insert own collection preferences"
  ON user_collection_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own collection preferences"
  ON user_collection_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own collection preferences"
  ON user_collection_preferences FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_collection_preferences_user_id
  ON user_collection_preferences(user_id);

CREATE INDEX IF NOT EXISTS idx_user_collection_preferences_collection_id
  ON user_collection_preferences(collection_id);

CREATE OR REPLACE FUNCTION set_user_collection_preference_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_user_collection_preference_updated_at
  ON user_collection_preferences;

CREATE TRIGGER set_user_collection_preference_updated_at
  BEFORE UPDATE ON user_collection_preferences
  FOR EACH ROW
  EXECUTE FUNCTION set_user_collection_preference_updated_at();
