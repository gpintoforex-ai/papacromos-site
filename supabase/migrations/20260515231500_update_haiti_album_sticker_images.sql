WITH haiti_images(slot_order, image_url) AS (
  VALUES
    (1, '/stickers/haiti/haiti-01.png'),
    (2, '/stickers/haiti/haiti-02.png'),
    (3, '/stickers/haiti/haiti-03.png'),
    (4, '/stickers/haiti/haiti-04.png'),
    (5, '/stickers/haiti/haiti-05.png'),
    (6, '/stickers/haiti/haiti-06.png'),
    (7, '/stickers/haiti/haiti-07.png'),
    (8, '/stickers/haiti/haiti-08.png'),
    (9, '/stickers/haiti/haiti-09.png'),
    (10, '/stickers/haiti/haiti-10.png'),
    (11, '/stickers/haiti/haiti-11.png'),
    (12, '/stickers/haiti/haiti-12.png'),
    (13, '/stickers/haiti/haiti-13.png'),
    (14, '/stickers/haiti/haiti-14.png'),
    (15, '/stickers/haiti/haiti-15.png'),
    (16, '/stickers/haiti/haiti-16.png'),
    (17, '/stickers/haiti/haiti-17.png'),
    (18, '/stickers/haiti/haiti-18.png'),
    (19, '/stickers/haiti/haiti-19.png'),
    (20, '/stickers/haiti/haiti-20.png')
)
UPDATE stickers
SET image_url = haiti_images.image_url
FROM haiti_images
WHERE stickers.collection_id = 'b2026000-0000-4000-8000-000000000001'
  AND stickers.number = 200 + haiti_images.slot_order;
