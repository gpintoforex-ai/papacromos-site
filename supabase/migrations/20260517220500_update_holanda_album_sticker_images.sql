WITH holanda_images(slot_order, image_url) AS (
  VALUES
    (1, '/stickers/holanda/holanda-01.jpg'),
    (2, '/stickers/holanda/holanda-02.jpg'),
    (3, '/stickers/holanda/holanda-03.jpg'),
    (4, '/stickers/holanda/holanda-04.jpg'),
    (5, '/stickers/holanda/holanda-05.jpg'),
    (6, '/stickers/holanda/holanda-06.jpg'),
    (7, '/stickers/holanda/holanda-07.jpg'),
    (8, '/stickers/holanda/holanda-08.jpg'),
    (9, '/stickers/holanda/holanda-09.jpg'),
    (10, '/stickers/holanda/holanda-10.jpg'),
    (11, '/stickers/holanda/holanda-11.jpg'),
    (12, '/stickers/holanda/holanda-12.jpg'),
    (13, '/stickers/holanda/holanda-13.jpg'),
    (14, '/stickers/holanda/holanda-14.jpg'),
    (15, '/stickers/holanda/holanda-15.jpg'),
    (16, '/stickers/holanda/holanda-16.jpg'),
    (17, '/stickers/holanda/holanda-17.jpg'),
    (18, '/stickers/holanda/holanda-18.jpg'),
    (19, '/stickers/holanda/holanda-19.jpg'),
    (20, '/stickers/holanda/holanda-20.jpg')
)
UPDATE stickers
SET image_url = holanda_images.image_url
FROM holanda_images
WHERE stickers.collection_id = 'b2026000-0000-4000-8000-000000000001'
  AND stickers.number = 400 + holanda_images.slot_order;
