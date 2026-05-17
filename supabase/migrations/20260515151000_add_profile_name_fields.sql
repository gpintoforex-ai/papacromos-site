/*
  # Add profile name fields

  Adds first and last name to user profiles while keeping username as the public display name.
*/

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text;
