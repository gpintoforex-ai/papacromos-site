CREATE OR REPLACE FUNCTION public.find_user_matches(p_user_id uuid DEFAULT auth.uid())
RETURNS TABLE (
  other_user_id uuid,
  other_username text,
  other_avatar_seed text,
  offered_sticker_id uuid,
  offered_sticker_name text,
  offered_sticker_number int,
  offered_sticker_image_url text,
  offered_sticker_rarity text,
  offered_available_quantity int,
  requested_sticker_id uuid,
  requested_sticker_name text,
  requested_sticker_number int,
  requested_sticker_image_url text,
  requested_sticker_rarity text,
  requested_available_quantity int
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH current_user_id AS (
    SELECT COALESCE(p_user_id, auth.uid()) AS id
    WHERE COALESCE(p_user_id, auth.uid()) = auth.uid()
  ),
  my_owned AS (
    SELECT us.sticker_id
    FROM user_stickers us
    JOIN current_user_id me ON me.id = us.user_id
    JOIN stickers s ON s.id = us.sticker_id
    WHERE us.status = 'have'
      AND COALESCE(us.quantity, 0) > 0
      AND NOT EXISTS (
        SELECT 1
        FROM user_collection_preferences ucp
        WHERE ucp.user_id = us.user_id
          AND ucp.collection_id = s.collection_id
          AND ucp.is_active = false
      )
  ),
  my_repeated AS (
    SELECT us.sticker_id, GREATEST(COALESCE(us.quantity, 0) - 1, 0)::int AS available_quantity
    FROM user_stickers us
    JOIN current_user_id me ON me.id = us.user_id
    JOIN stickers s ON s.id = us.sticker_id
    WHERE us.status = 'have'
      AND COALESCE(us.quantity, 0) > 1
      AND NOT EXISTS (
        SELECT 1
        FROM user_collection_preferences ucp
        WHERE ucp.user_id = us.user_id
          AND ucp.collection_id = s.collection_id
          AND ucp.is_active = false
      )
  ),
  my_wants AS (
    SELECT us.sticker_id
    FROM user_stickers us
    JOIN current_user_id me ON me.id = us.user_id
    JOIN stickers s ON s.id = us.sticker_id
    WHERE us.status = 'want'
      AND NOT EXISTS (
        SELECT 1
        FROM user_collection_preferences ucp
        WHERE ucp.user_id = us.user_id
          AND ucp.collection_id = s.collection_id
          AND ucp.is_active = false
      )
    UNION
    SELECT s.id AS sticker_id
    FROM stickers s
    JOIN current_user_id me ON true
    WHERE NOT EXISTS (
        SELECT 1
        FROM user_collection_preferences ucp
        WHERE ucp.user_id = me.id
          AND ucp.collection_id = s.collection_id
          AND ucp.is_active = false
      )
      AND NOT EXISTS (
        SELECT 1
        FROM my_owned mo
        WHERE mo.sticker_id = s.id
      )
  ),
  other_owned AS (
    SELECT us.user_id, us.sticker_id
    FROM user_stickers us
    JOIN user_profiles up ON up.id = us.user_id
    JOIN current_user_id me ON up.id <> me.id
    JOIN stickers s ON s.id = us.sticker_id
    WHERE us.status = 'have'
      AND COALESCE(us.quantity, 0) > 0
      AND NOT EXISTS (
        SELECT 1
        FROM user_collection_preferences ucp
        WHERE ucp.user_id = us.user_id
          AND ucp.collection_id = s.collection_id
          AND ucp.is_active = false
      )
  ),
  other_repeated AS (
    SELECT us.user_id, us.sticker_id, GREATEST(COALESCE(us.quantity, 0) - 1, 0)::int AS available_quantity
    FROM user_stickers us
    JOIN user_profiles up ON up.id = us.user_id
    JOIN current_user_id me ON up.id <> me.id
    JOIN stickers s ON s.id = us.sticker_id
    WHERE us.status = 'have'
      AND COALESCE(us.quantity, 0) > 1
      AND NOT EXISTS (
        SELECT 1
        FROM user_collection_preferences ucp
        WHERE ucp.user_id = us.user_id
          AND ucp.collection_id = s.collection_id
          AND ucp.is_active = false
      )
  ),
  other_wants AS (
    SELECT us.user_id, us.sticker_id
    FROM user_stickers us
    JOIN user_profiles up ON up.id = us.user_id
    JOIN current_user_id me ON up.id <> me.id
    JOIN stickers s ON s.id = us.sticker_id
    WHERE us.status = 'want'
      AND NOT EXISTS (
        SELECT 1
        FROM user_collection_preferences ucp
        WHERE ucp.user_id = us.user_id
          AND ucp.collection_id = s.collection_id
          AND ucp.is_active = false
      )
    UNION
    SELECT up.id AS user_id, mr.sticker_id
    FROM user_profiles up
    JOIN current_user_id me ON up.id <> me.id
    JOIN my_repeated mr ON true
    JOIN stickers s ON s.id = mr.sticker_id
    WHERE NOT EXISTS (
        SELECT 1
        FROM user_collection_preferences ucp
        WHERE ucp.user_id = up.id
          AND ucp.collection_id = s.collection_id
          AND ucp.is_active = false
      )
      AND NOT EXISTS (
        SELECT 1
        FROM other_owned oo
        WHERE oo.user_id = up.id
          AND oo.sticker_id = mr.sticker_id
      )
  )
  SELECT DISTINCT
    up.id AS other_user_id,
    up.username AS other_username,
    up.avatar_seed AS other_avatar_seed,
    offered.id AS offered_sticker_id,
    offered.name AS offered_sticker_name,
    offered.number AS offered_sticker_number,
    offered.image_url AS offered_sticker_image_url,
    offered.rarity AS offered_sticker_rarity,
    mr.available_quantity AS offered_available_quantity,
    requested.id AS requested_sticker_id,
    requested.name AS requested_sticker_name,
    requested.number AS requested_sticker_number,
    requested.image_url AS requested_sticker_image_url,
    requested.rarity AS requested_sticker_rarity,
    other_repeated.available_quantity AS requested_available_quantity
  FROM other_wants ow
  JOIN my_repeated mr ON mr.sticker_id = ow.sticker_id
  JOIN other_repeated ON other_repeated.user_id = ow.user_id
  JOIN my_wants mw ON mw.sticker_id = other_repeated.sticker_id
  JOIN user_profiles up ON up.id = ow.user_id
  JOIN stickers offered ON offered.id = mr.sticker_id
  JOIN stickers requested ON requested.id = other_repeated.sticker_id
  ORDER BY up.username, offered.number, requested.number;
$$;

REVOKE ALL ON FUNCTION public.find_user_matches(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.find_user_matches(uuid) TO authenticated;
