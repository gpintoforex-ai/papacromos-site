-- Update Canada player names in the World 2026 album.

WITH player_names(team_order, local_number, player_name) AS (
  VALUES
    (5, 2, 'Dayne St. Clair'),
    (5, 3, 'Alphonso Davies'),
    (5, 4, 'Alistair Johnston'),
    (5, 5, 'Samuel Adekugbe'),
    (5, 6, 'Richie Laryea'),
    (5, 7, 'Derek Cornelius'),
    (5, 8, 'Moise Bombito'),
    (5, 9, 'Kamal Miller'),
    (5, 10, 'Stephen Eustaquio'),
    (5, 11, 'Ismael Kone'),
    (5, 12, 'Jonathan Osorio'),
    (5, 14, 'Jacob Shaffelburg'),
    (5, 15, 'Mathieu Choiniere'),
    (5, 16, 'Niko Sigur'),
    (5, 17, 'Tajon Buchanan'),
    (5, 18, 'Liam Millar'),
    (5, 19, 'Cyle Larin'),
    (5, 20, 'Jonathan David')
)
UPDATE stickers
SET name = split_part(stickers.name, ' - ', 1) || ' - ' || player_names.player_name
FROM player_names
WHERE stickers.collection_id = 'b2026000-0000-4000-8000-000000000001'
  AND stickers.number = ((player_names.team_order - 1) * 20 + player_names.local_number);
