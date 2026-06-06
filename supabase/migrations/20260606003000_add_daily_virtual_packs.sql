-- Daily virtual sticker pack rewards.

CREATE TABLE IF NOT EXISTS public.user_virtual_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'Europe/Lisbon')::date),
  sticker_id uuid REFERENCES public.stickers(id) ON DELETE SET NULL,
  points int NOT NULL DEFAULT 0 CHECK (points >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, reward_date)
);

ALTER TABLE public.user_virtual_packs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_user_virtual_packs_user_date
  ON public.user_virtual_packs(user_id, reward_date DESC);

DROP POLICY IF EXISTS "Users can view own virtual packs" ON public.user_virtual_packs;
CREATE POLICY "Users can view own virtual packs"
  ON public.user_virtual_packs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.current_user_is_admin());

CREATE OR REPLACE FUNCTION public.open_daily_virtual_pack()
RETURNS TABLE (
  pack_id uuid,
  reward_date date,
  sticker_id uuid,
  sticker_number int,
  sticker_name text,
  sticker_image_url text,
  sticker_rarity text,
  collection_name text,
  points int,
  already_opened boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  today date := (now() AT TIME ZONE 'Europe/Lisbon')::date;
  selected_sticker public.stickers%ROWTYPE;
  reward_points int;
  existing_pack public.user_virtual_packs%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Sessao invalida.';
  END IF;

  SELECT *
  INTO existing_pack
  FROM public.user_virtual_packs
  WHERE user_id = current_user_id
    AND reward_date = today;

  IF FOUND THEN
    RETURN QUERY
    SELECT
      existing_pack.id,
      existing_pack.reward_date,
      stickers.id,
      stickers.number,
      stickers.name,
      stickers.image_url,
      stickers.rarity,
      collections.name,
      existing_pack.points,
      true,
      existing_pack.created_at
    FROM public.user_virtual_packs
    LEFT JOIN public.stickers ON stickers.id = existing_pack.sticker_id
    LEFT JOIN public.collections ON collections.id = stickers.collection_id
    WHERE user_virtual_packs.id = existing_pack.id;
    RETURN;
  END IF;

  SELECT *
  INTO selected_sticker
  FROM public.stickers
  ORDER BY random()
  LIMIT 1;

  IF selected_sticker.id IS NULL THEN
    RAISE EXCEPTION 'Ainda nao existem cromos para a saqueta virtual.';
  END IF;

  reward_points := CASE selected_sticker.rarity
    WHEN 'legendary' THEN 100
    WHEN 'rare' THEN 60
    WHEN 'uncommon' THEN 35
    ELSE 20
  END;

  INSERT INTO public.user_virtual_packs (user_id, reward_date, sticker_id, points)
  VALUES (current_user_id, today, selected_sticker.id, reward_points)
  RETURNING * INTO existing_pack;

  RETURN QUERY
  SELECT
    existing_pack.id,
    existing_pack.reward_date,
    stickers.id,
    stickers.number,
    stickers.name,
    stickers.image_url,
    stickers.rarity,
    collections.name,
    existing_pack.points,
    false,
    existing_pack.created_at
  FROM public.user_virtual_packs
  LEFT JOIN public.stickers ON stickers.id = existing_pack.sticker_id
  LEFT JOIN public.collections ON collections.id = stickers.collection_id
  WHERE user_virtual_packs.id = existing_pack.id;
END;
$$;

REVOKE ALL ON FUNCTION public.open_daily_virtual_pack() FROM public;
GRANT EXECUTE ON FUNCTION public.open_daily_virtual_pack() TO authenticated;

NOTIFY pgrst, 'reload schema';
