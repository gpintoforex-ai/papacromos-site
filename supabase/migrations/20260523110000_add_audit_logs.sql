CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid,
  target_user_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_user_id ON audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_user_id ON audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

DROP POLICY IF EXISTS "Admins can view audit logs" ON audit_logs;
CREATE POLICY "Admins can view audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (public.current_user_is_admin());

CREATE TABLE IF NOT EXISTS audit_log_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  retention_days int NOT NULL DEFAULT 180 CHECK (retention_days IN (15, 30, 180, 365)),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO audit_log_settings (id, retention_days)
VALUES (true, 180)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE audit_log_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view audit log settings" ON audit_log_settings;
CREATE POLICY "Admins can view audit log settings"
  ON audit_log_settings FOR SELECT
  TO authenticated
  USING (public.current_user_is_admin());

CREATE OR REPLACE FUNCTION public.write_audit_log(
  p_action text,
  p_entity_type text,
  p_entity_id uuid DEFAULT NULL,
  p_target_user_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id uuid;
  v_retention_days int;
BEGIN
  INSERT INTO audit_logs (
    actor_user_id,
    target_user_id,
    action,
    entity_type,
    entity_id,
    metadata,
    user_agent
  )
  VALUES (
    auth.uid(),
    p_target_user_id,
    NULLIF(trim(p_action), ''),
    NULLIF(trim(p_entity_type), ''),
    p_entity_id,
    COALESCE(p_metadata, '{}'::jsonb),
    NULLIF(trim(COALESCE(p_user_agent, '')), '')
  )
  RETURNING id INTO v_log_id;

  SELECT retention_days INTO v_retention_days
  FROM audit_log_settings
  WHERE id = true;

  DELETE FROM audit_logs
  WHERE created_at < now() - make_interval(days => COALESCE(v_retention_days, 180));

  RETURN v_log_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_audit_log_retention_days()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_retention_days int;
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT retention_days INTO v_retention_days
  FROM audit_log_settings
  WHERE id = true;

  RETURN COALESCE(v_retention_days, 180);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_audit_log_retention_days(p_retention_days int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count int;
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_retention_days NOT IN (15, 30, 180, 365) THEN
    RAISE EXCEPTION 'Invalid retention period';
  END IF;

  INSERT INTO audit_log_settings (id, retention_days, updated_by, updated_at)
  VALUES (true, p_retention_days, auth.uid(), now())
  ON CONFLICT (id) DO UPDATE SET
    retention_days = EXCLUDED.retention_days,
    updated_by = EXCLUDED.updated_by,
    updated_at = EXCLUDED.updated_at;

  WITH deleted AS (
    DELETE FROM audit_logs
    WHERE created_at < now() - make_interval(days => p_retention_days)
    RETURNING id
  )
  SELECT count(*) INTO v_deleted_count
  FROM deleted;

  PERFORM public.write_audit_log(
    'admin_audit_retention_updated',
    'audit_logs',
    NULL,
    NULL,
    jsonb_build_object(
      'retention_days', p_retention_days,
      'deleted_count', v_deleted_count
    ),
    NULL
  );

  RETURN v_deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_audit_logs(p_limit int DEFAULT 200)
RETURNS SETOF audit_logs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  SELECT *
  FROM audit_logs
  ORDER BY created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_audit_logs_before(p_before timestamptz)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count int;
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_before IS NULL THEN
    RAISE EXCEPTION 'Delete date is required';
  END IF;

  IF p_before > now() THEN
    RAISE EXCEPTION 'Delete date cannot be in the future';
  END IF;

  WITH deleted AS (
    DELETE FROM audit_logs
    WHERE created_at < p_before
    RETURNING id
  )
  SELECT count(*) INTO v_deleted_count
  FROM deleted;

  PERFORM public.write_audit_log(
    'admin_audit_logs_deleted',
    'audit_logs',
    NULL,
    NULL,
    jsonb_build_object(
      'before', p_before,
      'deleted_count', v_deleted_count
    ),
    NULL
  );

  RETURN v_deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.write_audit_log(text, text, uuid, uuid, jsonb, text) FROM public;
REVOKE ALL ON FUNCTION public.admin_get_audit_log_retention_days() FROM public;
REVOKE ALL ON FUNCTION public.admin_set_audit_log_retention_days(int) FROM public;
REVOKE ALL ON FUNCTION public.admin_list_audit_logs(int) FROM public;
REVOKE ALL ON FUNCTION public.admin_delete_audit_logs_before(timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.write_audit_log(text, text, uuid, uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_audit_log_retention_days() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_audit_log_retention_days(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_audit_logs(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_audit_logs_before(timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_sticker_image(
  p_sticker_id uuid,
  p_image_url text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_previous_image_url text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT image_url INTO v_previous_image_url
  FROM stickers
  WHERE id = p_sticker_id;

  IF COALESCE(p_image_url, '') = '' AND NOT EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
  ) THEN
    RAISE EXCEPTION 'Only admins can remove sticker images';
  END IF;

  UPDATE stickers
  SET
    image_url = COALESCE(p_image_url, ''),
    rarity = public.calculate_sticker_rarity(name, COALESCE(p_image_url, ''))
  WHERE id = p_sticker_id;

  PERFORM public.write_audit_log(
    CASE WHEN COALESCE(p_image_url, '') = '' THEN 'sticker_image_removed' ELSE 'sticker_image_updated' END,
    'sticker',
    p_sticker_id,
    NULL,
    jsonb_build_object(
      'previous_image_url', COALESCE(v_previous_image_url, ''),
      'next_image_url', COALESCE(p_image_url, '')
    ),
    NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_sticker_image(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.update_sticker_image(uuid, text) TO authenticated;

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
DECLARE
  v_previous user_profiles%ROWTYPE;
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

  UPDATE user_profiles
  SET
    username = NULLIF(trim(p_username), ''),
    phone = NULLIF(trim(COALESCE(p_phone, '')), ''),
    city = NULLIF(trim(COALESCE(p_city, '')), ''),
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
        'is_admin', v_previous.is_admin,
        'is_blocked', v_previous.is_blocked
      ),
      'next', jsonb_build_object(
        'username', NULLIF(trim(p_username), ''),
        'phone', NULLIF(trim(COALESCE(p_phone, '')), ''),
        'city', NULLIF(trim(COALESCE(p_city, '')), ''),
        'is_admin', COALESCE(p_is_admin, false),
        'is_blocked', COALESCE(p_is_blocked, false)
      )
    ),
    NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_profile user_profiles%ROWTYPE;
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete current admin account';
  END IF;

  SELECT * INTO v_deleted_profile
  FROM user_profiles
  WHERE id = p_user_id;

  PERFORM public.write_audit_log(
    'admin_user_deleted',
    'user',
    p_user_id,
    p_user_id,
    jsonb_build_object(
      'username', v_deleted_profile.username,
      'email', v_deleted_profile.email,
      'city', v_deleted_profile.city,
      'is_admin', v_deleted_profile.is_admin,
      'is_blocked', v_deleted_profile.is_blocked
    ),
    NULL
  );

  DELETE FROM auth.users
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_profile user_profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_deleted_profile
  FROM user_profiles
  WHERE id = auth.uid();

  PERFORM public.write_audit_log(
    'user_deleted_own_account',
    'user',
    auth.uid(),
    auth.uid(),
    jsonb_build_object(
      'username', v_deleted_profile.username,
      'email', v_deleted_profile.email,
      'city', v_deleted_profile.city
    ),
    NULL
  );

  DELETE FROM auth.users
  WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_user_profile(uuid, text, text, text, boolean, boolean) FROM public;
REVOKE ALL ON FUNCTION public.admin_delete_user(uuid) FROM public;
REVOKE ALL ON FUNCTION public.delete_own_account() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_update_user_profile(uuid, text, text, text, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_reset_trade_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trade_count int;
  v_message_count int;
  v_event_count int;
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT count(*) INTO v_trade_count FROM trade_offers;
  SELECT count(*) INTO v_message_count FROM trade_messages;
  SELECT count(*) INTO v_event_count FROM trade_partner_events;

  DELETE FROM trade_partner_events WHERE id IS NOT NULL;
  DELETE FROM trade_messages WHERE id IS NOT NULL;
  DELETE FROM trade_offers WHERE id IS NOT NULL;

  PERFORM public.write_audit_log(
    'admin_trade_data_reset',
    'trade_data',
    NULL,
    NULL,
    jsonb_build_object(
      'trade_offers_deleted', v_trade_count,
      'trade_messages_deleted', v_message_count,
      'trade_partner_events_deleted', v_event_count
    ),
    NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reset_trade_data() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_reset_trade_data() TO authenticated;

NOTIFY pgrst, 'reload schema';
