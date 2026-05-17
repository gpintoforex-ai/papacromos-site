WITH scotland_images(slot_order, image_url) AS (
  VALUES
    (1, '/stickers/escocia/escocia-01.png'),
    (2, '/stickers/escocia/escocia-02.png'),
    (3, '/stickers/escocia/escocia-03.png'),
    (4, '/stickers/escocia/escocia-04.png'),
    (5, '/stickers/escocia/escocia-05.png'),
    (6, '/stickers/escocia/escocia-06.png'),
    (7, '/stickers/escocia/escocia-07.png'),
    (8, '/stickers/escocia/escocia-08.png'),
    (9, '/stickers/escocia/escocia-09.png'),
    (10, '/stickers/escocia/escocia-10.png'),
    (11, '/stickers/escocia/escocia-11.png'),
    (12, '/stickers/escocia/escocia-12.png'),
    (13, '/stickers/escocia/escocia-13.png'),
    (14, '/stickers/escocia/escocia-14.png'),
    (15, '/stickers/escocia/escocia-15.png'),
    (16, '/stickers/escocia/escocia-16.png'),
    (17, '/stickers/escocia/escocia-17.png'),
    (18, '/stickers/escocia/escocia-18.png'),
    (19, '/stickers/escocia/escocia-19.png'),
    (20, '/stickers/escocia/escocia-20.png')
)
UPDATE stickers
SET image_url = scotland_images.image_url
FROM scotland_images
WHERE stickers.collection_id = 'b2026000-0000-4000-8000-000000000001'
  AND stickers.number = 220 + scotland_images.slot_order;
