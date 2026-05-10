/*
  # Add contact fields to user profiles

  1. Changes
    - Add `email`, `phone`, and `city` to `user_profiles`
    - Keep existing `username` and `avatar_seed` behavior
*/

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS city text;

