CREATE OR REPLACE FUNCTION public.admin_queue_push_notification(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_data jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notification_id uuid;
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Target user is required';
  END IF;

  IF NULLIF(trim(COALESCE(p_title, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Notification title is required';
  END IF;

  IF NULLIF(trim(COALESCE(p_body, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Notification body is required';
  END IF;

  notification_id := public.queue_push_notification(
    p_user_id,
    trim(p_title),
    trim(p_body),
    COALESCE(p_data, '{}'::jsonb)
  );

  RETURN notification_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_queue_push_notification(uuid, text, text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_queue_push_notification(uuid, text, text, jsonb) TO authenticated;
