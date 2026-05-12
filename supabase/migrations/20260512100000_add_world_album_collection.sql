-- Add independent world football album.
-- Creates an original "Caderneta Mundial 2026" collection inspired by
-- the classic football album format, without copying official/Panini content.

INSERT INTO collections (id, name, description, image_url, total_stickers)
VALUES (
  'b2026000-0000-4000-8000-000000000001',
  'Caderneta Mundial 2026',
  'Uma caderneta comunitaria independente inspirada no grande torneio mundial de futebol. Coleciona emblemas, equipas e craques de cada selecao.',
  'https://images.pexels.com/photos/46798/the-ball-stadion-football-the-pitch.jpg?auto=compress&cs=tinysrgb&w=800',
  96
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
    (16, 'Marrocos')
),
slots(slot_order, slot_name, rarity) AS (
  VALUES
    (1, 'Emblema', 'rare'),
    (2, 'Guarda-redes', 'common'),
    (3, 'Defesa', 'common'),
    (4, 'Medio', 'common'),
    (5, 'Avancado', 'uncommon'),
    (6, 'Craque da equipa', 'legendary')
),
album_stickers AS (
  SELECT
    'b2026000-0000-4000-8000-000000000001'::uuid AS collection_id,
    ((teams.team_order - 1) * 6 + slots.slot_order) AS number,
    teams.team_name || ' - ' || slots.slot_name AS name,
    CASE
      WHEN slots.slot_order = 1 THEN 'https://images.pexels.com/photos/399187/pexels-photo-399187.jpeg?auto=compress&cs=tinysrgb&w=400'
      WHEN slots.slot_order = 6 THEN 'https://images.pexels.com/photos/114296/pexels-photo-114296.jpeg?auto=compress&cs=tinysrgb&w=400'
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
