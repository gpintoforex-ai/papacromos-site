WITH alemanha_images(slot_order, image_url) AS (
  VALUES
    (1, '/stickers/alemanha/alemanha-01.png'),
    (2, '/stickers/alemanha/alemanha-02.png'),
    (3, '/stickers/alemanha/alemanha-03.png'),
    (4, '/stickers/alemanha/alemanha-04.png'),
    (5, '/stickers/alemanha/alemanha-05.png'),
    (6, '/stickers/alemanha/alemanha-06.png'),
    (7, '/stickers/alemanha/alemanha-07.png'),
    (8, '/stickers/alemanha/alemanha-08.png'),
    (9, '/stickers/alemanha/alemanha-09.png'),
    (10, '/stickers/alemanha/alemanha-10.png'),
    (11, '/stickers/alemanha/alemanha-11.png'),
    (12, '/stickers/alemanha/alemanha-12.png'),
    (13, '/stickers/alemanha/alemanha-13.png'),
    (14, '/stickers/alemanha/alemanha-14.png'),
    (15, '/stickers/alemanha/alemanha-15.png'),
    (16, '/stickers/alemanha/alemanha-16.png'),
    (17, '/stickers/alemanha/alemanha-17.png'),
    (18, '/stickers/alemanha/alemanha-18.png'),
    (19, '/stickers/alemanha/alemanha-19.png'),
    (20, '/stickers/alemanha/alemanha-20.png')
)
UPDATE stickers
SET image_url = alemanha_images.image_url
FROM alemanha_images
WHERE stickers.collection_id = 'b2026000-0000-4000-8000-000000000001'
  AND stickers.number = 320 + alemanha_images.slot_order;
