-- Add the CC special page to the World 2026 album.

UPDATE collections
SET total_stickers = 1014
WHERE id = 'b2026000-0000-4000-8000-000000000001';

WITH cc_specials(cc_number, sticker_name, rarity) AS (
  VALUES
    (1, 'Lamine Yamal', 'legendary'),
    (2, 'Joshua Kimmich', 'rare'),
    (3, 'Harry Kane', 'legendary'),
    (4, 'Santiago Gimenez', 'rare'),
    (5, 'Josko Gvardiol', 'rare'),
    (6, 'Federico Valverde', 'legendary'),
    (7, 'Jefferson Lerma', 'rare'),
    (8, 'Enner Valencia', 'rare'),
    (9, 'Gabriel Magalhaes', 'rare'),
    (10, 'Virgil van Dijk', 'legendary'),
    (11, 'Alphonso Davies', 'rare'),
    (12, 'Emiliano Martinez', 'legendary'),
    (13, 'Raul Jimenez', 'rare'),
    (14, 'Lautaro Martinez', 'legendary')
),
album_stickers AS (
  SELECT
    'b2026000-0000-4000-8000-000000000001'::uuid AS collection_id,
    1000 + cc_number AS number,
    'CC - ' || sticker_name AS name,
    '' AS image_url,
    rarity
  FROM cc_specials
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
