CREATE OR REPLACE FUNCTION public.admin_list_audit_logs(p_limit int DEFAULT 1000)
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
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 1000), 1), 2000);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_audit_logs(int) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_list_audit_logs(int) TO authenticated;

NOTIFY pgrst, 'reload schema';
