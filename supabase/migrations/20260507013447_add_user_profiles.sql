/*
  # Add user profiles table

  1. New Tables
    - `user_profiles`
      - `id` (uuid, primary key, FK to auth.users)
      - `username` (text, unique) - Display name chosen by user
      - `avatar_seed` (text) - Seed for generating avatar color
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on user_profiles
    - Users can read all profiles (to see usernames in matches)
    - Users can update only their own profile

  3. Notes
    - Username auto-generated from email on first login if not set
    - Avatar color generated from username for consistency
*/

CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  avatar_seed text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view user profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);
