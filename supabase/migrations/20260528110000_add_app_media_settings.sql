CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view app settings" ON app_settings;
CREATE POLICY "Anyone can view app settings"
  ON app_settings FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Admins can insert app settings" ON app_settings;
CREATE POLICY "Admins can insert app settings"
  ON app_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_is_admin());

DROP POLICY IF EXISTS "Admins can update app settings" ON app_settings;
CREATE POLICY "Admins can update app settings"
  ON app_settings FOR UPDATE
  TO authenticated
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'app-media',
  'app-media',
  true,
  52428800,
  ARRAY['video/mp4', 'video/webm', 'video/quicktime']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['video/mp4', 'video/webm', 'video/quicktime'];

DROP POLICY IF EXISTS "Anyone can view app media" ON storage.objects;
CREATE POLICY "Anyone can view app media"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'app-media');

DROP POLICY IF EXISTS "Admins can upload app media" ON storage.objects;
CREATE POLICY "Admins can upload app media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'app-media' AND public.current_user_is_admin());

DROP POLICY IF EXISTS "Admins can update app media" ON storage.objects;
CREATE POLICY "Admins can update app media"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'app-media' AND public.current_user_is_admin())
  WITH CHECK (bucket_id = 'app-media' AND public.current_user_is_admin());

DROP POLICY IF EXISTS "Admins can delete app media" ON storage.objects;
CREATE POLICY "Admins can delete app media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'app-media' AND public.current_user_is_admin());
