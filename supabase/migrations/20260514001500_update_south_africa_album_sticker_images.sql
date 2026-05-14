WITH south_africa_images(slot_order, image_url) AS (
  VALUES
    (1, '/stickers/africa-do-sul/africa-do-sul-01.png'),
    (2, '/stickers/africa-do-sul/africa-do-sul-02.png'),
    (3, '/stickers/africa-do-sul/africa-do-sul-03.png'),
    (4, '/stickers/africa-do-sul/africa-do-sul-04.png'),
    (5, '/stickers/africa-do-sul/africa-do-sul-06.png'),
    (6, '/stickers/africa-do-sul/africa-do-sul-07.png'),
    (7, '/stickers/africa-do-sul/africa-do-sul-08.png'),
    (8, '/stickers/africa-do-sul/africa-do-sul-09.png'),
    (9, '/stickers/africa-do-sul/africa-do-sul-10.png'),
    (10, '/stickers/africa-do-sul/africa-do-sul-11.png'),
    (11, '/stickers/africa-do-sul/africa-do-sul-12.png'),
    (12, '/stickers/africa-do-sul/africa-do-sul-13.png'),
    (13, '/stickers/africa-do-sul/africa-do-sul-05.png'),
    (14, '/stickers/africa-do-sul/africa-do-sul-14.png'),
    (15, '/stickers/africa-do-sul/africa-do-sul-15.png'),
    (16, '/stickers/africa-do-sul/africa-do-sul-16.png'),
    (17, '/stickers/africa-do-sul/africa-do-sul-17.png'),
    (18, '/stickers/africa-do-sul/africa-do-sul-18.png'),
    (19, '/stickers/africa-do-sul/africa-do-sul-19.png'),
    (20, '/stickers/africa-do-sul/africa-do-sul-20.png')
)
UPDATE stickers
SET image_url = south_africa_images.image_url
FROM south_africa_images
WHERE stickers.collection_id = 'b2026000-0000-4000-8000-000000000001'
  AND stickers.number = 20 + south_africa_images.slot_order;
