WITH equador_images(slot_order, image_url) AS (
  VALUES
    (1, '/stickers/equador/equador-01.png'),
    (2, '/stickers/equador/equador-02.png'),
    (3, '/stickers/equador/equador-03.png'),
    (4, '/stickers/equador/equador-04.png'),
    (5, '/stickers/equador/equador-05.png'),
    (6, '/stickers/equador/equador-06.png'),
    (7, '/stickers/equador/equador-07.png'),
    (8, '/stickers/equador/equador-08.png'),
    (9, '/stickers/equador/equador-09.png'),
    (10, '/stickers/equador/equador-10.png'),
    (11, '/stickers/equador/equador-11.png'),
    (12, '/stickers/equador/equador-12.png'),
    (13, '/stickers/equador/equador-13.png'),
    (14, '/stickers/equador/equador-14.png'),
    (15, '/stickers/equador/equador-15.png'),
    (16, '/stickers/equador/equador-16.png'),
    (17, '/stickers/equador/equador-17.png'),
    (18, '/stickers/equador/equador-18.png'),
    (19, '/stickers/equador/equador-19.png'),
    (20, '/stickers/equador/equador-20.png')
)
UPDATE stickers
SET image_url = equador_images.image_url
FROM equador_images
WHERE stickers.collection_id = 'b2026000-0000-4000-8000-000000000001'
  AND stickers.number = 380 + equador_images.slot_order;
