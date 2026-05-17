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
  SET
    image_url = COALESCE(p_image_url, ''),
    rarity = public.calculate_sticker_rarity(name, COALESCE(p_image_url, ''))
  WHERE id = p_sticker_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_sticker_image(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.update_sticker_image(uuid, text) TO authenticated;
