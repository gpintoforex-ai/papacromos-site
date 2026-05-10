/*
  # Add global sticker images

  Lets authenticated users upload a real sticker image and update the shared
  image shown to every user for that sticker.
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sticker-images',
  'sticker-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

DROP POLICY IF EXISTS "Anyone can view sticker images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload sticker images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete sticker images" ON storage.objects;

CREATE POLICY "Anyone can view sticker images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'sticker-images');

CREATE POLICY "Authenticated users can upload sticker images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'sticker-images');

CREATE POLICY "Admins can delete sticker images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'sticker-images'
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.is_admin = true
    )
  );

CREATE OR REPLACE FUNCTION public.update_sticker_image(
  p_sticker_id uuid,
  p_image_url text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF COALESCE(p_image_url, '') = '' AND NOT EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
  ) THEN
    RAISE EXCEPTION 'Only admins can remove sticker images';
  END IF;

  UPDATE stickers
  SET image_url = COALESCE(p_image_url, '')
  WHERE id = p_sticker_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_sticker_image(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.update_sticker_image(uuid, text) TO authenticated;
