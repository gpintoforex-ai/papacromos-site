-- Automatically calculate rarity from globally introduced sticker data.
-- A sticker without a real image is considered common. Once a global image is
-- assigned, rarity is derived from the sticker role/name.

CREATE OR REPLACE FUNCTION public.calculate_sticker_rarity(
  p_name text,
  p_image_url text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN COALESCE(NULLIF(trim(p_image_url), ''), '') = '' THEN 'common'
    WHEN lower(COALESCE(p_name, '')) LIKE '%foto de equipa%' THEN 'legendary'
    WHEN lower(COALESCE(p_name, '')) LIKE '%craque%' THEN 'legendary'
    WHEN lower(COALESCE(p_name, '')) LIKE '%emblema%' THEN 'rare'
    WHEN lower(COALESCE(p_name, '')) LIKE '%capitao%' THEN 'rare'
    WHEN lower(COALESCE(p_name, '')) LIKE '%capitão%' THEN 'rare'
    WHEN lower(COALESCE(p_name, '')) LIKE '%avancado%' THEN 'uncommon'
    WHEN lower(COALESCE(p_name, '')) LIKE '%avançado%' THEN 'uncommon'
    WHEN lower(COALESCE(p_name, '')) LIKE '%guarda-redes%' THEN 'uncommon'
    ELSE 'common'
  END;
$$;

CREATE OR REPLACE FUNCTION public.set_sticker_automatic_rarity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.rarity := public.calculate_sticker_rarity(NEW.name, NEW.image_url);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_sticker_automatic_rarity ON stickers;

CREATE TRIGGER set_sticker_automatic_rarity
  BEFORE INSERT OR UPDATE OF name, image_url ON stickers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_sticker_automatic_rarity();

UPDATE stickers
SET rarity = public.calculate_sticker_rarity(name, image_url);
