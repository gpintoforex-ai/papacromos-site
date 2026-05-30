-- Allow admins to schedule match alerts only for users with possible trades.

CREATE OR REPLACE FUNCTION public.user_has_trade_matches(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH my_repeated AS (
    SELECT us.sticker_id
    FROM user_stickers us
    WHERE us.user_id = p_user_id
      AND us.status = 'have'
      AND COALESCE(us.quantity, 0) > 1
  ),
  my_wants AS (
    SELECT us.sticker_id
    FROM user_stickers us
    WHERE us.user_id = p_user_id
      AND us.status = 'want'
  ),
  compatible_users AS (
    SELECT other_have.user_id AS other_user_id
    FROM user_stickers other_have
    JOIN my_wants mw ON mw.sticker_id = other_have.sticker_id
    JOIN user_profiles other_profile ON other_profile.id = other_have.user_id
    WHERE other_have.user_id <> p_user_id
      AND other_have.status = 'have'
      AND COALESCE(other_have.quantity, 0) > 1
      AND COALESCE(other_profile.is_blocked, false) = false
      AND EXISTS (
        SELECT 1
        FROM user_stickers other_want
        JOIN my_repeated mr ON mr.sticker_id = other_want.sticker_id
        WHERE other_want.user_id = other_have.user_id
          AND other_want.status = 'want'
      )
    LIMIT 1
  )
  SELECT EXISTS (SELECT 1 FROM compatible_users);
$$;

CREATE OR REPLACE FUNCTION public.admin_queue_match_alert_notifications(
  p_title text,
  p_body text,
  p_scheduled_at timestamptz
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  queued_count int;
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF NULLIF(trim(COALESCE(p_title, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Notification title is required';
  END IF;

  IF NULLIF(trim(COALESCE(p_body, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Notification body is required';
  END IF;

  IF p_scheduled_at IS NULL THEN
    RAISE EXCEPTION 'Scheduled date is required';
  END IF;

  INSERT INTO app_notifications (user_id, title, body, data, scheduled_at)
  SELECT
    user_profiles.id,
    trim(p_title),
    trim(p_body),
    jsonb_build_object(
      'type', 'match_alert',
      'scheduled_by', auth.uid()
    ),
    p_scheduled_at
  FROM user_profiles
  WHERE COALESCE(user_profiles.is_blocked, false) = false
    AND public.user_has_trade_matches(user_profiles.id);

  GET DIAGNOSTICS queued_count = ROW_COUNT;
  RETURN queued_count;
END;
$$;

REVOKE ALL ON FUNCTION public.user_has_trade_matches(uuid) FROM public;
REVOKE ALL ON FUNCTION public.admin_queue_match_alert_notifications(text, text, timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_queue_match_alert_notifications(text, text, timestamptz) TO authenticated;

NOTIFY pgrst, 'reload schema';
