WITH mexico_images(slot_order, image_url) AS (
  VALUES
    (1, '/stickers/mexico/mexico-01.png'),
    (2, '/stickers/mexico/mexico-02.png'),
    (3, '/stickers/mexico/mexico-03.png'),
    (4, '/stickers/mexico/mexico-04.png'),
    (5, '/stickers/mexico/mexico-06.png'),
    (6, '/stickers/mexico/mexico-07.png'),
    (7, '/stickers/mexico/mexico-08.png'),
    (8, '/stickers/mexico/mexico-09.png'),
    (9, '/stickers/mexico/mexico-10.png'),
    (10, '/stickers/mexico/mexico-11.png'),
    (11, '/stickers/mexico/mexico-12.png'),
    (12, '/stickers/mexico/mexico-13.png'),
    (13, '/stickers/mexico/mexico-05.png'),
    (14, '/stickers/mexico/mexico-14.png'),
    (15, '/stickers/mexico/mexico-15.png'),
    (16, '/stickers/mexico/mexico-16.png'),
    (17, '/stickers/mexico/mexico-17.png'),
    (18, '/stickers/mexico/mexico-18.png'),
    (19, '/stickers/mexico/mexico-19.png'),
    (20, '/stickers/mexico/mexico-20.png')
)
UPDATE stickers
SET image_url = mexico_images.image_url
FROM mexico_images
WHERE stickers.collection_id = 'b2026000-0000-4000-8000-000000000001'
  AND stickers.number = mexico_images.slot_order;
