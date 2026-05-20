-- Update Algeria player names in the World 2026 album from the printed album page.

WITH algeria_stickers(local_number, sticker_name) AS (
  VALUES
    (1, 'Argelia - Escudo'),
    (2, 'Argelia - Alexis Guendouz'),
    (3, 'Argelia - Ramy Bensebaini'),
    (4, 'Argelia - Youcef Atal'),
    (5, 'Argelia - Rayan Ait-Nouri'),
    (6, 'Argelia - Mohamed Amine Tougai'),
    (7, 'Argelia - Aissa Mandi'),
    (8, 'Argelia - Ismael Bennacer'),
    (9, 'Argelia - Houssem Aouar'),
    (10, 'Argelia - Hicham Boudaoui'),
    (11, 'Argelia - Ramiz Zerrouki'),
    (12, 'Argelia - Nabil Bentaleb'),
    (13, 'Argelia - Foto de equipa'),
    (14, 'Argelia - Fares Chaibi'),
    (15, 'Argelia - Riyad Mahrez'),
    (16, 'Argelia - Said Benrahma'),
    (17, 'Argelia - Anis Hadj Moussa'),
    (18, 'Argelia - Amine Gouiri'),
    (19, 'Argelia - Baghdad Bounedjah'),
    (20, 'Argelia - Mohammed Amoura')
)
UPDATE stickers
SET name = algeria_stickers.sticker_name
FROM algeria_stickers
WHERE stickers.collection_id = 'b2026000-0000-4000-8000-000000000001'
  AND stickers.number = ((38 - 1) * 20 + algeria_stickers.local_number);
