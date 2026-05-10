/*
  # Add admin user management

  Adds block/edit/delete support for users from the Admin page.
*/

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE id = auth.uid()
      AND is_admin = true
      AND is_blocked = false
  );
$$;

CREATE OR REPLACE FUNCTION public.admin_update_user_profile(
  p_user_id uuid,
  p_username text,
  p_phone text,
  p_city text,
  p_is_admin boolean,
  p_is_blocked boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_user_id = auth.uid() THEN
    p_is_admin := true;
    p_is_blocked := false;
  END IF;

  UPDATE user_profiles
  SET
    username = NULLIF(trim(p_username), ''),
    phone = NULLIF(trim(COALESCE(p_phone, '')), ''),
    city = NULLIF(trim(COALESCE(p_city, '')), ''),
    is_admin = COALESCE(p_is_admin, false),
    is_blocked = COALESCE(p_is_blocked, false)
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete current admin account';
  END IF;

  DELETE FROM auth.users
  WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.current_user_is_admin() FROM public;
REVOKE ALL ON FUNCTION public.admin_update_user_profile(uuid, text, text, text, boolean, boolean) FROM public;
REVOKE ALL ON FUNCTION public.admin_delete_user(uuid) FROM public;

GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_profile(uuid, text, text, text, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;
