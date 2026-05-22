-- Store district/region when Supabase Auth creates the user profile.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS region text;

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
    region,
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
    NULLIF(trim(COALESCE(metadata->>'region', '')), ''),
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
    region = COALESCE(EXCLUDED.region, user_profiles.region),
    city = COALESCE(EXCLUDED.city, user_profiles.city);

  RETURN NEW;
END;
$$;
