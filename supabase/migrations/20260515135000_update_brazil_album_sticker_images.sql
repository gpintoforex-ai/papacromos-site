WITH brazil_images(slot_order, image_url) AS (
  VALUES
    (1, '/stickers/brasil/brasil-01.png'),
    (2, '/stickers/brasil/brasil-02.png'),
    (3, '/stickers/brasil/brasil-03.png'),
    (4, '/stickers/brasil/brasil-04.png'),
    (5, '/stickers/brasil/brasil-05.png'),
    (6, '/stickers/brasil/brasil-06.png'),
    (7, '/stickers/brasil/brasil-07.png'),
    (8, '/stickers/brasil/brasil-08.png'),
    (9, '/stickers/brasil/brasil-09.png'),
    (10, '/stickers/brasil/brasil-10.png'),
    (11, '/stickers/brasil/brasil-11.png'),
    (12, '/stickers/brasil/brasil-12.png'),
    (13, '/stickers/brasil/brasil-13.png'),
    (14, '/stickers/brasil/brasil-14.png'),
    (15, '/stickers/brasil/brasil-15.png'),
    (16, '/stickers/brasil/brasil-16.png'),
    (17, '/stickers/brasil/brasil-17.png'),
    (18, '/stickers/brasil/brasil-18.png'),
    (19, '/stickers/brasil/brasil-19.png'),
    (20, '/stickers/brasil/brasil-20.png')
)
UPDATE stickers
SET image_url = brazil_images.image_url
FROM brazil_images
WHERE stickers.collection_id = 'b2026000-0000-4000-8000-000000000001'
  AND stickers.number = 160 + brazil_images.slot_order;
