/*
  # Add user friends

  1. New Tables
    - `user_friends`
      - `user_id` (uuid, owner)
      - `friend_id` (uuid, associated friend)
      - `created_at` (timestamptz)

  2. Security
    - Users can manage only their own friend list
*/

CREATE TABLE IF NOT EXISTS user_friends (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, friend_id),
  CONSTRAINT user_friends_no_self CHECK (user_id <> friend_id)
);

ALTER TABLE user_friends ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_user_friends_user_id ON user_friends(user_id);
CREATE INDEX IF NOT EXISTS idx_user_friends_friend_id ON user_friends(friend_id);

DROP POLICY IF EXISTS "Users can view own friends" ON user_friends;
DROP POLICY IF EXISTS "Users can add own friends" ON user_friends;
DROP POLICY IF EXISTS "Users can remove own friends" ON user_friends;

CREATE POLICY "Users can view own friends"
  ON user_friends FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add own friends"
  ON user_friends FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND auth.uid() <> friend_id);

CREATE POLICY "Users can remove own friends"
  ON user_friends FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
