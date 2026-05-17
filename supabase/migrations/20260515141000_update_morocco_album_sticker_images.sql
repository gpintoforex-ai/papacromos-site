WITH morocco_images(slot_order, image_url) AS (
  VALUES
    (1, '/stickers/marrocos/marrocos-01.png'),
    (2, '/stickers/marrocos/marrocos-02.png'),
    (3, '/stickers/marrocos/marrocos-03.png'),
    (4, '/stickers/marrocos/marrocos-04.png'),
    (5, '/stickers/marrocos/marrocos-05.png'),
    (6, '/stickers/marrocos/marrocos-06.png'),
    (7, '/stickers/marrocos/marrocos-07.png'),
    (8, '/stickers/marrocos/marrocos-08.png'),
    (9, '/stickers/marrocos/marrocos-09.png'),
    (10, '/stickers/marrocos/marrocos-10.png'),
    (11, '/stickers/marrocos/marrocos-11.png'),
    (12, '/stickers/marrocos/marrocos-12.png'),
    (13, '/stickers/marrocos/marrocos-13.png'),
    (14, '/stickers/marrocos/marrocos-14.png'),
    (15, '/stickers/marrocos/marrocos-15.png'),
    (16, '/stickers/marrocos/marrocos-16.png'),
    (17, '/stickers/marrocos/marrocos-17.png'),
    (18, '/stickers/marrocos/marrocos-18.png'),
    (19, '/stickers/marrocos/marrocos-19.png'),
    (20, '/stickers/marrocos/marrocos-20.png')
)
UPDATE stickers
SET image_url = morocco_images.image_url
FROM morocco_images
WHERE stickers.collection_id = 'b2026000-0000-4000-8000-000000000001'
  AND stickers.number = 180 + morocco_images.slot_order;
