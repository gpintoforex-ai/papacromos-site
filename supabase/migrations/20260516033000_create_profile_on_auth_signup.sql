/*
  # Create profile on auth signup

  Ensures user_profiles is created by the database as soon as Supabase Auth
  creates a user. This keeps registration reliable even when email confirmation
  is enabled and the client does not receive an authenticated session yet.
*/

CREATE OR REPLACE FUNCTION public.create_profile_for_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  metadata jsonb;
  base_username text;
  final_username text;
BEGIN
  metadata := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  base_username := trim(COALESCE(
    NULLIF(metadata->>'username', ''),
    split_part(COALESCE(NEW.email, ''), '@', 1),
    'utilizador'
  ));

  IF base_username = '' THEN
    base_username := 'utilizador';
  END IF;

  final_username := base_username;
  IF EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE username = final_username
      AND id <> NEW.id
  ) THEN
    final_username := left(base_username, 48) || '-' || left(replace(NEW.id::text, '-', ''), 8);
  END IF;

  INSERT INTO public.user_profiles (
    id,
    first_name,
    last_name,
    username,
    email,
    phone,
    city,
    avatar_seed,
    is_admin,
    is_blocked
  )
  VALUES (
    NEW.id,
    NULLIF(trim(COALESCE(metadata->>'first_name', '')), ''),
    NULLIF(trim(COALESCE(metadata->>'last_name', '')), ''),
    final_username,
    NEW.email,
    NULLIF(trim(COALESCE(metadata->>'phone', '')), ''),
    NULLIF(trim(COALESCE(metadata->>'city', '')), ''),
    final_username,
    false,
    false
  )
  ON CONFLICT (id) DO UPDATE
  SET
    first_name = COALESCE(EXCLUDED.first_name, user_profiles.first_name),
    last_name = COALESCE(EXCLUDED.last_name, user_profiles.last_name),
    email = COALESCE(EXCLUDED.email, user_profiles.email),
    phone = COALESCE(EXCLUDED.phone, user_profiles.phone),
    city = COALESCE(EXCLUDED.city, user_profiles.city);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_profile_after_auth_signup ON auth.users;
CREATE TRIGGER create_profile_after_auth_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_profile_for_new_auth_user();

INSERT INTO public.user_profiles (
  id,
  first_name,
  last_name,
  username,
  email,
  phone,
  city,
  avatar_seed,
  is_admin,
  is_blocked
)
SELECT
  auth_users.id,
  NULLIF(trim(COALESCE(auth_users.raw_user_meta_data->>'first_name', '')), ''),
  NULLIF(trim(COALESCE(auth_users.raw_user_meta_data->>'last_name', '')), ''),
  CASE
    WHEN existing_username.id IS NULL THEN source_profile.base_username
    ELSE left(source_profile.base_username, 48) || '-' || left(replace(auth_users.id::text, '-', ''), 8)
  END,
  auth_users.email,
  NULLIF(trim(COALESCE(auth_users.raw_user_meta_data->>'phone', '')), ''),
  NULLIF(trim(COALESCE(auth_users.raw_user_meta_data->>'city', '')), ''),
  CASE
    WHEN existing_username.id IS NULL THEN source_profile.base_username
    ELSE left(source_profile.base_username, 48) || '-' || left(replace(auth_users.id::text, '-', ''), 8)
  END,
  false,
  false
FROM auth.users auth_users
CROSS JOIN LATERAL (
  SELECT trim(COALESCE(
    NULLIF(auth_users.raw_user_meta_data->>'username', ''),
    split_part(COALESCE(auth_users.email, ''), '@', 1),
    'utilizador'
  )) AS base_username
) source_profile
LEFT JOIN public.user_profiles existing_profile ON existing_profile.id = auth_users.id
LEFT JOIN public.user_profiles existing_username
  ON existing_username.username = source_profile.base_username
  AND existing_username.id <> auth_users.id
WHERE existing_profile.id IS NULL
ON CONFLICT (id) DO NOTHING;
