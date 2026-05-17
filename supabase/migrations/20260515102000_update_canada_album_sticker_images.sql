WITH canada_images(slot_order, image_url) AS (
  VALUES
    (1, '/stickers/canada/canada-01.png'),
    (2, '/stickers/canada/canada-02.png'),
    (3, '/stickers/canada/canada-03.png'),
    (4, '/stickers/canada/canada-04.png'),
    (5, '/stickers/canada/canada-05.png'),
    (6, '/stickers/canada/canada-06.png'),
    (7, '/stickers/canada/canada-07.png'),
    (8, '/stickers/canada/canada-08.png'),
    (9, '/stickers/canada/canada-09.png'),
    (10, '/stickers/canada/canada-10.png'),
    (11, '/stickers/canada/canada-11.png'),
    (12, '/stickers/canada/canada-12.png'),
    (13, '/stickers/canada/canada-13.png'),
    (14, '/stickers/canada/canada-14.png'),
    (15, '/stickers/canada/canada-15.png'),
    (16, '/stickers/canada/canada-16.png'),
    (17, '/stickers/canada/canada-17.png'),
    (18, '/stickers/canada/canada-18.png'),
    (19, '/stickers/canada/canada-19.png'),
    (20, '/stickers/canada/canada-20.png')
)
UPDATE stickers
SET image_url = canada_images.image_url
FROM canada_images
WHERE stickers.collection_id = 'b2026000-0000-4000-8000-000000000001'
  AND stickers.number = 80 + canada_images.slot_order;
