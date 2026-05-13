
UPDATE collections
SET total_stickers = 288
WHERE id = 'b2026000-0000-4000-8000-000000000001';

WITH teams(team_order, team_name) AS (
  VALUES
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
  VALUES
    (1, 'Emblema', 'rare'),
    (2, 'Guarda-redes', 'common'),
    (3, 'Defesa', 'common'),-- Expand the independent world album to 48 selection pages.

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
