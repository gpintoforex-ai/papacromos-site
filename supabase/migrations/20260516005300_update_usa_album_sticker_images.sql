WITH usa_images(slot_order, image_url) AS (
  VALUES
    (1, '/stickers/estados-unidos/estados-unidos-01.png'),
    (2, '/stickers/estados-unidos/estados-unidos-02.png'),
    (3, '/stickers/estados-unidos/estados-unidos-03.png'),
    (4, '/stickers/estados-unidos/estados-unidos-04.png'),
    (5, '/stickers/estados-unidos/estados-unidos-05.png'),
    (6, '/stickers/estados-unidos/estados-unidos-06.png'),
    (7, '/stickers/estados-unidos/estados-unidos-07.png'),
    (8, '/stickers/estados-unidos/estados-unidos-08.png'),
    (9, '/stickers/estados-unidos/estados-unidos-09.png'),
    (10, '/stickers/estados-unidos/estados-unidos-10.png'),
    (11, '/stickers/estados-unidos/estados-unidos-11.png'),
    (12, '/stickers/estados-unidos/estados-unidos-12.png'),
    (13, '/stickers/estados-unidos/estados-unidos-13.png'),
    (14, '/stickers/estados-unidos/estados-unidos-14.png'),
    (15, '/stickers/estados-unidos/estados-unidos-15.png'),
    (16, '/stickers/estados-unidos/estados-unidos-16.png'),
    (17, '/stickers/estados-unidos/estados-unidos-17.png'),
    (18, '/stickers/estados-unidos/estados-unidos-18.png'),
    (19, '/stickers/estados-unidos/estados-unidos-19.png'),
    (20, '/stickers/estados-unidos/estados-unidos-20.png')
)
UPDATE stickers
SET image_url = usa_images.image_url
FROM usa_images
WHERE stickers.collection_id = 'b2026000-0000-4000-8000-000000000001'
  AND stickers.number = 240 + usa_images.slot_order;
