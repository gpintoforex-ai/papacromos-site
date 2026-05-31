WITH japan_images(slot_order, image_url) AS (
  VALUES
    (1, '/stickers/japao/japao-01.png'),
    (2, '/stickers/japao/japao-02.png'),
    (3, '/stickers/japao/japao-03.png'),
    (4, '/stickers/japao/japao-04.png'),
    (5, '/stickers/japao/japao-05.png'),
    (6, '/stickers/japao/japao-06.png'),
    (7, '/stickers/japao/japao-07.png'),
    (8, '/stickers/japao/japao-08.png'),
    (9, '/stickers/japao/japao-09.png'),
    (10, '/stickers/japao/japao-10.png'),
    (11, '/stickers/japao/japao-11.png'),
    (12, '/stickers/japao/japao-12.png'),
    (13, '/stickers/japao/japao-13.png'),
    (14, '/stickers/japao/japao-14.png'),
    (15, '/stickers/japao/japao-15.png'),
    (16, '/stickers/japao/japao-16.png'),
    (17, '/stickers/japao/japao-17.png'),
    (18, '/stickers/japao/japao-18.png'),
    (19, '/stickers/japao/japao-19.png'),
    (20, '/stickers/japao/japao-20.png')
)
UPDATE stickers
SET image_url = japan_images.image_url
FROM japan_images
WHERE stickers.collection_id = 'b2026000-0000-4000-8000-000000000001'
  AND stickers.number = 420 + japan_images.slot_order;
