-- Add the Extras special page to the World 2026 album.

UPDATE collections
SET total_stickers = 1000
WHERE id = 'b2026000-0000-4000-8000-000000000001';

WITH extra_specials(extra_number, sticker_name, team_code, rarity) AS (
  VALUES
    (1, 'Luis Diaz', 'COL', 'legendary'),
    (2, 'Florian Wirtz', 'GER', 'legendary'),
    (3, 'Lionel Messi', 'ARG', 'legendary'),
    (4, 'Lamine Yamal', 'ESP', 'legendary'),
    (5, 'Cristiano Ronaldo', 'POR', 'legendary'),
    (6, 'Jude Bellingham', 'ENG', 'legendary'),
    (7, 'Moises Caicedo', 'ECU', 'rare'),
    (8, 'Achraf Hakimi', 'MAR', 'rare'),
    (9, 'Vinicius Junior', 'BRA', 'legendary'),
    (10, 'Jeremy Doku', 'BEL', 'rare'),
    (11, 'Erling Haaland', 'NOR', 'legendary'),
    (12, 'Cody Gakpo', 'NED', 'rare'),
    (13, 'Heung-min Son', 'KOR', 'legendary'),
    (14, 'Alphonso Davies', 'CAN', 'rare'),
    (15, 'Federico Valverde', 'URU', 'legendary'),
    (16, 'Kylian Mbappe', 'FRA', 'legendary'),
    (17, 'Mohamed Salah', 'EGY', 'legendary'),
    (18, 'Raul Jimenez', 'MEX', 'rare'),
    (19, 'Luka Modric', 'CRO', 'legendary'),
    (20, 'Christian Pulisic', 'USA', 'rare')
),
album_stickers AS (
  SELECT
    'b2026000-0000-4000-8000-000000000001'::uuid AS collection_id,
    980 + extra_number AS number,
    'Extras - ' || sticker_name || ' (' || team_code || ')' AS name,
    '' AS image_url,
    rarity
  FROM extra_specials
),
updated_stickers AS (
  UPDATE stickers
  SET
    name = album_stickers.name,
    image_url = album_stickers.image_url,
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
