WITH south_korea_images(slot_order, image_url) AS (
  VALUES
    (1, '/stickers/republica-da-coreia/republica-da-coreia-01.png'),
    (2, '/stickers/republica-da-coreia/republica-da-coreia-02.png'),
    (3, '/stickers/republica-da-coreia/republica-da-coreia-03.png'),
    (4, '/stickers/republica-da-coreia/republica-da-coreia-04.png'),
    (5, '/stickers/republica-da-coreia/republica-da-coreia-06.png'),
    (6, '/stickers/republica-da-coreia/republica-da-coreia-07.png'),
    (7, '/stickers/republica-da-coreia/republica-da-coreia-08.png'),
    (8, '/stickers/republica-da-coreia/republica-da-coreia-09.png'),
    (9, '/stickers/republica-da-coreia/republica-da-coreia-10.png'),
    (10, '/stickers/republica-da-coreia/republica-da-coreia-11.png'),
    (11, '/stickers/republica-da-coreia/republica-da-coreia-12.png'),
    (12, '/stickers/republica-da-coreia/republica-da-coreia-13.png'),
    (13, '/stickers/republica-da-coreia/republica-da-coreia-05.png'),
    (14, '/stickers/republica-da-coreia/republica-da-coreia-14.png'),
    (15, '/stickers/republica-da-coreia/republica-da-coreia-15.png'),
    (16, '/stickers/republica-da-coreia/republica-da-coreia-16.png'),
    (17, '/stickers/republica-da-coreia/republica-da-coreia-17.png'),
    (18, '/stickers/republica-da-coreia/republica-da-coreia-18.png'),
    (19, '/stickers/republica-da-coreia/republica-da-coreia-19.png'),
    (20, '/stickers/republica-da-coreia/republica-da-coreia-20.png')
)
UPDATE stickers
SET image_url = south_korea_images.image_url
FROM south_korea_images
WHERE stickers.collection_id = 'b2026000-0000-4000-8000-000000000001'
  AND stickers.number = 40 + south_korea_images.slot_order;
