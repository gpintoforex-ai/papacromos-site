-- Collector avatar cards for daily virtual packs.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS avatar_image_url text,
  ADD COLUMN IF NOT EXISTS avatar_card_created_at timestamptz;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'collector-avatars',
  'collector-avatars',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp'];

DROP POLICY IF EXISTS "Anyone can view collector avatars" ON storage.objects;
CREATE POLICY "Anyone can view collector avatars"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'collector-avatars');

DROP POLICY IF EXISTS "Users can upload own collector avatar" ON storage.objects;
CREATE POLICY "Users can upload own collector avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'collector-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update own collector avatar" ON storage.objects;
CREATE POLICY "Users can update own collector avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'collector-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'collector-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete own collector avatar" ON storage.objects;
CREATE POLICY "Users can delete own collector avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'collector-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

ALTER TABLE public.user_virtual_packs
  ADD COLUMN IF NOT EXISTS reward_type text NOT NULL DEFAULT 'sticker',
  ADD COLUMN IF NOT EXISTS collector_user_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_virtual_packs_collector_user_id_fkey'
  ) THEN
    ALTER TABLE public.user_virtual_packs
      ADD CONSTRAINT user_virtual_packs_collector_user_id_fkey
      FOREIGN KEY (collector_user_id)
      REFERENCES public.user_profiles(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

ALTER TABLE public.user_virtual_packs
  DROP CONSTRAINT IF EXISTS user_virtual_packs_reward_type_check;

ALTER TABLE public.user_virtual_packs
  ADD CONSTRAINT user_virtual_packs_reward_type_check
  CHECK (reward_type IN ('sticker', 'collector'));

CREATE INDEX IF NOT EXISTS idx_user_virtual_packs_collector_user
  ON public.user_virtual_packs(collector_user_id)
  WHERE collector_user_id IS NOT NULL;

DROP FUNCTION IF EXISTS public.open_daily_virtual_pack();

CREATE OR REPLACE FUNCTION public.open_daily_virtual_pack()
RETURNS TABLE (
  pack_id uuid,
  reward_date date,
  reward_type text,
  sticker_id uuid,
  sticker_number int,
  sticker_name text,
  sticker_image_url text,
  sticker_rarity text,
  collection_name text,
  collector_user_id uuid,
  collector_username text,
  collector_avatar_image_url text,
  collector_city text,
  collector_status text,
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
  selected_collector public.user_profiles%ROWTYPE;
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
      existing_pack.reward_type,
      stickers.id,
      stickers.number,
      stickers.name,
      stickers.image_url,
      stickers.rarity,
      collections.name,
      collector.id,
      collector.username,
      collector.avatar_image_url,
      collector.city,
      collector.status,
      existing_pack.points,
      true,
      existing_pack.created_at
    FROM public.user_virtual_packs
    LEFT JOIN public.stickers ON stickers.id = existing_pack.sticker_id
    LEFT JOIN public.collections ON collections.id = stickers.collection_id
    LEFT JOIN public.user_profiles collector ON collector.id = existing_pack.collector_user_id
    WHERE user_virtual_packs.id = existing_pack.id;
    RETURN;
  END IF;

  SELECT *
  INTO selected_collector
  FROM public.user_profiles
  WHERE id <> current_user_id
    AND COALESCE(is_blocked, false) = false
    AND NULLIF(avatar_image_url, '') IS NOT NULL
  ORDER BY random()
  LIMIT 1;

  IF selected_collector.id IS NOT NULL THEN
    reward_points := CASE selected_collector.status
      WHEN 'king_cromo' THEN 90
      ELSE 50
    END;

    INSERT INTO public.user_virtual_packs (user_id, reward_date, collector_user_id, reward_type, points)
    VALUES (current_user_id, today, selected_collector.id, 'collector', reward_points)
    RETURNING * INTO existing_pack;
  ELSE
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

    INSERT INTO public.user_virtual_packs (user_id, reward_date, sticker_id, reward_type, points)
    VALUES (current_user_id, today, selected_sticker.id, 'sticker', reward_points)
    RETURNING * INTO existing_pack;
  END IF;

  RETURN QUERY
  SELECT
    existing_pack.id,
    existing_pack.reward_date,
    existing_pack.reward_type,
    stickers.id,
    stickers.number,
    stickers.name,
    stickers.image_url,
    stickers.rarity,
    collections.name,
    collector.id,
    collector.username,
    collector.avatar_image_url,
    collector.city,
    collector.status,
    existing_pack.points,
    false,
    existing_pack.created_at
  FROM public.user_virtual_packs
  LEFT JOIN public.stickers ON stickers.id = existing_pack.sticker_id
  LEFT JOIN public.collections ON collections.id = stickers.collection_id
  LEFT JOIN public.user_profiles collector ON collector.id = existing_pack.collector_user_id
  WHERE user_virtual_packs.id = existing_pack.id;
END;
$$;

REVOKE ALL ON FUNCTION public.open_daily_virtual_pack() FROM public;
GRANT EXECUTE ON FUNCTION public.open_daily_virtual_pack() TO authenticated;

NOTIFY pgrst, 'reload schema';
