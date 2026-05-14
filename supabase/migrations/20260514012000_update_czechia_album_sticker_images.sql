WITH czechia_images(slot_order, image_url) AS (
  VALUES
    (1, '/stickers/tchequia/tchequia-01.png'),
    (2, '/stickers/tchequia/tchequia-02.png'),
    (3, '/stickers/tchequia/tchequia-03.png'),
    (4, '/stickers/tchequia/tchequia-04.png'),
    (5, '/stickers/tchequia/tchequia-06.png'),
    (6, '/stickers/tchequia/tchequia-07.png'),
    (7, '/stickers/tchequia/tchequia-08.png'),
    (8, '/stickers/tchequia/tchequia-09.png'),
    (9, '/stickers/tchequia/tchequia-10.png'),
    (10, '/stickers/tchequia/tchequia-11.png'),
    (11, '/stickers/tchequia/tchequia-12.png'),
    (12, '/stickers/tchequia/tchequia-13.png'),
    (13, '/stickers/tchequia/tchequia-05.png'),
    (14, '/stickers/tchequia/tchequia-14.png'),
    (15, '/stickers/tchequia/tchequia-15.png'),
    (16, '/stickers/tchequia/tchequia-16.png'),
    (17, '/stickers/tchequia/tchequia-17.png'),
    (18, '/stickers/tchequia/tchequia-18.png'),
    (19, '/stickers/tchequia/tchequia-19.png'),
    (20, '/stickers/tchequia/tchequia-20.png')
)
UPDATE stickers
SET image_url = czechia_images.image_url
FROM czechia_images
WHERE stickers.collection_id = 'b2026000-0000-4000-8000-000000000001'
  AND stickers.number = 60 + czechia_images.slot_order;
