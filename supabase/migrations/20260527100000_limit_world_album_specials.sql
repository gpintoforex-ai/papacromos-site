-- Limit World 2026 album specials to FWC 1-19 and CC 1-12.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM stickers
    WHERE collection_id = 'b2026000-0000-4000-8000-000000000001'
      AND number = 961
      AND name = 'FWC - WE ARE PANINI'
  ) THEN
    DELETE FROM stickers
    WHERE collection_id = 'b2026000-0000-4000-8000-000000000001'
      AND number = 961
      AND name = 'FWC - WE ARE PANINI';

    UPDATE stickers
    SET number = number - 1
    WHERE collection_id = 'b2026000-0000-4000-8000-000000000001'
      AND number BETWEEN 962 AND 980
      AND name LIKE 'FWC - %';
  END IF;

  DELETE FROM stickers
  WHERE collection_id = 'b2026000-0000-4000-8000-000000000001'
    AND name LIKE 'Extras - %';

  DELETE FROM stickers
  WHERE collection_id = 'b2026000-0000-4000-8000-000000000001'
    AND number BETWEEN 1013 AND 1014
    AND name LIKE 'CC - %';

  IF EXISTS (
    SELECT 1
    FROM stickers
    WHERE collection_id = 'b2026000-0000-4000-8000-000000000001'
      AND number BETWEEN 1001 AND 1012
      AND name LIKE 'CC - %'
  ) THEN
    UPDATE stickers
    SET number = number - 21
    WHERE collection_id = 'b2026000-0000-4000-8000-000000000001'
      AND number BETWEEN 1001 AND 1012
      AND name LIKE 'CC - %';
  END IF;

  UPDATE collections
  SET total_stickers = 991
  WHERE id = 'b2026000-0000-4000-8000-000000000001';
END $$;
