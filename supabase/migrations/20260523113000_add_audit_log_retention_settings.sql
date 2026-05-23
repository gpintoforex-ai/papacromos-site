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

REVOKE ALL ON FUNCTION public.admin_get_audit_log_retention_days() FROM public;
REVOKE ALL ON FUNCTION public.admin_set_audit_log_retention_days(int) FROM public;
REVOKE ALL ON FUNCTION public.write_audit_log(text, text, uuid, uuid, jsonb, text) FROM public;

GRANT EXECUTE ON FUNCTION public.admin_get_audit_log_retention_days() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_audit_log_retention_days(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.write_audit_log(text, text, uuid, uuid, jsonb, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
