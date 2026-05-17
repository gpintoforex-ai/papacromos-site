WITH bosnia_images(slot_order, image_url) AS (
  VALUES
    (1, '/stickers/bosnia-e-herzegovina/bosnia-e-herzegovina-01.png'),
    (2, '/stickers/bosnia-e-herzegovina/bosnia-e-herzegovina-02.png'),
    (3, '/stickers/bosnia-e-herzegovina/bosnia-e-herzegovina-03.png'),
    (4, '/stickers/bosnia-e-herzegovina/bosnia-e-herzegovina-04.png'),
    (5, '/stickers/bosnia-e-herzegovina/bosnia-e-herzegovina-05.png'),
    (6, '/stickers/bosnia-e-herzegovina/bosnia-e-herzegovina-06.png'),
    (7, '/stickers/bosnia-e-herzegovina/bosnia-e-herzegovina-07.png'),
    (8, '/stickers/bosnia-e-herzegovina/bosnia-e-herzegovina-08.png'),
    (9, '/stickers/bosnia-e-herzegovina/bosnia-e-herzegovina-09.png'),
    (10, '/stickers/bosnia-e-herzegovina/bosnia-e-herzegovina-10.png'),
    (11, '/stickers/bosnia-e-herzegovina/bosnia-e-herzegovina-11.png'),
    (12, '/stickers/bosnia-e-herzegovina/bosnia-e-herzegovina-12.png'),
    (13, '/stickers/bosnia-e-herzegovina/bosnia-e-herzegovina-13.png'),
    (14, '/stickers/bosnia-e-herzegovina/bosnia-e-herzegovina-14.png'),
    (15, '/stickers/bosnia-e-herzegovina/bosnia-e-herzegovina-15.png'),
    (16, '/stickers/bosnia-e-herzegovina/bosnia-e-herzegovina-16.png'),
    (17, '/stickers/bosnia-e-herzegovina/bosnia-e-herzegovina-17.png'),
    (18, '/stickers/bosnia-e-herzegovina/bosnia-e-herzegovina-18.png'),
    (19, '/stickers/bosnia-e-herzegovina/bosnia-e-herzegovina-19.png'),
    (20, '/stickers/bosnia-e-herzegovina/bosnia-e-herzegovina-20.png')
)
UPDATE stickers
SET image_url = bosnia_images.image_url
FROM bosnia_images
WHERE stickers.collection_id = 'b2026000-0000-4000-8000-000000000001'
  AND stickers.number = 100 + bosnia_images.slot_order;
