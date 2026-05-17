WITH austria_images(slot_order, image_url) AS (
  VALUES
    (1, '/stickers/austria/austria-01.png'),
    (2, '/stickers/austria/austria-02.png'),
    (3, '/stickers/austria/austria-03.png'),
    (4, '/stickers/austria/austria-04.png'),
    (5, '/stickers/austria/austria-05.png'),
    (6, '/stickers/austria/austria-06.png'),
    (7, '/stickers/austria/austria-07.png'),
    (8, '/stickers/austria/austria-08.png'),
    (9, '/stickers/austria/austria-09.png'),
    (10, '/stickers/austria/austria-10.png'),
    (11, '/stickers/austria/austria-11.png'),
    (12, '/stickers/austria/austria-12.png'),
    (13, '/stickers/austria/austria-13.png'),
    (14, '/stickers/austria/austria-14.png'),
    (15, '/stickers/austria/austria-15.png'),
    (16, '/stickers/austria/austria-16.png'),
    (17, '/stickers/austria/austria-17.png'),
    (18, '/stickers/austria/austria-18.png'),
    (19, '/stickers/austria/austria-19.png'),
    (20, '/stickers/austria/austria-20.png')
)
UPDATE stickers
SET image_url = austria_images.image_url
FROM austria_images
WHERE stickers.collection_id = 'b2026000-0000-4000-8000-000000000001'
  AND stickers.number = 760 + austria_images.slot_order;

WITH austria_images(slot_order, image_url) AS (
  VALUES
    (1, '/stickers/austria/austria-01.png'),
    (2, '/stickers/austria/austria-02.png'),
    (3, '/stickers/austria/austria-03.png'),
    (4, '/stickers/austria/austria-04.png'),
    (5, '/stickers/austria/austria-05.png'),
    (6, '/stickers/austria/austria-06.png'),
    (7, '/stickers/austria/austria-07.png'),
    (8, '/stickers/austria/austria-08.png'),
    (9, '/stickers/austria/austria-09.png'),
    (10, '/stickers/austria/austria-10.png'),
    (11, '/stickers/austria/austria-11.png'),
    (12, '/stickers/austria/austria-12.png'),
    (13, '/stickers/austria/austria-13.png'),
    (14, '/stickers/austria/austria-14.png'),
    (15, '/stickers/austria/austria-15.png'),
    (16, '/stickers/austria/austria-16.png'),
    (17, '/stickers/austria/austria-17.png'),
    (18, '/stickers/austria/austria-18.png'),
    (19, '/stickers/austria/austria-19.png'),
    (20, '/stickers/austria/austria-20.png')
),
austria_stickers AS (
  SELECT
    id,
    row_number() OVER (ORDER BY number) AS slot_order
  FROM stickers
  WHERE collection_id = 'b2026000-0000-4000-8000-000000000001'
    AND name ILIKE '%ustria - %'
)
UPDATE stickers
SET image_url = austria_images.image_url
FROM austria_stickers
JOIN austria_images ON austria_images.slot_order = austria_stickers.slot_order
WHERE stickers.id = austria_stickers.id;
