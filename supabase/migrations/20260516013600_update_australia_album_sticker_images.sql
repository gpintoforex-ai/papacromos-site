WITH australia_images(slot_order, image_url) AS (
  VALUES
    (1, '/stickers/australia/australia-01.png'),
    (2, '/stickers/australia/australia-02.png'),
    (3, '/stickers/australia/australia-03.png'),
    (4, '/stickers/australia/australia-04.png'),
    (5, '/stickers/australia/australia-05.png'),
    (6, '/stickers/australia/australia-06.png'),
    (7, '/stickers/australia/australia-07.png'),
    (8, '/stickers/australia/australia-08.png'),
    (9, '/stickers/australia/australia-09.png'),
    (10, '/stickers/australia/australia-10.png'),
    (11, '/stickers/australia/australia-11.png'),
    (12, '/stickers/australia/australia-12.png'),
    (13, '/stickers/australia/australia-13.png'),
    (14, '/stickers/australia/australia-14.png'),
    (15, '/stickers/australia/australia-15.png'),
    (16, '/stickers/australia/australia-16.png'),
    (17, '/stickers/australia/australia-17.png'),
    (18, '/stickers/australia/australia-18.png'),
    (19, '/stickers/australia/australia-19.png'),
    (20, '/stickers/australia/australia-20.png')
)
UPDATE stickers
SET image_url = australia_images.image_url
FROM australia_images
WHERE stickers.collection_id = 'b2026000-0000-4000-8000-000000000001'
  AND stickers.number = 260 + australia_images.slot_order;

WITH australia_images(slot_order, image_url) AS (
  VALUES
    (1, '/stickers/australia/australia-01.png'),
    (2, '/stickers/australia/australia-02.png'),
    (3, '/stickers/australia/australia-03.png'),
    (4, '/stickers/australia/australia-04.png'),
    (5, '/stickers/australia/australia-05.png'),
    (6, '/stickers/australia/australia-06.png'),
    (7, '/stickers/australia/australia-07.png'),
    (8, '/stickers/australia/australia-08.png'),
    (9, '/stickers/australia/australia-09.png'),
    (10, '/stickers/australia/australia-10.png'),
    (11, '/stickers/australia/australia-11.png'),
    (12, '/stickers/australia/australia-12.png'),
    (13, '/stickers/australia/australia-13.png'),
    (14, '/stickers/australia/australia-14.png'),
    (15, '/stickers/australia/australia-15.png'),
    (16, '/stickers/australia/australia-16.png'),
    (17, '/stickers/australia/australia-17.png'),
    (18, '/stickers/australia/australia-18.png'),
    (19, '/stickers/australia/australia-19.png'),
    (20, '/stickers/australia/australia-20.png')
),
australia_stickers AS (
  SELECT
    id,
    row_number() OVER (ORDER BY number) AS slot_order
  FROM stickers
  WHERE collection_id = 'b2026000-0000-4000-8000-000000000001'
    AND name ILIKE 'Austr%lia - %'
)
UPDATE stickers
SET image_url = australia_images.image_url
FROM australia_stickers
JOIN australia_images ON australia_images.slot_order = australia_stickers.slot_order
WHERE stickers.id = australia_stickers.id;
