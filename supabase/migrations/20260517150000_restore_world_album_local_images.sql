-- Restore local sticker images for World 2026 teams that already have assets.
-- Preserves custom uploaded/storage URLs and only replaces empty, generic Pexels,
-- or existing local /stickers paths.

WITH local_teams(team_order, folder, team_photo_file_05) AS (
  VALUES
    (1, 'mexico', true),
    (2, 'africa-do-sul', true),
    (3, 'republica-da-coreia', true),
    (4, 'tchequia', true),
    (5, 'canada', false),
    (6, 'bosnia-e-herzegovina', false),
    (7, 'qatar', false),
    (8, 'suica', false),
    (9, 'brasil', false),
    (10, 'marrocos', false),
    (11, 'haiti', false),
    (12, 'escocia', false),
    (13, 'estados-unidos', false),
    (14, 'australia', false),
    (15, 'paraguai', false),
    (16, 'turquia', false),
    (17, 'alemanha', false),
    (18, 'curacao', false),
    (20, 'equador', false),
    (39, 'austria', false)
),
local_images AS (
  SELECT
    ((local_teams.team_order - 1) * 20 + slot_order) AS number,
    '/stickers/' || local_teams.folder || '/' || local_teams.folder || '-' ||
      lpad(
        CASE
          WHEN local_teams.team_photo_file_05 AND slot_order = 13 THEN 5
          WHEN local_teams.team_photo_file_05 AND slot_order BETWEEN 5 AND 12 THEN slot_order + 1
          ELSE slot_order
        END::text,
        2,
        '0'
      ) || '.png' AS image_url
  FROM local_teams
  CROSS JOIN generate_series(1, 20) AS slot_order
)
UPDATE stickers
SET image_url = local_images.image_url
FROM local_images
WHERE stickers.collection_id = 'b2026000-0000-4000-8000-000000000001'
  AND stickers.number = local_images.number
  AND (
    COALESCE(stickers.image_url, '') = ''
    OR stickers.image_url LIKE 'https://images.pexels.com/%'
    OR stickers.image_url LIKE '/stickers/%'
  );
