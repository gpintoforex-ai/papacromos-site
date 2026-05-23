-- Clear Australia sticker images in the World 2026 album.

UPDATE stickers
SET image_url = ''
WHERE collection_id = 'b2026000-0000-4000-8000-000000000001'
  AND name ILIKE 'Austr%lia - %';
