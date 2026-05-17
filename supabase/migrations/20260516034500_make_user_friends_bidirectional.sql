/*
  # Bidirectional user friends

  Keeps user_friends symmetric:
  - when user A adds user B, user B also sees user A as a friend;
  - when user A removes user B, the reverse friendship is removed too.
*/

CREATE OR REPLACE FUNCTION public.create_reciprocal_user_friend()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_friends (user_id, friend_id, created_at)
  VALUES (NEW.friend_id, NEW.user_id, NEW.created_at)
  ON CONFLICT (user_id, friend_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_reciprocal_user_friend_after_insert ON public.user_friends;
CREATE TRIGGER create_reciprocal_user_friend_after_insert
  AFTER INSERT ON public.user_friends
  FOR EACH ROW
  EXECUTE FUNCTION public.create_reciprocal_user_friend();

CREATE OR REPLACE FUNCTION public.delete_reciprocal_user_friend()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.user_friends
  WHERE user_id = OLD.friend_id
    AND friend_id = OLD.user_id;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS delete_reciprocal_user_friend_after_delete ON public.user_friends;
CREATE TRIGGER delete_reciprocal_user_friend_after_delete
  AFTER DELETE ON public.user_friends
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_reciprocal_user_friend();

INSERT INTO public.user_friends (user_id, friend_id, created_at)
SELECT existing.friend_id, existing.user_id, existing.created_at
FROM public.user_friends existing
WHERE NOT EXISTS (
  SELECT 1
  FROM public.user_friends reciprocal
  WHERE reciprocal.user_id = existing.friend_id
    AND reciprocal.friend_id = existing.user_id
)
ON CONFLICT (user_id, friend_id) DO NOTHING;
