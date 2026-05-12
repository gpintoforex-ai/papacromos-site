-- Rebuild the independent world album as 48 pages with 1 team photo and 18 players each.
-- This replaces the previous 6-sticker-per-team seed for this collection.

DELETE FROM stickers
WHERE collection_id = 'b2026000-0000-4000-8000-000000000001';

INSERT INTO collections (id, name, description, image_url, total_stickers)
VALUES (
  'b2026000-0000-4000-8000-000000000001',
  'Caderneta Mundial 2026',
  'Uma caderneta comunitaria independente inspirada no grande torneio mundial de futebol. Cada selecao tem foto de equipa e 18 jogadores.',
  'https://images.pexels.com/photos/46798/the-ball-stadion-football-the-pitch.jpg?auto=compress&cs=tinysrgb&w=800',
  912
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  image_url = EXCLUDED.image_url,
  total_stickers = EXCLUDED.total_stickers;

WITH teams(team_order, team_name) AS (
  VALUES
    (1, 'Portugal'),
    (2, 'Brasil'),
    (3, 'Argentina'),
    (4, 'Franca'),
    (5, 'Espanha'),
    (6, 'Alemanha'),
    (7, 'Inglaterra'),
    (8, 'Italia'),
    (9, 'Paises Baixos'),
    (10, 'Belgica'),
    (11, 'Croacia'),
    (12, 'Uruguai'),
    (13, 'Mexico'),
    (14, 'Estados Unidos'),
    (15, 'Japao'),
    (16, 'Marrocos'),
    (17, 'Canada'),
    (18, 'Suica'),
    (19, 'Turquia'),
    (20, 'Senegal'),
    (21, 'Argelia'),
    (22, 'Congo DR'),
    (23, 'Coreia do Sul'),
    (24, 'Australia'),
    (25, 'Dinamarca'),
    (26, 'Suecia'),
    (27, 'Noruega'),
    (28, 'Colombia'),
    (29, 'Chile'),
    (30, 'Equador'),
    (31, 'Paraguai'),
    (32, 'Peru'),
    (33, 'Costa Rica'),
    (34, 'Jamaica'),
    (35, 'Panama'),
    (36, 'Egito'),
    (37, 'Nigeria'),
    (38, 'Gana'),
    (39, 'Tunisia'),
    (40, 'Camaroes'),
    (41, 'Africa do Sul'),
    (42, 'Arabia Saudita'),
    (43, 'Iraque'),
    (44, 'Qatar'),
    (45, 'Nova Zelandia'),
    (46, 'Polonia'),
    (47, 'Ucrania'),
    (48, 'Servia')
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
FROM album_stickers;
