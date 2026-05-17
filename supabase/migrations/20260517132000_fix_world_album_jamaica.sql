-- Correct the World 2026 album Group K selection.
-- Existing databases that already ran the album seed need an update in place.

UPDATE stickers
SET name = replace(name, 'RD do Congo - ', 'Jamaica - ')
WHERE collection_id = 'b2026000-0000-4000-8000-000000000001'
  AND name LIKE 'RD do Congo - %';
