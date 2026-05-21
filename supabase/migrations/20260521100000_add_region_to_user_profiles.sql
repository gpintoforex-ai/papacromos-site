-- Add district/region to user profiles for registration and OAuth profile completion.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS region text;
