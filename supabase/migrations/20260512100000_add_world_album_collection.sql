-- Add independent world football album.
-- Creates an original "Caderneta Mundial 2026" collection inspired by
-- the classic football album format, without copying official/Panini content.

INSERT INTO collections (id, name, description, image_url, total_stickers)
VALUES (
  'b2026000-0000-4000-8000-000000000001',
  'Caderneta Mundial 2026',
  'Uma caderneta comunitaria independente inspirada no grande torneio mundial de futebol. Cada selecao tem foto de equipa e 18 jogadores.',
  '/logo.png',
  912
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
      WHEN slot_order = 1 THEN 'Foto de equipa'
      ELSE 'Jogador ' || lpad((slot_order - 1)::text, 2, '0')
    END AS slot_name,
    CASE
      WHEN slot_order = 1 THEN 'rare'
      WHEN slot_order IN (7, 13, 19) THEN 'uncommon'
      WHEN slot_order = 18 THEN 'legendary'
      ELSE 'common'
    END AS rarity
  FROM generate_series(1, 19) AS slot_order
),
album_stickers AS (
  SELECT
    'b2026000-0000-4000-8000-000000000001'::uuid AS collection_id,
    ((teams.team_order - 1) * 19 + slots.slot_order) AS number,
    teams.team_name || ' - ' || slots.slot_name AS name,
    CASE
      WHEN slots.slot_order = 1 THEN 'https://images.pexels.com/photos/399187/pexels-photo-399187.jpeg?auto=compress&cs=tinysrgb&w=600'
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
