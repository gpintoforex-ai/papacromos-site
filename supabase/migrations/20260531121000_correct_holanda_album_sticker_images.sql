WITH holanda_images(slot_order, image_url) AS (
  VALUES
    (1, '/stickers/holanda/holanda-01.png'),
    (2, '/stickers/holanda/holanda-02.png'),
    (3, '/stickers/holanda/holanda-03.png'),
    (4, '/stickers/holanda/holanda-04.png'),
    (5, '/stickers/holanda/holanda-05.png'),
    (6, '/stickers/holanda/holanda-06.png'),
    (7, '/stickers/holanda/holanda-07.png'),
    (8, '/stickers/holanda/holanda-08.png'),
    (9, '/stickers/holanda/holanda-09.png'),
    (10, '/stickers/holanda/holanda-10.png'),
    (11, '/stickers/holanda/holanda-11.png'),
    (12, '/stickers/holanda/holanda-12.png'),
    (13, '/stickers/holanda/holanda-13.png'),
    (14, '/stickers/holanda/holanda-14.png'),
    (15, '/stickers/holanda/holanda-15.png'),
    (16, '/stickers/holanda/holanda-16.png'),
    (17, '/stickers/holanda/holanda-17.png'),
    (18, '/stickers/holanda/holanda-18.png'),
    (19, '/stickers/holanda/holanda-19.png'),
    (20, '/stickers/holanda/holanda-20.png')
)
UPDATE stickers
SET image_url = holanda_images.image_url
FROM holanda_images
WHERE stickers.collection_id = 'b2026000-0000-4000-8000-000000000001'
  AND stickers.number = 400 + holanda_images.slot_order;

-- Undo the previous Japan assignment. Those uploaded files were Netherlands images.
UPDATE stickers
SET image_url = ''
WHERE stickers.collection_id = 'b2026000-0000-4000-8000-000000000001'
  AND stickers.number BETWEEN 421 AND 440;
