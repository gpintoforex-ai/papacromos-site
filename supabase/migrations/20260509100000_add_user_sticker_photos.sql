/*
  # Add user sticker photos
*/

ALTER TABLE user_stickers
  ADD COLUMN IF NOT EXISTS photo_url text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sticker-photos',
  'sticker-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

DROP POLICY IF EXISTS "Anyone can view sticker photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own sticker photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own sticker photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own sticker photos" ON storage.objects;

CREATE POLICY "Anyone can view sticker photos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'sticker-photos');

CREATE POLICY "Users can upload own sticker photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'sticker-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update own sticker photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'sticker-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'sticker-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own sticker photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'sticker-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
