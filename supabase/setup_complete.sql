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
  ADD COLUMN IF NOT EXISTS region text,
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

INSERT INTO collections (id, name, description, image_url, total_stickers)
VALUES (
  'b2026000-0000-4000-8000-000000000001',
  'Caderneta Mundial 2026',
  'Uma caderneta comunitaria independente inspirada no grande torneio mundial de futebol. Cada selecao tem escudo, foto de equipa e 18 jogadores.',
  '/logo.png',
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
      WHEN teams.team_name = 'Tchéquia' THEN
        CASE slots.slot_order
          WHEN 1 THEN '/stickers/tchequia/tchequia-01.png'
          WHEN 2 THEN '/stickers/tchequia/tchequia-02.png'
          WHEN 3 THEN '/stickers/tchequia/tchequia-03.png'
          WHEN 4 THEN '/stickers/tchequia/tchequia-04.png'
          WHEN 5 THEN '/stickers/tchequia/tchequia-06.png'
          WHEN 6 THEN '/stickers/tchequia/tchequia-07.png'
          WHEN 7 THEN '/stickers/tchequia/tchequia-08.png'
          WHEN 8 THEN '/stickers/tchequia/tchequia-09.png'
          WHEN 9 THEN '/stickers/tchequia/tchequia-10.png'
          WHEN 10 THEN '/stickers/tchequia/tchequia-11.png'
          WHEN 11 THEN '/stickers/tchequia/tchequia-12.png'
          WHEN 12 THEN '/stickers/tchequia/tchequia-13.png'
          WHEN 13 THEN '/stickers/tchequia/tchequia-05.png'
          WHEN 14 THEN '/stickers/tchequia/tchequia-14.png'
          WHEN 15 THEN '/stickers/tchequia/tchequia-15.png'
          WHEN 16 THEN '/stickers/tchequia/tchequia-16.png'
          WHEN 17 THEN '/stickers/tchequia/tchequia-17.png'
          WHEN 18 THEN '/stickers/tchequia/tchequia-18.png'
          WHEN 19 THEN '/stickers/tchequia/tchequia-19.png'
          WHEN 20 THEN '/stickers/tchequia/tchequia-20.png'
        END
      WHEN teams.team_name = 'República da Coreia' THEN
        CASE slots.slot_order
          WHEN 1 THEN '/stickers/republica-da-coreia/republica-da-coreia-01.png'
          WHEN 2 THEN '/stickers/republica-da-coreia/republica-da-coreia-02.png'
          WHEN 3 THEN '/stickers/republica-da-coreia/republica-da-coreia-03.png'
          WHEN 4 THEN '/stickers/republica-da-coreia/republica-da-coreia-04.png'
          WHEN 5 THEN '/stickers/republica-da-coreia/republica-da-coreia-06.png'
          WHEN 6 THEN '/stickers/republica-da-coreia/republica-da-coreia-07.png'
          WHEN 7 THEN '/stickers/republica-da-coreia/republica-da-coreia-08.png'
          WHEN 8 THEN '/stickers/republica-da-coreia/republica-da-coreia-09.png'
          WHEN 9 THEN '/stickers/republica-da-coreia/republica-da-coreia-10.png'
          WHEN 10 THEN '/stickers/republica-da-coreia/republica-da-coreia-11.png'
          WHEN 11 THEN '/stickers/republica-da-coreia/republica-da-coreia-12.png'
          WHEN 12 THEN '/stickers/republica-da-coreia/republica-da-coreia-13.png'
          WHEN 13 THEN '/stickers/republica-da-coreia/republica-da-coreia-05.png'
          WHEN 14 THEN '/stickers/republica-da-coreia/republica-da-coreia-14.png'
          WHEN 15 THEN '/stickers/republica-da-coreia/republica-da-coreia-15.png'
          WHEN 16 THEN '/stickers/republica-da-coreia/republica-da-coreia-16.png'
          WHEN 17 THEN '/stickers/republica-da-coreia/republica-da-coreia-17.png'
          WHEN 18 THEN '/stickers/republica-da-coreia/republica-da-coreia-18.png'
          WHEN 19 THEN '/stickers/republica-da-coreia/republica-da-coreia-19.png'
          WHEN 20 THEN '/stickers/republica-da-coreia/republica-da-coreia-20.png'
        END
      WHEN teams.team_name = 'África do Sul' THEN
        CASE slots.slot_order
          WHEN 1 THEN '/stickers/africa-do-sul/africa-do-sul-01.png'
          WHEN 2 THEN '/stickers/africa-do-sul/africa-do-sul-02.png'
          WHEN 3 THEN '/stickers/africa-do-sul/africa-do-sul-03.png'
          WHEN 4 THEN '/stickers/africa-do-sul/africa-do-sul-04.png'
          WHEN 5 THEN '/stickers/africa-do-sul/africa-do-sul-06.png'
          WHEN 6 THEN '/stickers/africa-do-sul/africa-do-sul-07.png'
          WHEN 7 THEN '/stickers/africa-do-sul/africa-do-sul-08.png'
          WHEN 8 THEN '/stickers/africa-do-sul/africa-do-sul-09.png'
          WHEN 9 THEN '/stickers/africa-do-sul/africa-do-sul-10.png'
          WHEN 10 THEN '/stickers/africa-do-sul/africa-do-sul-11.png'
          WHEN 11 THEN '/stickers/africa-do-sul/africa-do-sul-12.png'
          WHEN 12 THEN '/stickers/africa-do-sul/africa-do-sul-13.png'
          WHEN 13 THEN '/stickers/africa-do-sul/africa-do-sul-05.png'
          WHEN 14 THEN '/stickers/africa-do-sul/africa-do-sul-14.png'
          WHEN 15 THEN '/stickers/africa-do-sul/africa-do-sul-15.png'
          WHEN 16 THEN '/stickers/africa-do-sul/africa-do-sul-16.png'
          WHEN 17 THEN '/stickers/africa-do-sul/africa-do-sul-17.png'
          WHEN 18 THEN '/stickers/africa-do-sul/africa-do-sul-18.png'
          WHEN 19 THEN '/stickers/africa-do-sul/africa-do-sul-19.png'
          WHEN 20 THEN '/stickers/africa-do-sul/africa-do-sul-20.png'
        END
      WHEN teams.team_name = 'México' THEN
        CASE slots.slot_order
          WHEN 1 THEN '/stickers/mexico/mexico-01.png'
          WHEN 2 THEN '/stickers/mexico/mexico-02.png'
          WHEN 3 THEN '/stickers/mexico/mexico-03.png'
          WHEN 4 THEN '/stickers/mexico/mexico-04.png'
          WHEN 5 THEN '/stickers/mexico/mexico-06.png'
          WHEN 6 THEN '/stickers/mexico/mexico-07.png'
          WHEN 7 THEN '/stickers/mexico/mexico-08.png'
          WHEN 8 THEN '/stickers/mexico/mexico-09.png'
          WHEN 9 THEN '/stickers/mexico/mexico-10.png'
          WHEN 10 THEN '/stickers/mexico/mexico-11.png'
          WHEN 11 THEN '/stickers/mexico/mexico-12.png'
          WHEN 12 THEN '/stickers/mexico/mexico-13.png'
          WHEN 13 THEN '/stickers/mexico/mexico-05.png'
          WHEN 14 THEN '/stickers/mexico/mexico-14.png'
          WHEN 15 THEN '/stickers/mexico/mexico-15.png'
          WHEN 16 THEN '/stickers/mexico/mexico-16.png'
          WHEN 17 THEN '/stickers/mexico/mexico-17.png'
          WHEN 18 THEN '/stickers/mexico/mexico-18.png'
          WHEN 19 THEN '/stickers/mexico/mexico-19.png'
          WHEN 20 THEN '/stickers/mexico/mexico-20.png'
        END
      WHEN slots.slot_order = 1 THEN 'https://images.pexels.com/photos/399187/pexels-photo-399187.jpeg?auto=compress&cs=tinysrgb&w=400'
      WHEN slots.slot_order = 13 THEN 'https://images.pexels.com/photos/399187/pexels-photo-399187.jpeg?auto=compress&cs=tinysrgb&w=600'
      WHEN slots.slot_order = 18 THEN 'https://images.pexels.com/photos/114296/pexels-photo-114296.jpeg?auto=compress&cs=tinysrgb&w=400'
      ELSE 'https://images.pexels.com/photos/46798/the-ball-stadion-football-the-pitch.jpg?auto=compress&cs=tinysrgb&w=400'
    END AS image_url,
    slots.rarity
  FROM teams
  CROSS JOIN slots
),
updated_stickers AS (
  UPDATE stickers
  SET
    name = album_stickers.name,
    rarity = album_stickers.rarity
  FROM album_stickers
  WHERE stickers.collection_id = album_stickers.collection_id
    AND stickers.number = album_stickers.number
  RETURNING stickers.number
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

-- Keep corrected World 2026 player names in the full setup as well as migrations.
-- Update Algeria player names in the World 2026 album from the printed album page.

WITH algeria_stickers(local_number, sticker_name) AS (
  VALUES
    (1, 'Argelia - Escudo'),
    (2, 'Argelia - Alexis Guendouz'),
    (3, 'Argelia - Ramy Bensebaini'),
    (4, 'Argelia - Youcef Atal'),
    (5, 'Argelia - Rayan Ait-Nouri'),
    (6, 'Argelia - Mohamed Amine Tougai'),
    (7, 'Argelia - Aissa Mandi'),
    (8, 'Argelia - Ismael Bennacer'),
    (9, 'Argelia - Houssem Aouar'),
    (10, 'Argelia - Hicham Boudaoui'),
    (11, 'Argelia - Ramiz Zerrouki'),
    (12, 'Argelia - Nabil Bentaleb'),
    (13, 'Argelia - Foto de equipa'),
    (14, 'Argelia - Fares Chaibi'),
    (15, 'Argelia - Riyad Mahrez'),
    (16, 'Argelia - Said Benrahma'),
    (17, 'Argelia - Anis Hadj Moussa'),
    (18, 'Argelia - Amine Gouiri'),
    (19, 'Argelia - Baghdad Bounedjah'),
    (20, 'Argelia - Mohammed Amoura')
)
UPDATE stickers
SET name = algeria_stickers.sticker_name
FROM algeria_stickers
WHERE stickers.collection_id = 'b2026000-0000-4000-8000-000000000001'
  AND stickers.number = ((38 - 1) * 20 + algeria_stickers.local_number);

-- Update World 2026 album player names transcribed from photographed album pages.

WITH player_names(team_order, local_number, player_name) AS (
  VALUES
    -- South Africa
    (2, 2, 'Ronwen Williams'),
    (2, 3, 'Sipho Chaine'),
    (2, 4, 'Aubrey Modiba'),
    (2, 5, 'Samkelo Kabini'),
    (2, 6, 'Mbekezeli Mbokazi'),
    (2, 7, 'Khulani Ndamane'),
    (2, 8, 'Siyabonga Ngezana'),
    (2, 9, 'Khuliso Mudau'),
    (2, 10, 'Nkosinathi Sibisi'),
    (2, 11, 'Teboho Mokoena'),
    (2, 12, 'Thalente Mbatha'),
    (2, 14, 'Bathusi Aubaas'),
    (2, 15, 'Vuko Sithole'),
    (2, 16, 'Sipho Mbule'),
    (2, 17, 'Lyle Foster'),
    (2, 18, 'Iqraam Rayners'),
    (2, 19, 'Mohau Nkota'),
    (2, 20, 'Oswin Appollis'),

    -- Korea Republic
    (3, 2, 'Hyeonwoo Jo'),
    (3, 3, 'Seunggyu Kim'),
    (3, 4, 'Minjae Kim'),
    (3, 5, 'Yumin Cho'),
    (3, 6, 'Youngwoo Seol'),
    (3, 7, 'Hanbeom Lee'),
    (3, 8, 'Taeseok Lee'),
    (3, 9, 'Kangin Lee'),
    (3, 10, 'Jaesung Lee'),
    (3, 11, 'Inbeom Hwang'),
    (3, 12, 'Kangin Lee'),
    (3, 14, 'Seungho Paik'),
    (3, 15, 'Jisoo Castrop'),
    (3, 16, 'Donggyeong Lee'),
    (3, 17, 'Hyeonsung Cho'),
    (3, 18, 'Heungmin Son'),
    (3, 19, 'Heechan Hwang'),
    (3, 20, 'Hyeongyu Oh'),

    -- Czechia
    (4, 2, 'Matej Kovar'),
    (4, 3, 'Jindrich Stanek'),
    (4, 4, 'Ladislav Krejci'),
    (4, 5, 'Vladimir Coufal'),
    (4, 6, 'Jaroslav Zeleny'),
    (4, 7, 'Tomas Holes'),
    (4, 8, 'David Zima'),
    (4, 9, 'Michal Sadilek'),
    (4, 10, 'Lukas Provod'),
    (4, 11, 'Lukas Cerv'),
    (4, 12, 'Tomas Soucek'),
    (4, 14, 'Pavel Sulc'),
    (4, 15, 'Matej Vydra'),
    (4, 16, 'Vasil Kusej'),
    (4, 17, 'Tomas Chory'),
    (4, 18, 'Vaclav Cerny'),
    (4, 19, 'Adam Hlozek'),
    (4, 20, 'Patrik Schick'),

    -- Bosnia-Herzegovina
    (6, 2, 'Nikola Vasilj'),
    (6, 3, 'Amar Dedic'),
    (6, 4, 'Sead Kolasinac'),
    (6, 5, 'Tarik Muharemovic'),
    (6, 6, 'Nihad Mujakic'),
    (6, 7, 'Nikola Katic'),
    (6, 8, 'Amir Hadziahmetovic'),
    (6, 9, 'Benjamin Tahirovic'),
    (6, 10, 'Armin Gigovic'),
    (6, 11, 'Ivan Sunjic'),
    (6, 12, 'Ivan Basic'),
    (6, 14, 'Dzenis Burnic'),
    (6, 15, 'Esmir Bajraktarevic'),
    (6, 16, 'Amar Memic'),
    (6, 17, 'Ermedin Demirovic'),
    (6, 18, 'Edin Dzeko'),
    (6, 19, 'Samed Bazdar'),
    (6, 20, 'Haris Tabakovic'),

    -- Qatar
    (7, 2, 'Meshaal Barsham'),
    (7, 3, 'Sultan Al Brake'),
    (7, 4, 'Lucas Mendes'),
    (7, 5, 'Homam Ahmed'),
    (7, 6, 'Boualem Khoukhi'),
    (7, 7, 'Pedro Miguel'),
    (7, 8, 'Tarek Salman'),
    (7, 9, 'Mohammed Mannai'),
    (7, 10, 'Karim Boudiaf'),
    (7, 11, 'Assim Madibo'),
    (7, 12, 'Hamed Fathi'),
    (7, 14, 'Mohammed Waad'),
    (7, 15, 'Abdulaziz Hatem'),
    (7, 16, 'Hassan Al-Haydos'),
    (7, 17, 'Almoez Ali'),
    (7, 18, 'Akram Hassan Afif'),
    (7, 19, 'Ahmed Al-Ganehi'),
    (7, 20, 'Almoez Ali'),

    -- Switzerland
    (8, 2, 'Gregor Kobel'),
    (8, 3, 'Yvon Mvogo'),
    (8, 4, 'Manuel Akanji'),
    (8, 5, 'Ricardo Rodriguez'),
    (8, 6, 'Nico Elvedi'),
    (8, 7, 'Michel Aebischer'),
    (8, 8, 'Granit Xhaka'),
    (8, 9, 'Granit Xhaka'),
    (8, 10, 'Denis Zakaria'),
    (8, 11, 'Remo Freuler'),
    (8, 12, 'Fabian Rieder'),
    (8, 14, 'Ardon Jashari'),
    (8, 15, 'Johan Manzambi'),
    (8, 16, 'Michel Aebischer'),
    (8, 17, 'Breel Embolo'),
    (8, 18, 'Ruben Vargas'),
    (8, 19, 'Dan Ndoye'),
    (8, 20, 'Zeki Amdouni'),

    -- Brazil
    (9, 2, 'Alisson'),
    (9, 3, 'Bento'),
    (9, 4, 'Marquinhos'),
    (9, 5, 'Eder Militao'),
    (9, 6, 'Gabriel Magalhaes'),
    (9, 7, 'Danilo'),
    (9, 8, 'Wesley'),
    (9, 9, 'Lucas Paqueta'),
    (9, 10, 'Casemiro'),
    (9, 11, 'Bruno Guimaraes'),
    (9, 12, 'Luiz Henrique'),
    (9, 14, 'Vinicius Junior'),
    (9, 15, 'Rodrygo'),
    (9, 16, 'Joao Pedro'),
    (9, 17, 'Matheus Cunha'),
    (9, 18, 'Gabriel Martinelli'),
    (9, 19, 'Raphinha'),
    (9, 20, 'Estevao'),

    -- Morocco
    (10, 2, 'Yassine Bounou'),
    (10, 3, 'Munir El Kajoui'),
    (10, 4, 'Achraf Hakimi'),
    (10, 5, 'Noussair Mazraoui'),
    (10, 6, 'Nayef Aguerd'),
    (10, 7, 'Romain Saiss'),
    (10, 8, 'Jawad El Yamiq'),
    (10, 9, 'Adam Masina'),
    (10, 10, 'Sofyan Amrabat'),
    (10, 11, 'Azzedine Ounahi'),
    (10, 12, 'Eliesse Ben Seghir'),
    (10, 14, 'Bilal El Khannouss'),
    (10, 15, 'Ismael Saibari'),
    (10, 16, 'Youssef En-Nesyri'),
    (10, 17, 'Abde Ezzalzouli'),
    (10, 18, 'Soufiane Rahimi'),
    (10, 19, 'Brahim Diaz'),
    (10, 20, 'Ayoub El Kaabi'),

    -- Haiti
    (11, 2, 'Johny Placide'),
    (11, 3, 'Garissone Innocent'),
    (11, 4, 'Martin Experience'),
    (11, 5, 'Jean-Kevin Duverne'),
    (11, 6, 'Ricardo Ade'),
    (11, 7, 'Derrick Etienne Jr.'),
    (11, 8, 'Garven Metusala'),
    (11, 9, 'Hannes Delcroix'),
    (11, 10, 'Leverton Pierre'),
    (11, 11, 'Danley Jean-Jacques'),
    (11, 12, 'Jean-Harber Delva'),
    (11, 14, 'Christopher Attys'),
    (11, 15, 'Derrick Etienne Jr.'),
    (11, 16, 'Josue Casimir'),
    (11, 18, 'Duckens Nazon'),
    (11, 19, 'Louicius Deedson'),
    (11, 20, 'Frantzdy Pierrot'),

    -- Scotland
    (12, 2, 'Angus Gunn'),
    (12, 3, 'Jack Hendry'),
    (12, 4, 'Kieran Tierney'),
    (12, 5, 'Aaron Hickey'),
    (12, 6, 'Andrew Robertson'),
    (12, 7, 'Scott McKenna'),
    (12, 8, 'John Souttar'),
    (12, 9, 'Anthony Ralston'),
    (12, 10, 'Grant Hanley'),
    (12, 11, 'Scott McTominay'),
    (12, 12, 'Billy Gilmour'),
    (12, 14, 'Lewis Ferguson'),
    (12, 15, 'Ryan Christie'),
    (12, 16, 'Kenny McLean'),
    (12, 17, 'John McGinn'),
    (12, 18, 'Che Adams'),
    (12, 19, 'Che Adams'),
    (12, 20, 'Ben Gannon-Doak'),

    -- United States
    (13, 2, 'Matt Freese'),
    (13, 3, 'Chris Richards'),
    (13, 4, 'Tim Ream'),
    (13, 5, 'Mark McKenzie'),
    (13, 6, 'Alex Freeman'),
    (13, 7, 'Antonee Robinson'),
    (13, 8, 'Tyler Adams'),
    (13, 9, 'Tanner Tessmann'),
    (13, 10, 'Weston McKennie'),
    (13, 11, 'Cristian Roldan'),
    (13, 12, 'Timothy Weah'),
    (13, 14, 'Diego Luna'),
    (13, 15, 'Malik Tillman'),
    (13, 16, 'Christian Pulisic'),
    (13, 17, 'Brenden Aaronson'),
    (13, 18, 'Ricardo Pepi'),
    (13, 19, 'Haji Wright'),
    (13, 20, 'Folarin Balogun'),

    -- Australia
    (14, 2, 'Mathew Ryan'),
    (14, 3, 'Joe Gauci'),
    (14, 4, 'Harry Souttar'),
    (14, 5, 'Alessandro Circati'),
    (14, 6, 'Jordan Bos'),
    (14, 7, 'Aziz Behich'),
    (14, 8, 'Cameron Burgess'),
    (14, 9, 'Aiden Miller'),
    (14, 10, 'Milos Degenek'),
    (14, 11, 'Jackson Irvine'),
    (14, 12, 'Riley McGree'),
    (14, 14, 'Aiden O''Neill'),
    (14, 15, 'Connor Metcalfe'),
    (14, 16, 'Patrick Yazbek'),
    (14, 17, 'Craig Goodwin'),
    (14, 18, 'Kusini Yengi'),
    (14, 19, 'Nestory Irankunda'),
    (14, 20, 'Mohamed Toure'),

    -- Paraguay
    (15, 2, 'Roberto Fernandez'),
    (15, 3, 'Orlando Gill'),
    (15, 4, 'Gustavo Gomez'),
    (15, 5, 'Fabian Balbuena'),
    (15, 6, 'Juan Jose Caceres'),
    (15, 7, 'Omar Alderete'),
    (15, 8, 'Junior Alonso'),
    (15, 9, 'Matias Villasanti'),
    (15, 10, 'Diego Gomez'),
    (15, 11, 'Damian Bobadilla'),
    (15, 12, 'Andres Cubas'),
    (15, 14, 'Matias Galarza Fonda'),
    (15, 15, 'Julio Enciso'),
    (15, 16, 'Alejandro Romero Gamarra'),
    (15, 17, 'Miguel Almiron'),
    (15, 18, 'Ramon Sosa'),
    (15, 19, 'Angel Romero'),
    (15, 20, 'Antonio Sanabria'),

    -- Turkiye
    (16, 2, 'Ugurcan Cakir'),
    (16, 3, 'Mert Muldur'),
    (16, 4, 'Zeki Celik'),
    (16, 5, 'Abdulkerim Bardakci'),
    (16, 6, 'Caglar Soyuncu'),
    (16, 7, 'Merih Demiral'),
    (16, 8, 'Ferdi Kadioglu'),
    (16, 9, 'Kaan Ayhan'),
    (16, 10, 'Ismail Yuksek'),
    (16, 11, 'Hakan Calhanoglu'),
    (16, 12, 'Orkun Kokcu'),
    (16, 14, 'Arda Guler'),
    (16, 15, 'Irfan Can Kahveci'),
    (16, 16, 'Yunus Akgun'),
    (16, 17, 'Can Uzun'),
    (16, 18, 'Baris Alper Yilmaz'),
    (16, 19, 'Kerem Akturkoglu'),
    (16, 20, 'Kenan Yildiz'),

    -- Germany
    (17, 2, 'Marc-Andre ter Stegen'),
    (17, 3, 'Antonio Rudiger'),
    (17, 4, 'David Raum'),
    (17, 5, 'Nico Schlotterbeck'),
    (17, 6, 'Antonio Rudiger'),
    (17, 7, 'Waldemar Anton'),
    (17, 8, 'Ridle Baku'),
    (17, 9, 'Maximilian Mittelstadt'),
    (17, 10, 'Joshua Kimmich'),
    (17, 11, 'Florian Wirtz'),
    (17, 12, 'Felix Nmecha'),
    (17, 14, 'Leon Goretzka'),
    (17, 15, 'Jamal Musiala'),
    (17, 16, 'Serge Gnabry'),
    (17, 17, 'Kai Havertz'),
    (17, 18, 'Leroy Sane'),
    (17, 19, 'Karim Adeyemi'),
    (17, 20, 'Nick Woltemade'),

    -- Curacao
    (18, 2, 'Eloy Room'),
    (18, 3, 'Armando Obispo'),
    (18, 4, 'Sherel Floranus'),
    (18, 5, 'Junien Gaari'),
    (18, 6, 'Joshua Brenet'),
    (18, 7, 'Richon van Eijma'),
    (18, 8, 'Shurandy Sambo'),
    (18, 9, 'Livano Comenencia'),
    (18, 10, 'Godfried Roemeratoe'),
    (18, 11, 'Juninho Bacuna'),
    (18, 12, 'Leandro Bacuna'),
    (18, 14, 'Tahith Chong'),
    (18, 15, 'Kenji Gorre'),
    (18, 16, 'Jearl Margaritha'),
    (18, 17, 'Jurgen Locadia'),
    (18, 18, 'Jeremy Antonisse'),
    (18, 19, 'Gervane Kastaneer'),
    (18, 20, 'Sontje Hansen'),

    -- Cote d'Ivoire
    (19, 2, 'Yahia Fofana'),
    (19, 3, 'Ghislain Konan'),
    (19, 4, 'Wilfried Singo'),
    (19, 5, 'Odilon Kossounou'),
    (19, 6, 'Evan Ndicka'),
    (19, 7, 'Willy Boly'),
    (19, 8, 'Emmanuel Agbadou'),
    (19, 9, 'Ousmane Diomande'),
    (19, 10, 'Franck Kessie'),
    (19, 11, 'Seko Fofana'),
    (19, 12, 'Ibrahim Sangare'),
    (19, 14, 'Jean-Philippe Gbamin'),
    (19, 15, 'Amad Diallo'),
    (19, 16, 'Sebastien Haller'),
    (19, 17, 'Simon Adingra'),
    (19, 18, 'Yan Diomande'),
    (19, 19, 'Evann Guessand'),
    (19, 20, 'Oumar Diakite'),

    -- Ecuador
    (20, 2, 'Hernan Galindez'),
    (20, 3, 'Gonzalo Valle'),
    (20, 4, 'Piero Hincapie'),
    (20, 5, 'Pervis Estupinan'),
    (20, 6, 'Willian Pacho'),
    (20, 7, 'Angelo Preciado'),
    (20, 8, 'Joel Ordonez'),
    (20, 9, 'Moises Caicedo'),
    (20, 10, 'Alan Franco'),
    (20, 11, 'Kendry Paez'),
    (20, 12, 'Pedro Vite'),
    (20, 14, 'John Yeboah'),
    (20, 15, 'Leonardo Campana'),
    (20, 16, 'Gonzalo Plata'),
    (20, 17, 'Nilson Angulo'),
    (20, 18, 'Alan Minda'),
    (20, 19, 'Kevin Rodriguez'),
    (20, 20, 'Enner Valencia'),

    -- Netherlands
    (21, 2, 'Bart Verbruggen'),
    (21, 3, 'Virgil van Dijk'),
    (21, 4, 'Micky van de Ven'),
    (21, 5, 'Jurrien Timber'),
    (21, 6, 'Denzel Dumfries'),
    (21, 7, 'Nathan Ake'),
    (21, 8, 'Jeremie Frimpong'),
    (21, 9, 'Jan Paul van Hecke'),
    (21, 10, 'Tijjani Reijnders'),
    (21, 11, 'Ryan Gravenberch'),
    (21, 12, 'Teun Koopmeiners'),
    (21, 14, 'Frenkie de Jong'),
    (21, 15, 'Xavi Simons'),
    (21, 16, 'Justin Kluivert'),
    (21, 17, 'Memphis Depay'),
    (21, 18, 'Donyell Malen'),
    (21, 19, 'Wout Weghorst'),
    (21, 20, 'Cody Gakpo'),

    -- Tunisia
    (24, 2, 'Bechir Ben Said'),
    (24, 3, 'Aymen Dahmen'),
    (24, 4, 'Yan Valery'),
    (24, 5, 'Montassar Talbi'),
    (24, 6, 'Yassine Meriah'),
    (24, 7, 'Ali Abdi'),
    (24, 8, 'Dylan Bronn'),
    (24, 10, 'Aissa Laidouni'),
    (24, 11, 'Ferjani Sassi'),
    (24, 12, 'Mohamed Ali Ben Romdhane'),
    (24, 14, 'Hannibal Mejbri'),
    (24, 15, 'Elias Achouri'),
    (24, 16, 'Elias Saad'),
    (24, 17, 'Hazem Mastouri'),
    (24, 18, 'Ismael Gharbi'),
    (24, 19, 'Sayfallah Ltaief'),
    (24, 20, 'Naim Sliti'),

    -- Mexico
    (1, 2, 'Luis Malagon'),
    (1, 3, 'Johan Vasquez'),
    (1, 4, 'Jorge Sanchez'),
    (1, 5, 'Cesar Montes'),
    (1, 6, 'Jesus Gallardo'),
    (1, 7, 'Israel Reyes'),
    (1, 8, 'Diego Lainez'),
    (1, 9, 'Carlos Rodriguez'),
    (1, 10, 'Edson Alvarez'),
    (1, 11, 'Orbelin Pineda'),
    (1, 12, 'Marcel Ruiz'),
    (1, 14, 'Erick Sanchez'),
    (1, 15, 'Hirving Lozano'),
    (1, 16, 'Santiago Gimenez'),
    (1, 17, 'Raul Jimenez'),
    (1, 18, 'Alexis Vega'),
    (1, 19, 'Roberto Alvarado'),
    (1, 20, 'Cesar Huerta')
)
UPDATE stickers
SET name = split_part(stickers.name, ' - ', 1) || ' - ' || player_names.player_name
FROM player_names
WHERE stickers.collection_id = 'b2026000-0000-4000-8000-000000000001'
  AND stickers.number = ((player_names.team_order - 1) * 20 + player_names.local_number);

-- Update remaining World 2026 album player names transcribed from photographed album pages.

WITH player_names(team_order, local_number, player_name) AS (
  VALUES
    -- Egypt
    (26, 2, 'Mohamed Elshenawy'),
    (26, 3, 'Mohamed Hany'),
    (26, 4, 'Mohamed Hamdy'),
    (26, 5, 'Yasser Ibrahim'),
    (26, 6, 'Khaled Sobhi'),
    (26, 7, 'Rami Rabia'),
    (26, 8, 'Hossam Abdelmaguid'),
    (26, 9, 'Ahmed Fatouh'),
    (26, 10, 'Marwan Attia'),
    (26, 11, 'Zizo'),
    (26, 12, 'Hamdy Fathy'),
    (26, 14, 'Mohamed Lasheen'),
    (26, 15, 'Emam Ashour'),
    (26, 16, 'Osama Faisal'),
    (26, 17, 'Mohamed Salah'),
    (26, 18, 'Mostafa Mohamed'),
    (26, 19, 'Trezeguet'),
    (26, 20, 'Omar Marmoush'),

    -- Iran
    (27, 2, 'Alireza Beiranvand'),
    (27, 3, 'Morteza Pouraliganji'),
    (27, 4, 'Ehsan Hajsafi'),
    (27, 5, 'Milad Mohammadi'),
    (27, 6, 'Shojae Khalilzadeh'),
    (27, 7, 'Ramin Rezaeian'),
    (27, 8, 'Hossein Kanani'),
    (27, 9, 'Sadegh Moharrami'),
    (27, 10, 'Saleh Hardani'),
    (27, 11, 'Saeid Ezatolahi'),
    (27, 12, 'Saman Ghoddos'),
    (27, 14, 'Omid Noorafkan'),
    (27, 15, 'Roozbeh Cheshmi'),
    (27, 16, 'Mohammad Mohebi'),
    (27, 17, 'Sardar Azmoun'),
    (27, 18, 'Mehdi Taremi'),
    (27, 19, 'Alireza Jahanbakhsh'),
    (27, 20, 'Ali Gholizadeh'),

    -- New Zealand
    (28, 2, 'Max Crocombe'),
    (28, 3, 'Alex Paulsen'),
    (28, 4, 'Michael Boxall'),
    (28, 5, 'Liberato Cacace'),
    (28, 6, 'Tim Payne'),
    (28, 7, 'Tyler Bindon'),
    (28, 8, 'Francis De Vries'),
    (28, 9, 'Finn Surman'),
    (28, 10, 'Joe Bell'),
    (28, 11, 'Sarpreet Singh'),
    (28, 12, 'Ryan Thomas'),
    (28, 14, 'Matthew Garbett'),
    (28, 15, 'Marko Stamenic'),
    (28, 16, 'Ben Old'),
    (28, 17, 'Chris Wood'),
    (28, 18, 'Elijah Just'),
    (28, 19, 'Callum McCowatt'),
    (28, 20, 'Kosta Barbarouses'),

    -- Spain
    (29, 2, 'Unai Simon'),
    (29, 3, 'Robin Le Normand'),
    (29, 4, 'Aymeric Laporte'),
    (29, 5, 'Dean Huijsen'),
    (29, 6, 'Pedro Porro'),
    (29, 7, 'Dani Carvajal'),
    (29, 8, 'Marc Cucurella'),
    (29, 9, 'Martin Zubimendi'),
    (29, 10, 'Rodri'),
    (29, 11, 'Pedri'),
    (29, 12, 'Fabian Ruiz'),
    (29, 14, 'Mikel Merino'),
    (29, 15, 'Lamine Yamal'),
    (29, 16, 'Dani Olmo'),
    (29, 17, 'Nico Williams'),
    (29, 18, 'Ferran Torres'),
    (29, 19, 'Alvaro Morata'),
    (29, 20, 'Mikel Oyarzabal'),

    -- Cabo Verde
    (30, 2, 'Vozinha'),
    (30, 3, 'Logan Costa'),
    (30, 4, 'Pico'),
    (30, 5, 'Diney'),
    (30, 6, 'Steven Moreira'),
    (30, 7, 'Wagner Pina'),
    (30, 8, 'Joao Paulo'),
    (30, 9, 'Yannick Semedo'),
    (30, 10, 'Hely Tavares'),
    (30, 11, 'Patrick Andrade'),
    (30, 12, 'Jamiro Monteiro'),
    (30, 14, 'Deroy Duarte'),
    (30, 15, 'Garry Rodrigues'),
    (30, 16, 'Jovane Cabral'),
    (30, 17, 'Ryan Mendes'),
    (30, 18, 'Dailon Livramento'),
    (30, 19, 'Willy Semedo'),
    (30, 20, 'Bebe'),

    -- Saudi Arabia
    (31, 2, 'Nawaf Alaqidi'),
    (31, 3, 'Abdulrahman Al-Sanbi'),
    (31, 4, 'Saud Abdulhamid'),
    (31, 5, 'Nawaf Buwashl'),
    (31, 6, 'Jehad Thikri'),
    (31, 7, 'Moteb Alharbi'),
    (31, 8, 'Musab Aljuwayr'),
    (31, 9, 'Musab Aljuwayr'),
    (31, 10, 'Ziyad Aljohani'),
    (31, 11, 'Abdullah Al-Khaibari'),
    (31, 12, 'Nasser Al-Dawsari'),
    (31, 14, 'Saleh Abulshamat'),
    (31, 15, 'Marwan Al-Sahafi'),
    (31, 16, 'Salem Al-Dawsari'),
    (31, 17, 'Abdulrahman Alobud'),
    (31, 18, 'Feras Albrikan'),
    (31, 19, 'Saleh Al-Shehri'),
    (31, 20, 'Abdullah Alhamdan'),

    -- Uruguay
    (32, 2, 'Sergio Rochet'),
    (32, 3, 'Santiago Mele'),
    (32, 4, 'Ronald Araujo'),
    (32, 5, 'Jose Maria Gimenez'),
    (32, 6, 'Sebastian Caceres'),
    (32, 7, 'Mathias Olivera'),
    (32, 8, 'Guillermo Varela'),
    (32, 9, 'Nahitan Nandez'),
    (32, 10, 'Federico Valverde'),
    (32, 11, 'Giorgian De Arrascaeta'),
    (32, 12, 'Rodrigo Bentancur'),
    (32, 14, 'Manuel Ugarte'),
    (32, 15, 'Nicolas De La Cruz'),
    (32, 16, 'Maxi Araujo'),
    (32, 17, 'Darwin Nunez'),
    (32, 18, 'Federico Vinas'),
    (32, 19, 'Rodrigo Aguirre'),
    (32, 20, 'Facundo Pellistri'),

    -- France
    (33, 2, 'Mike Maignan'),
    (33, 3, 'Theo Hernandez'),
    (33, 4, 'William Saliba'),
    (33, 5, 'Jules Kounde'),
    (33, 6, 'Ibrahima Konate'),
    (33, 7, 'Dayot Upamecano'),
    (33, 8, 'Lucas Digne'),
    (33, 9, 'Aurelien Tchouameni'),
    (33, 10, 'Eduardo Camavinga'),
    (33, 11, 'Manu Kone'),
    (33, 12, 'Adrien Rabiot'),
    (33, 14, 'Michael Olise'),
    (33, 15, 'Ousmane Dembele'),
    (33, 16, 'Bradley Barcola'),
    (33, 17, 'Desire Doue'),
    (33, 18, 'Kingsley Coman'),
    (33, 19, 'Hugo Ekitike'),
    (33, 20, 'Kylian Mbappe'),

    -- Iraq
    (34, 2, 'Jalal Hassan'),
    (34, 3, 'Rebin Sulaka'),
    (34, 4, 'Hussein Ali'),
    (34, 5, 'Akam Hashem'),
    (34, 6, 'Merchas Doski'),
    (34, 7, 'Zaid Tahseen'),
    (34, 8, 'Manaf Younis'),
    (34, 9, 'Zidane Iqbal'),
    (34, 10, 'Amir Al-Ammari'),
    (34, 11, 'Ibrahim Bayesh'),
    (34, 12, 'Ali Jasim'),
    (34, 14, 'Youssef Amyn'),
    (34, 15, 'Amjad Shier'),
    (34, 16, 'Muntadher Faraj'),
    (34, 17, 'Osama Rashid'),
    (34, 18, 'Ali Al-Hamadi'),
    (34, 19, 'Aymen Hussein'),
    (34, 20, 'Mohanad Ali'),

    -- Norway
    (35, 2, 'Orjan Nyland'),
    (35, 3, 'Julian Ryerson'),
    (35, 4, 'Leo Ostigard'),
    (35, 5, 'Kristoffer Vassbakk Ajer'),
    (35, 6, 'Marcus Holmgren Pedersen'),
    (35, 7, 'David Moller Wolfe'),
    (35, 8, 'Torbjorn Heggem'),
    (35, 9, 'Morten Thorsby'),
    (35, 10, 'Martin Odegaard'),
    (35, 11, 'Sander Berge'),
    (35, 12, 'Andreas Schjelderup'),
    (35, 14, 'Patrick Berg'),
    (35, 15, 'Erling Haaland'),
    (35, 16, 'Alexander Sorloth'),
    (35, 17, 'Aron Donnum'),
    (35, 18, 'Jorgen Strand Larsen'),
    (35, 19, 'Antonio Nusa'),
    (35, 20, 'Oscar Bobb'),

    -- Senegal
    (36, 2, 'Edouard Mendy'),
    (36, 3, 'Yehvann Diouf'),
    (36, 4, 'Moussa Niakhate'),
    (36, 5, 'Abdoulaye Seck'),
    (36, 6, 'Ismail Jakobs'),
    (36, 7, 'El Hadji Malick Diouf'),
    (36, 8, 'Kalidou Koulibaly'),
    (36, 9, 'Idrissa Gana Gueye'),
    (36, 10, 'Pape Matar Sarr'),
    (36, 11, 'Pape Gueye'),
    (36, 12, 'Habib Diarra'),
    (36, 14, 'Lamine Camara'),
    (36, 15, 'Sadio Mane'),
    (36, 16, 'Ismaila Sarr'),
    (36, 17, 'Boulaye Dia'),
    (36, 18, 'Iliman Ndiaye'),
    (36, 19, 'Nicolas Jackson'),
    (36, 20, 'Krepin Diatta'),

    -- Argentina
    (37, 2, 'Emiliano Martinez'),
    (37, 3, 'Nahuel Molina'),
    (37, 4, 'Cristian Romero'),
    (37, 5, 'Nicolas Otamendi'),
    (37, 6, 'Nicolas Tagliafico'),
    (37, 7, 'Leonardo Balerdi'),
    (37, 8, 'Enzo Fernandez'),
    (37, 9, 'Alexis Mac Allister'),
    (37, 10, 'Rodrigo De Paul'),
    (37, 11, 'Exequiel Palacios'),
    (37, 12, 'Leandro Paredes'),
    (37, 14, 'Nico Paz'),
    (37, 15, 'Franco Mastantuono'),
    (37, 16, 'Nico Gonzalez'),
    (37, 17, 'Lionel Messi'),
    (37, 18, 'Lautaro Martinez'),
    (37, 19, 'Julian Alvarez'),
    (37, 20, 'Giuliano Simeone'),

    -- Austria
    (39, 2, 'Alexander Schlager'),
    (39, 3, 'Patrick Pentz'),
    (39, 4, 'David Alaba'),
    (39, 5, 'Kevin Danso'),
    (39, 6, 'Philipp Lienhart'),
    (39, 7, 'Stefan Posch'),
    (39, 8, 'Phillipp Mwene'),
    (39, 9, 'Alexander Prass'),
    (39, 10, 'Xaver Schlager'),
    (39, 11, 'Marcel Sabitzer'),
    (39, 12, 'Konrad Laimer'),
    (39, 14, 'Florian Grillitsch'),
    (39, 15, 'Nicolas Seiwald'),
    (39, 16, 'Romano Schmid'),
    (39, 17, 'Patrick Wimmer'),
    (39, 18, 'Christoph Baumgartner'),
    (39, 19, 'Michael Gregoritsch'),
    (39, 20, 'Marko Arnautovic'),

    -- Jordan
    (40, 2, 'Yazeed Abulaila'),
    (40, 3, 'Ihsan Haddad'),
    (40, 4, 'Mohammad Abu Hashish'),
    (40, 5, 'Yazan Al-Arab'),
    (40, 6, 'Abdallah Nasib'),
    (40, 7, 'Saleem Obaid'),
    (40, 8, 'Mohammad Abualnadi'),
    (40, 9, 'Ibrahim Sadeh'),
    (40, 10, 'Nizar Al-Rashdan'),
    (40, 11, 'Noor Al-Rawabdeh'),
    (40, 12, 'Mohammad Abu Taha'),
    (40, 14, 'Amer Jamous'),
    (40, 15, 'Mousa Al-Taamari'),
    (40, 16, 'Yazan Al-Naimat'),
    (40, 17, 'Mahmoud Al-Mardi'),
    (40, 18, 'Ali Olwan'),
    (40, 19, 'Mohammad Abu Zrayq'),
    (40, 20, 'Brahi Sabra'),

    -- Portugal
    (41, 2, 'Diogo Costa'),
    (41, 3, 'Jose Sa'),
    (41, 4, 'Ruben Dias'),
    (41, 5, 'Joao Cancelo'),
    (41, 6, 'Diogo Dalot'),
    (41, 7, 'Nuno Mendes'),
    (41, 8, 'Goncalo Inacio'),
    (41, 9, 'Bernardo Silva'),
    (41, 10, 'Bruno Fernandes'),
    (41, 11, 'Ruben Neves'),
    (41, 12, 'Vitinha'),
    (41, 14, 'Joao Neves'),
    (41, 15, 'Cristiano Ronaldo'),
    (41, 16, 'Francisco Trincao'),
    (41, 17, 'Joao Felix'),
    (41, 18, 'Goncalo Ramos'),
    (41, 19, 'Pedro Neto'),
    (41, 20, 'Rafael Leao'),

    -- RD do Congo
    (42, 2, 'Lionel Mpasi'),
    (42, 3, 'Aaron Wan-Bissaka'),
    (42, 4, 'Axel Tuanzebe'),
    (42, 5, 'Arthur Masuaku'),
    (42, 6, 'Chancel Mbemba'),
    (42, 7, 'Joris Kayembe'),
    (42, 8, 'Charles Pickel'),
    (42, 9, 'Ngal''ayel Mukau'),
    (42, 10, 'Edo Kayembe'),
    (42, 11, 'Samuel Moutoussamy'),
    (42, 12, 'Noah Sadiki'),
    (42, 14, 'Theo Bongonda'),
    (42, 15, 'Meschack Elia'),
    (42, 16, 'Yoane Wissa'),
    (42, 17, 'Brian Cipenga'),
    (42, 18, 'Fiston Mayele'),
    (42, 19, 'Cedric Bakambu'),
    (42, 20, 'Nathanael Mbuku'),

    -- Uzbekistan
    (43, 2, 'Utkir Yusupov'),
    (43, 3, 'Farrukh Sayfiev'),
    (43, 4, 'Sherzod Nasrullayev'),
    (43, 5, 'Umar Eshmurodov'),
    (43, 6, 'Husniddin Aliqulov'),
    (43, 7, 'Rustam Ashurmatov'),
    (43, 8, 'Khojiakbar Alijonov'),
    (43, 9, 'Abdukodir Khusanov'),
    (43, 10, 'Odiljon Hamrobekov'),
    (43, 11, 'Otabek Shukurov'),
    (43, 12, 'Jamshid Iskanderov'),
    (43, 14, 'Azizbek Turgunboev'),
    (43, 15, 'Khojimat Erkinov'),
    (43, 16, 'Eldor Shomurodov'),
    (43, 17, 'Oston Urunov'),
    (43, 18, 'Jaloliddin Masharipov'),
    (43, 19, 'Igor Sergeev'),
    (43, 20, 'Abbosbek Fayzullaev'),

    -- Colombia
    (44, 2, 'Camilo Vargas'),
    (44, 3, 'David Ospina'),
    (44, 4, 'Davinson Sanchez'),
    (44, 5, 'Yerry Mina'),
    (44, 6, 'Daniel Munoz'),
    (44, 7, 'Johan Mojica'),
    (44, 8, 'Jhon Lucumi'),
    (44, 9, 'Santiago Arias'),
    (44, 10, 'Jefferson Lerma'),
    (44, 11, 'Kevin Castano'),
    (44, 12, 'Richard Rios'),
    (44, 14, 'James Rodriguez'),
    (44, 15, 'Juan Fernando Quintero'),
    (44, 16, 'Jorge Carrascal'),
    (44, 17, 'Jhon Arias'),
    (44, 18, 'Jhon Cordoba'),
    (44, 19, 'Luis Suarez'),
    (44, 20, 'Luis Diaz'),

    -- England
    (45, 2, 'Jordan Pickford'),
    (45, 3, 'John Stones'),
    (45, 4, 'Marc Guehi'),
    (45, 5, 'Ezri Konsa'),
    (45, 6, 'Trent Alexander-Arnold'),
    (45, 7, 'Reece James'),
    (45, 8, 'Dan Burn'),
    (45, 9, 'Jordan Henderson'),
    (45, 10, 'Declan Rice'),
    (45, 11, 'Jude Bellingham'),
    (45, 12, 'Cole Palmer'),
    (45, 14, 'Morgan Rogers'),
    (45, 15, 'Anthony Gordon'),
    (45, 16, 'Phil Foden'),
    (45, 17, 'Bukayo Saka'),
    (45, 18, 'Harry Kane'),
    (45, 19, 'Marcus Rashford'),
    (45, 20, 'Ollie Watkins'),

    -- Croatia
    (46, 2, 'Dominik Livakovic'),
    (46, 3, 'Duje Caleta-Car'),
    (46, 4, 'Josko Gvardiol'),
    (46, 5, 'Josip Stanisic'),
    (46, 6, 'Luka Vuskovic'),
    (46, 7, 'Josip Sutalo'),
    (46, 8, 'Kristijan Jakic'),
    (46, 9, 'Luka Modric'),
    (46, 10, 'Mateo Kovacic'),
    (46, 11, 'Martin Baturina'),
    (46, 12, 'Lovro Majer'),
    (46, 14, 'Mario Pasalic'),
    (46, 15, 'Petar Sucic'),
    (46, 16, 'Ivan Perisic'),
    (46, 17, 'Marko Pasalic'),
    (46, 18, 'Ante Budimir'),
    (46, 19, 'Andrej Kramaric'),
    (46, 20, 'Franjo Ivanovic'),

    -- Ghana
    (47, 2, 'Lawrence Ati Zigi'),
    (47, 3, 'Tariq Lamptey'),
    (47, 4, 'Mohammed Salisu'),
    (47, 5, 'Alidu Seidu'),
    (47, 6, 'Alexander Djiku'),
    (47, 7, 'Gideon Mensah'),
    (47, 8, 'Caleb Yirenkyi'),
    (47, 9, 'Abdul Issahaku Fatawu'),
    (47, 10, 'Thomas Partey'),
    (47, 11, 'Salis Abdul Samed'),
    (47, 12, 'Kamaldeen Sulemana'),
    (47, 14, 'Mohammed Kudus'),
    (47, 15, 'Inaki Williams'),
    (47, 16, 'Jordan Ayew'),
    (47, 17, 'Andre Ayew'),
    (47, 18, 'Joseph Paintsil'),
    (47, 19, 'Osman Bukari'),
    (47, 20, 'Antoine Semenyo'),

    -- Panama
    (48, 2, 'Orlando Mosquera'),
    (48, 3, 'Luis Mejia'),
    (48, 4, 'Fidel Escobar'),
    (48, 5, 'Andres Andrade'),
    (48, 6, 'Michael Amir Murillo'),
    (48, 7, 'Eric Davis'),
    (48, 8, 'Jose Cordoba'),
    (48, 9, 'Cesar Blackman'),
    (48, 10, 'Cristian Martinez'),
    (48, 11, 'Anibal Godoy'),
    (48, 12, 'Adalberto Carrasquilla'),
    (48, 14, 'Edgar Barcenas'),
    (48, 15, 'Carlos Harvey'),
    (48, 16, 'Samir Diaz'),
    (48, 17, 'Jose Fajardo'),
    (48, 18, 'Cecilio Waterman'),
    (48, 19, 'Jose Luis Rodriguez'),
    (48, 20, 'Jose Luis Quintero')
)
UPDATE stickers
SET name = split_part(stickers.name, ' - ', 1) || ' - ' || player_names.player_name
FROM player_names
WHERE stickers.collection_id = 'b2026000-0000-4000-8000-000000000001'
  AND stickers.number = ((player_names.team_order - 1) * 20 + player_names.local_number);
