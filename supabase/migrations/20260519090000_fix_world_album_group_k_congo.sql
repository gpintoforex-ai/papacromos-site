-- Group K uses RD do Congo (COD), not Jamaica.
-- Repair databases that already ran the earlier Jamaica correction.

UPDATE stickers
SET name = replace(name, 'Jamaica - ', 'RD do Congo - ')
WHERE collection_id = 'b2026000-0000-4000-8000-000000000001'
  AND name LIKE 'Jamaica - %';
