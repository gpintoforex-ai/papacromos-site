-- Admin-managed SMTP settings for Edge Function email delivery.
-- The SMTP password is stored server-side and is never returned by the admin read RPC.

CREATE TABLE IF NOT EXISTS public.email_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  smtp_host text NOT NULL DEFAULT '',
  smtp_port int NOT NULL DEFAULT 587 CHECK (smtp_port > 0 AND smtp_port <= 65535),
  smtp_user text NOT NULL DEFAULT '',
  smtp_pass text NOT NULL DEFAULT '',
  smtp_pass_configured boolean NOT NULL DEFAULT false,
  smtp_secure boolean NOT NULL DEFAULT false,
  email_from text NOT NULL DEFAULT '',
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.email_settings (id)
VALUES (true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view email settings" ON public.email_settings;
CREATE POLICY "Admins can view email settings"
  ON public.email_settings FOR SELECT
  TO authenticated
  USING (public.current_user_is_admin());

DROP POLICY IF EXISTS "Admins can update email settings" ON public.email_settings;
CREATE POLICY "Admins can update email settings"
  ON public.email_settings FOR UPDATE
  TO authenticated
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());

CREATE OR REPLACE FUNCTION public.admin_get_email_settings()
RETURNS TABLE (
  smtp_host text,
  smtp_port int,
  smtp_user text,
  smtp_secure boolean,
  email_from text,
  smtp_pass_configured boolean,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  SELECT
    email_settings.smtp_host,
    email_settings.smtp_port,
    email_settings.smtp_user,
    email_settings.smtp_secure,
    email_settings.email_from,
    email_settings.smtp_pass_configured OR email_settings.smtp_pass <> '',
    email_settings.updated_at
  FROM public.email_settings
  WHERE id = true;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_save_email_settings(
  p_smtp_host text,
  p_smtp_port int,
  p_smtp_user text,
  p_smtp_pass text,
  p_smtp_secure boolean,
  p_email_from text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_pass text;
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF COALESCE(p_smtp_port, 0) <= 0 OR COALESCE(p_smtp_port, 0) > 65535 THEN
    RAISE EXCEPTION 'SMTP port is invalid';
  END IF;

  SELECT smtp_pass INTO current_pass
  FROM public.email_settings
  WHERE id = true;

  INSERT INTO public.email_settings (
    id,
    smtp_host,
    smtp_port,
    smtp_user,
    smtp_pass,
    smtp_pass_configured,
    smtp_secure,
    email_from,
    updated_by,
    updated_at
  )
  VALUES (
    true,
    trim(COALESCE(p_smtp_host, '')),
    p_smtp_port,
    trim(COALESCE(p_smtp_user, '')),
    COALESCE(NULLIF(p_smtp_pass, ''), current_pass, ''),
    COALESCE(NULLIF(p_smtp_pass, ''), current_pass, '') <> '',
    COALESCE(p_smtp_secure, false),
    trim(COALESCE(p_email_from, '')),
    auth.uid(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    smtp_host = EXCLUDED.smtp_host,
    smtp_port = EXCLUDED.smtp_port,
    smtp_user = EXCLUDED.smtp_user,
    smtp_pass = EXCLUDED.smtp_pass,
    smtp_pass_configured = EXCLUDED.smtp_pass_configured,
    smtp_secure = EXCLUDED.smtp_secure,
    email_from = EXCLUDED.email_from,
    updated_by = EXCLUDED.updated_by,
    updated_at = EXCLUDED.updated_at;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_email_settings() FROM public;
REVOKE ALL ON FUNCTION public.admin_save_email_settings(text, int, text, text, boolean, text) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_get_email_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_email_settings(text, int, text, text, boolean, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
