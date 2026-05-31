-- Store recurring match alert schedules and queue them when due.

CREATE TABLE IF NOT EXISTS public.match_alert_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  weekdays int[] NOT NULL DEFAULT '{}',
  scheduled_time time NOT NULL,
  start_at timestamptz NOT NULL,
  next_run_at timestamptz NOT NULL,
  last_run_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT match_alert_schedules_weekdays_valid CHECK (
    array_length(weekdays, 1) IS NOT NULL
    AND weekdays <@ ARRAY[0, 1, 2, 3, 4, 5, 6]
  )
);

CREATE INDEX IF NOT EXISTS idx_match_alert_schedules_due
  ON public.match_alert_schedules(active, next_run_at);

CREATE OR REPLACE FUNCTION public.next_match_alert_run(
  p_after timestamptz,
  p_weekdays int[],
  p_scheduled_time time
)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  base_date date;
  day_offset int;
  candidate timestamptz;
BEGIN
  IF p_weekdays IS NULL OR array_length(p_weekdays, 1) IS NULL THEN
    RAISE EXCEPTION 'Weekdays are required';
  END IF;

  base_date := (p_after AT TIME ZONE 'Europe/Lisbon')::date;

  FOR day_offset IN 0..14 LOOP
    candidate := ((base_date + day_offset) + p_scheduled_time) AT TIME ZONE 'Europe/Lisbon';
    IF candidate > p_after
      AND EXTRACT(DOW FROM candidate AT TIME ZONE 'Europe/Lisbon')::int = ANY(p_weekdays)
    THEN
      RETURN candidate;
    END IF;
  END LOOP;

  RETURN ((base_date + 7) + p_scheduled_time) AT TIME ZONE 'Europe/Lisbon';
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_queue_match_alert_notifications(
  p_title text,
  p_body text,
  p_scheduled_at timestamptz,
  p_weekdays int[] DEFAULT NULL
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  queued_count int;
  clean_weekdays int[];
  schedule_time time;
  first_run_at timestamptz;
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

  SELECT array_agg(DISTINCT weekday ORDER BY weekday)
  INTO clean_weekdays
  FROM unnest(COALESCE(p_weekdays, ARRAY[]::int[])) AS weekday;

  IF clean_weekdays IS NOT NULL AND EXISTS (
    SELECT 1 FROM unnest(clean_weekdays) AS weekday WHERE weekday < 0 OR weekday > 6
  ) THEN
    RAISE EXCEPTION 'Weekdays must be between 0 and 6';
  END IF;

  IF clean_weekdays IS NULL OR array_length(clean_weekdays, 1) IS NULL THEN
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
  END IF;

  schedule_time := (p_scheduled_at AT TIME ZONE 'Europe/Lisbon')::time;
  first_run_at := public.next_match_alert_run(
    GREATEST(now(), p_scheduled_at - interval '1 second'),
    clean_weekdays,
    schedule_time
  );

  INSERT INTO public.match_alert_schedules (
    title,
    body,
    weekdays,
    scheduled_time,
    start_at,
    next_run_at,
    created_by
  )
  VALUES (
    trim(p_title),
    trim(p_body),
    clean_weekdays,
    schedule_time,
    p_scheduled_at,
    first_run_at,
    auth.uid()
  );

  SELECT count(*) INTO queued_count
  FROM user_profiles
  WHERE COALESCE(user_profiles.is_blocked, false) = false
    AND public.user_has_trade_matches(user_profiles.id);

  RETURN queued_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_due_match_alert_schedules()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  schedule_record public.match_alert_schedules%ROWTYPE;
  queued_total int := 0;
  queued_count int;
BEGIN
  FOR schedule_record IN
    SELECT *
    FROM public.match_alert_schedules
    WHERE active = true
      AND next_run_at <= now()
    ORDER BY next_run_at ASC
    LIMIT 20
  LOOP
    INSERT INTO app_notifications (user_id, title, body, data, scheduled_at)
    SELECT
      user_profiles.id,
      schedule_record.title,
      schedule_record.body,
      jsonb_build_object(
        'type', 'match_alert',
        'schedule_id', schedule_record.id,
        'weekday', EXTRACT(DOW FROM schedule_record.next_run_at AT TIME ZONE 'Europe/Lisbon')::int
      ),
      now()
    FROM user_profiles
    WHERE COALESCE(user_profiles.is_blocked, false) = false
      AND public.user_has_trade_matches(user_profiles.id);

    GET DIAGNOSTICS queued_count = ROW_COUNT;
    queued_total := queued_total + queued_count;

    UPDATE public.match_alert_schedules
    SET
      last_run_at = schedule_record.next_run_at,
      next_run_at = public.next_match_alert_run(schedule_record.next_run_at, schedule_record.weekdays, schedule_record.scheduled_time),
      updated_at = now()
    WHERE id = schedule_record.id;
  END LOOP;

  RETURN queued_total;
END;
$$;

REVOKE ALL ON FUNCTION public.next_match_alert_run(timestamptz, int[], time) FROM public;
REVOKE ALL ON FUNCTION public.process_due_match_alert_schedules() FROM public;
REVOKE ALL ON FUNCTION public.admin_queue_match_alert_notifications(text, text, timestamptz, int[]) FROM public;
GRANT EXECUTE ON FUNCTION public.process_due_match_alert_schedules() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_queue_match_alert_notifications(text, text, timestamptz, int[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
