WITH turquia_images(slot_order, image_url) AS (
  VALUES
    (1, '/stickers/turquia/turquia-01.png'),
    (2, '/stickers/turquia/turquia-02.png'),
    (3, '/stickers/turquia/turquia-03.png'),
    (4, '/stickers/turquia/turquia-04.png'),
    (5, '/stickers/turquia/turquia-05.png'),
    (6, '/stickers/turquia/turquia-06.png'),
    (7, '/stickers/turquia/turquia-07.png'),
    (8, '/stickers/turquia/turquia-08.png'),
    (9, '/stickers/turquia/turquia-09.png'),
    (10, '/stickers/turquia/turquia-10.png'),
    (11, '/stickers/turquia/turquia-11.png'),
    (12, '/stickers/turquia/turquia-12.png'),
    (13, '/stickers/turquia/turquia-13.png'),
    (14, '/stickers/turquia/turquia-14.png'),
    (15, '/stickers/turquia/turquia-15.png'),
    (16, '/stickers/turquia/turquia-16.png'),
    (17, '/stickers/turquia/turquia-17.png'),
    (18, '/stickers/turquia/turquia-18.png'),
    (19, '/stickers/turquia/turquia-19.png'),
    (20, '/stickers/turquia/turquia-20.png')
)
UPDATE stickers
SET image_url = turquia_images.image_url
FROM turquia_images
WHERE stickers.collection_id = 'b2026000-0000-4000-8000-000000000001'
  AND stickers.number = 300 + turquia_images.slot_order;
