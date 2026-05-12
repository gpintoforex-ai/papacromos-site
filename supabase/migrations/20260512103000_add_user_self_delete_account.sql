-- Allow authenticated users to delete their own account.
-- Deleting auth.users cascades through the app tables that reference the user id.

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  DELETE FROM auth.users
  WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.delete_own_account() FROM public;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
