WITH curacao_images(slot_order, image_url) AS (
  VALUES
    (1, '/stickers/curacao/curacao-01.png'),
    (2, '/stickers/curacao/curacao-02.png'),
    (3, '/stickers/curacao/curacao-03.png'),
    (4, '/stickers/curacao/curacao-04.png'),
    (5, '/stickers/curacao/curacao-05.png'),
    (6, '/stickers/curacao/curacao-06.png'),
    (7, '/stickers/curacao/curacao-07.png'),
    (8, '/stickers/curacao/curacao-08.png'),
    (9, '/stickers/curacao/curacao-09.png'),
    (10, '/stickers/curacao/curacao-10.png'),
    (11, '/stickers/curacao/curacao-11.png'),
    (12, '/stickers/curacao/curacao-12.png'),
    (13, '/stickers/curacao/curacao-13.png'),
    (14, '/stickers/curacao/curacao-14.png'),
    (15, '/stickers/curacao/curacao-15.png'),
    (16, '/stickers/curacao/curacao-16.png'),
    (17, '/stickers/curacao/curacao-17.png'),
    (18, '/stickers/curacao/curacao-18.png'),
    (19, '/stickers/curacao/curacao-19.png'),
    (20, '/stickers/curacao/curacao-20.png')
)
UPDATE stickers
SET image_url = curacao_images.image_url
FROM curacao_images
WHERE stickers.collection_id = 'b2026000-0000-4000-8000-000000000001'
  AND stickers.number = 340 + curacao_images.slot_order;
