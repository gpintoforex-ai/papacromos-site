WITH qatar_images(slot_order, image_url) AS (
  VALUES
    (1, '/stickers/qatar/qatar-01.png'),
    (2, '/stickers/qatar/qatar-02.png'),
    (3, '/stickers/qatar/qatar-03.png'),
    (4, '/stickers/qatar/qatar-04.png'),
    (5, '/stickers/qatar/qatar-05.png'),
    (6, '/stickers/qatar/qatar-06.png'),
    (7, '/stickers/qatar/qatar-07.png'),
    (8, '/stickers/qatar/qatar-08.png'),
    (9, '/stickers/qatar/qatar-09.png'),
    (10, '/stickers/qatar/qatar-10.png'),
    (11, '/stickers/qatar/qatar-11.png'),
    (12, '/stickers/qatar/qatar-12.png'),
    (13, '/stickers/qatar/qatar-13.png'),
    (14, '/stickers/qatar/qatar-14.png'),
    (15, '/stickers/qatar/qatar-15.png'),
    (16, '/stickers/qatar/qatar-16.png'),
    (17, '/stickers/qatar/qatar-17.png'),
    (18, '/stickers/qatar/qatar-18.png'),
    (19, '/stickers/qatar/qatar-19.png'),
    (20, '/stickers/qatar/qatar-20.png')
)
UPDATE stickers
SET image_url = qatar_images.image_url
FROM qatar_images
WHERE stickers.collection_id = 'b2026000-0000-4000-8000-000000000001'
  AND stickers.number = 120 + qatar_images.slot_order;
