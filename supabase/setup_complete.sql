/*
  Papa Cromos complete database setup.

  Run this in Supabase SQL Editor for the project used by .env.
  It is safe to run more than once: tables/columns/indexes/policies are
  created only when missing or replaced where needed.
*/

CREATE TABLE IF NOT EXISTS collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  image_url text DEFAULT '',
  total_stickers int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stickers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  number int NOT NULL DEFAULT 0,
  name text NOT NULL,
  image_url text DEFAULT '',
  rarity text NOT NULL DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'legendary')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  avatar_seed text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS user_stickers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sticker_id uuid NOT NULL REFERENCES stickers(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'have' CHECK (status IN ('have', 'want')),
  quantity int NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, sticker_id, status)
);

ALTER TABLE user_stickers
  ADD COLUMN IF NOT EXISTS photo_url text;

CREATE TABLE IF NOT EXISTS trade_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  offered_sticker_id uuid NOT NULL REFERENCES stickers(id) ON DELETE CASCADE,
  requested_sticker_id uuid NOT NULL REFERENCES stickers(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'completed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE trade_offers
  ADD COLUMN IF NOT EXISTS delivery_method text NOT NULL DEFAULT 'presencial'
    CHECK (delivery_method IN ('presencial', 'correio', 'outro')),
  ADD COLUMN IF NOT EXISTS note text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS trade_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL REFERENCES trade_offers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE stickers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stickers ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_user_stickers_user_id ON user_stickers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_stickers_sticker_id ON user_stickers(sticker_id);
CREATE INDEX IF NOT EXISTS idx_user_stickers_status ON user_stickers(status);
CREATE INDEX IF NOT EXISTS idx_trade_offers_from_user ON trade_offers(from_user_id);
CREATE INDEX IF NOT EXISTS idx_trade_offers_to_user ON trade_offers(to_user_id);
CREATE INDEX IF NOT EXISTS idx_trade_messages_trade_id ON trade_messages(trade_id);
CREATE INDEX IF NOT EXISTS idx_trade_messages_user_id ON trade_messages(user_id);

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

DROP POLICY IF EXISTS "Authenticated users can view collections" ON collections;
DROP POLICY IF EXISTS "Admins can manage collections" ON collections;
DROP POLICY IF EXISTS "Authenticated users can view stickers" ON stickers;
DROP POLICY IF EXISTS "Admins can manage stickers" ON stickers;
DROP POLICY IF EXISTS "Anyone can view user profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view own stickers" ON user_stickers;
DROP POLICY IF EXISTS "Users can view other users stickers for matching" ON user_stickers;
DROP POLICY IF EXISTS "Users can insert own stickers" ON user_stickers;
DROP POLICY IF EXISTS "Users can update own stickers" ON user_stickers;
DROP POLICY IF EXISTS "Users can delete own stickers" ON user_stickers;
DROP POLICY IF EXISTS "Users can view trades involving them" ON trade_offers;
DROP POLICY IF EXISTS "Users can create trade offers" ON trade_offers;
DROP POLICY IF EXISTS "Users can update trades involving them" ON trade_offers;
DROP POLICY IF EXISTS "Users can view messages for their trades" ON trade_messages;
DROP POLICY IF EXISTS "Users can create messages for their trades" ON trade_messages;
DROP POLICY IF EXISTS "Anyone can view sticker photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own sticker photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own sticker photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own sticker photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view sticker images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload sticker images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete sticker images" ON storage.objects;

CREATE POLICY "Authenticated users can view collections"
  ON collections FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage collections"
  ON collections FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Authenticated users can view stickers"
  ON stickers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage stickers"
  ON stickers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Anyone can view user profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view own stickers"
  ON user_stickers FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view other users stickers for matching"
  ON user_stickers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own stickers"
  ON user_stickers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stickers"
  ON user_stickers FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own stickers"
  ON user_stickers FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view trades involving them"
  ON trade_offers FOR SELECT
  TO authenticated
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Users can create trade offers"
  ON trade_offers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Users can update trades involving them"
  ON trade_offers FOR UPDATE
  TO authenticated
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id)
  WITH CHECK (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Users can view messages for their trades"
  ON trade_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM trade_offers
      WHERE trade_offers.id = trade_messages.trade_id
        AND (trade_offers.from_user_id = auth.uid() OR trade_offers.to_user_id = auth.uid())
    )
  );

CREATE POLICY "Users can create messages for their trades"
  ON trade_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM trade_offers
      WHERE trade_offers.id = trade_messages.trade_id
        AND (trade_offers.from_user_id = auth.uid() OR trade_offers.to_user_id = auth.uid())
    )
  );

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

CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE id = auth.uid()
      AND is_admin = true
      AND is_blocked = false
  );
$$;

CREATE OR REPLACE FUNCTION public.admin_update_user_profile(
  p_user_id uuid,
  p_username text,
  p_phone text,
  p_city text,
  p_is_admin boolean,
  p_is_blocked boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_user_id = auth.uid() THEN
    p_is_admin := true;
    p_is_blocked := false;
  END IF;

  UPDATE user_profiles
  SET
    username = NULLIF(trim(p_username), ''),
    phone = NULLIF(trim(COALESCE(p_phone, '')), ''),
    city = NULLIF(trim(COALESCE(p_city, '')), ''),
    is_admin = COALESCE(p_is_admin, false),
    is_blocked = COALESCE(p_is_blocked, false)
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete current admin account';
  END IF;

  DELETE FROM auth.users
  WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.current_user_is_admin() FROM public;
REVOKE ALL ON FUNCTION public.admin_update_user_profile(uuid, text, text, text, boolean, boolean) FROM public;
REVOKE ALL ON FUNCTION public.admin_delete_user(uuid) FROM public;

GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_profile(uuid, text, text, text, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  DELETE FROM auth.users
  WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.delete_own_account() FROM public;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;

UPDATE user_profiles
SET is_admin = true
WHERE lower(email) = 'admin@admin.pt';

DELETE FROM stickers
WHERE collection_id = 'b2026000-0000-4000-8000-000000000001';

INSERT INTO collections (id, name, description, image_url, total_stickers)
VALUES (
  'b2026000-0000-4000-8000-000000000001',
  'Caderneta Mundial 2026',
  'Uma caderneta comunitaria independente inspirada no grande torneio mundial de futebol. Cada selecao tem escudo, foto de equipa e 18 jogadores.',
  'https://images.pexels.com/photos/46798/the-ball-stadion-football-the-pitch.jpg?auto=compress&cs=tinysrgb&w=800',
  960
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  image_url = EXCLUDED.image_url,
  total_stickers = EXCLUDED.total_stickers;

WITH teams(team_order, team_name) AS (
  VALUES
    (1, 'México'),
    (2, 'África do Sul'),
    (3, 'República da Coreia'),
    (4, 'Tchéquia'),
    (5, 'Canadá'),
    (6, 'Bósnia e Herzegovina'),
    (7, 'Catar'),
    (8, 'Suíça'),
    (9, 'Brasil'),
    (10, 'Marrocos'),
    (11, 'Haiti'),
    (12, 'Escócia'),
    (13, 'Estados Unidos'),
    (14, 'Austrália'),
    (15, 'Paraguai'),
    (16, 'Turquia'),
    (17, 'Alemanha'),
    (18, 'Curaçau'),
    (19, 'Costa do Marfim'),
    (20, 'Equador'),
    (21, 'Holanda'),
    (22, 'Japão'),
    (23, 'Suécia'),
    (24, 'Tunísia'),
    (25, 'Bélgica'),
    (26, 'Egito'),
    (27, 'RI do Irã'),
    (28, 'Nova Zelândia'),
    (29, 'Espanha'),
    (30, 'Cabo Verde'),
    (31, 'Arábia Saudita'),
    (32, 'Uruguai'),
    (33, 'França'),
    (34, 'Iraque'),
    (35, 'Noruega'),
    (36, 'Senegal'),
    (37, 'Argentina'),
    (38, 'Argélia'),
    (39, 'Áustria'),
    (40, 'Jordânia'),
    (41, 'Portugal'),
    (42, 'RD do Congo'),
    (43, 'Uzbequistão'),
    (44, 'Colômbia'),
    (45, 'Inglaterra'),
    (46, 'Croácia'),
    (47, 'Gana'),
    (48, 'Panamá')
),
slots(slot_order, slot_name, rarity) AS (
  SELECT
    slot_order,
    CASE
      WHEN slot_order = 1 THEN 'Escudo'
      WHEN slot_order = 13 THEN 'Foto de equipa'
      WHEN slot_order < 13 THEN 'Jogador ' || lpad((slot_order - 1)::text, 2, '0')
      ELSE 'Jogador ' || lpad((slot_order - 2)::text, 2, '0')
    END AS slot_name,
    CASE
      WHEN slot_order IN (1, 13) THEN 'rare'
      WHEN slot_order IN (7, 19, 20) THEN 'uncommon'
      WHEN slot_order = 18 THEN 'legendary'
      ELSE 'common'
    END AS rarity
  FROM generate_series(1, 20) AS slot_order
),
album_stickers AS (
  SELECT
    'b2026000-0000-4000-8000-000000000001'::uuid AS collection_id,
    ((teams.team_order - 1) * 20 + slots.slot_order) AS number,
    teams.team_name || ' - ' || slots.slot_name AS name,
    CASE
      WHEN slots.slot_order = 1 THEN 'https://images.pexels.com/photos/399187/pexels-photo-399187.jpeg?auto=compress&cs=tinysrgb&w=400'
      WHEN slots.slot_order = 13 THEN 'https://images.pexels.com/photos/399187/pexels-photo-399187.jpeg?auto=compress&cs=tinysrgb&w=600'
      WHEN slots.slot_order = 18 THEN 'https://images.pexels.com/photos/114296/pexels-photo-114296.jpeg?auto=compress&cs=tinysrgb&w=400'
      ELSE 'https://images.pexels.com/photos/46798/the-ball-stadion-football-the-pitch.jpg?auto=compress&cs=tinysrgb&w=400'
    END AS image_url,
    slots.rarity
  FROM teams
  CROSS JOIN slots
)
INSERT INTO stickers (collection_id, number, name, image_url, rarity)
SELECT collection_id, number, name, image_url, rarity
FROM album_stickers
WHERE NOT EXISTS (
  SELECT 1
  FROM stickers
  WHERE stickers.collection_id = album_stickers.collection_id
    AND stickers.number = album_stickers.number
);
