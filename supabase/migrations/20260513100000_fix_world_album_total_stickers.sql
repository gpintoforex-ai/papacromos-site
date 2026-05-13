-- Fix world album total after changing each selection page to 20 stickers.

UPDATE collections
SET total_stickers = 960
WHERE id = 'b2026000-0000-4000-8000-000000000001';
