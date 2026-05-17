WITH switzerland_images(slot_order, image_url) AS (
  VALUES
    (1, '/stickers/suica/suica-01.png'),
    (2, '/stickers/suica/suica-02.png'),
    (3, '/stickers/suica/suica-03.png'),
    (4, '/stickers/suica/suica-04.png'),
    (5, '/stickers/suica/suica-05.png'),
    (6, '/stickers/suica/suica-06.png'),
    (7, '/stickers/suica/suica-07.png'),
    (8, '/stickers/suica/suica-08.png'),
    (9, '/stickers/suica/suica-09.png'),
    (10, '/stickers/suica/suica-10.png'),
    (11, '/stickers/suica/suica-11.png'),
    (12, '/stickers/suica/suica-12.png'),
    (13, '/stickers/suica/suica-13.png'),
    (14, '/stickers/suica/suica-14.png'),
    (15, '/stickers/suica/suica-15.png'),
    (16, '/stickers/suica/suica-16.png'),
    (17, '/stickers/suica/suica-17.png'),
    (18, '/stickers/suica/suica-18.png'),
    (19, '/stickers/suica/suica-19.png'),
    (20, '/stickers/suica/suica-20.png')
)
UPDATE stickers
SET image_url = switzerland_images.image_url
FROM switzerland_images
WHERE stickers.collection_id = 'b2026000-0000-4000-8000-000000000001'
  AND stickers.number = 140 + switzerland_images.slot_order;
