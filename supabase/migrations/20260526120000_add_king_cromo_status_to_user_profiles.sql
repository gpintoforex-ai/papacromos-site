/*
  Add King Cromo status to user profiles.
*/

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'member'
    CHECK (status IN ('member', 'king_cromo'));

CREATE OR REPLACE FUNCTION public.admin_update_user_profile(
  p_user_id uuid,
  p_username text,
  p_phone text,
  p_city text,
  p_status text,
  p_is_admin boolean,
  p_is_blocked boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_previous user_profiles%ROWTYPE;
  v_next_status text;
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO v_previous
  FROM user_profiles
  WHERE id = p_user_id;

  IF p_user_id = auth.uid() THEN
    p_is_admin := true;
    p_is_blocked := false;
  END IF;

  v_next_status := COALESCE(NULLIF(trim(p_status), ''), 'member');

  UPDATE user_profiles
  SET
    username = NULLIF(trim(p_username), ''),
    phone = NULLIF(trim(COALESCE(p_phone, '')), ''),
    city = NULLIF(trim(COALESCE(p_city, '')), ''),
    status = v_next_status,
    is_admin = COALESCE(p_is_admin, false),
    is_blocked = COALESCE(p_is_blocked, false)
  WHERE id = p_user_id;

  PERFORM public.write_audit_log(
    'admin_user_profile_updated',
    'user_profile',
    p_user_id,
    p_user_id,
    jsonb_build_object(
      'previous', jsonb_build_object(
        'username', v_previous.username,
        'phone', v_previous.phone,
        'city', v_previous.city,
        'status', v_previous.status,
        'is_admin', v_previous.is_admin,
        'is_blocked', v_previous.is_blocked
      ),
      'next', jsonb_build_object(
        'username', NULLIF(trim(p_username), ''),
        'phone', NULLIF(trim(COALESCE(p_phone, '')), ''),
        'city', NULLIF(trim(COALESCE(p_city, '')), ''),
        'status', v_next_status,
        'is_admin', COALESCE(p_is_admin, false),
        'is_blocked', COALESCE(p_is_blocked, false)
      )
    ),
    NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_user_profile(uuid, text, text, text, text, boolean, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_update_user_profile(uuid, text, text, text, text, boolean, boolean) TO authenticated;
