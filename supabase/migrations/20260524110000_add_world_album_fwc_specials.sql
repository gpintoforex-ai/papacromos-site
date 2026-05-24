-- Add the FWC special page to the World 2026 album.

UPDATE collections
SET total_stickers = 980
WHERE id = 'b2026000-0000-4000-8000-000000000001';

WITH fwc_specials(fwc_number, sticker_name, rarity) AS (
  VALUES
    (0, 'WE ARE PANINI', 'legendary'),
    (1, 'Emblema Oficial', 'rare'),
    (2, 'Emblema Oficial', 'rare'),
    (3, 'Mascotes Oficiais', 'rare'),
    (4, 'Slogan Oficial', 'uncommon'),
    (5, 'Bola Oficial', 'uncommon'),
    (6, 'Emblema do pais-sede (Canada)', 'rare'),
    (7, 'Emblema do pais-sede (Mexico)', 'rare'),
    (8, 'Emblema do pais-sede (Estados Unidos)', 'rare'),
    (9, 'FWC ITALIA 1934', 'uncommon'),
    (10, 'FWC URUGUAY 1950', 'uncommon'),
    (11, 'FWC GERMANY FR 1954', 'uncommon'),
    (12, 'FWC BRASIL 1962', 'uncommon'),
    (13, 'FWC GERMANY FR 1974', 'uncommon'),
    (14, 'FWC ARGENTINA 1986', 'uncommon'),
    (15, 'FWC BRASIL 1994', 'uncommon'),
    (16, 'FWC BRASIL 2002', 'uncommon'),
    (17, 'FWC ITALIA 2006', 'uncommon'),
    (18, 'FWC GERMANY 2014', 'uncommon'),
    (19, 'FWC ARGENTINA 2022', 'uncommon')
),
album_stickers AS (
  SELECT
    'b2026000-0000-4000-8000-000000000001'::uuid AS collection_id,
    961 + fwc_number AS number,
    'FWC - ' || sticker_name AS name,
    '' AS image_url,
    rarity
  FROM fwc_specials
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
