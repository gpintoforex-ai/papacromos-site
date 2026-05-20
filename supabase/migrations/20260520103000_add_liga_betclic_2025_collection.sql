-- Add the Futebol 2025-26 Liga Betclic collection with numbered stickers.

INSERT INTO collections (id, name, description, image_url, total_stickers)
VALUES (
  'f2025260-0000-4000-8000-000000000001',
  'Futebol 2025-26 - Liga Betclic',
  'Colecao de cromos da Liga Betclic 2025-26 para registo de faltas e repetidos.',
  '/logo.png',
  464
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  image_url = EXCLUDED.image_url,
  total_stickers = EXCLUDED.total_stickers;

WITH liga_stickers AS (
  SELECT
    'f2025260-0000-4000-8000-000000000001'::uuid AS collection_id,
    sticker_number AS number,
    'Liga Betclic 2025-26 - Cromo ' || lpad(sticker_number::text, 3, '0') AS name,
    '/logo.png' AS image_url,
    'common' AS rarity
  FROM generate_series(1, 464) AS sticker_number
),
updated_stickers AS (
  UPDATE stickers
  SET
    name = liga_stickers.name,
    image_url = liga_stickers.image_url,
    rarity = liga_stickers.rarity
  FROM liga_stickers
  WHERE stickers.collection_id = liga_stickers.collection_id
    AND stickers.number = liga_stickers.number
  RETURNING stickers.number
)
INSERT INTO stickers (collection_id, number, name, image_url, rarity)
SELECT collection_id, number, name, image_url, rarity
FROM liga_stickers
WHERE NOT EXISTS (
  SELECT 1
  FROM stickers
  WHERE stickers.collection_id = liga_stickers.collection_id
    AND stickers.number = liga_stickers.number
);
