-- Compatibility migration in case email_settings was created before the password-state flag existed.

ALTER TABLE public.email_settings
  ADD COLUMN IF NOT EXISTS smtp_pass_configured boolean NOT NULL DEFAULT false;

UPDATE public.email_settings
SET smtp_pass_configured = true
WHERE COALESCE(smtp_pass, '') <> '';

NOTIFY pgrst, 'reload schema';
