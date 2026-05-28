CREATE OR REPLACE FUNCTION public.admin_swap_sticker_images(
  p_source_sticker_id uuid,
  p_target_sticker_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source stickers%ROWTYPE;
  v_target stickers%ROWTYPE;
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_source_sticker_id IS NULL OR p_target_sticker_id IS NULL THEN
    RAISE EXCEPTION 'Sticker ids are required';
  END IF;

  IF p_source_sticker_id = p_target_sticker_id THEN
    RETURN;
  END IF;

  SELECT * INTO v_source
  FROM stickers
  WHERE id = p_source_sticker_id
  FOR UPDATE;

  SELECT * INTO v_target
  FROM stickers
  WHERE id = p_target_sticker_id
  FOR UPDATE;

  IF v_source.id IS NULL OR v_target.id IS NULL THEN
    RAISE EXCEPTION 'Sticker not found';
  END IF;

  IF v_source.collection_id <> v_target.collection_id THEN
    RAISE EXCEPTION 'Stickers must belong to the same collection';
  END IF;

  UPDATE stickers
  SET image_url = COALESCE(v_target.image_url, '')
  WHERE id = v_source.id;

  UPDATE stickers
  SET image_url = COALESCE(v_source.image_url, '')
  WHERE id = v_target.id;

  PERFORM public.write_audit_log(
    'admin_sticker_images_swapped',
    'collection',
    v_source.collection_id,
    NULL,
    jsonb_build_object(
      'source_sticker_id', v_source.id,
      'source_number', v_source.number,
      'target_sticker_id', v_target.id,
      'target_number', v_target.number
    ),
    NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_swap_sticker_images(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_swap_sticker_images(uuid, uuid) TO authenticated;
