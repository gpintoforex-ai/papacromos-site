/*
  # Add admin reset trade data RPC

  Creates a SECURITY DEFINER function so admins can clear trade data even when
  table RLS policies do not allow direct deletes from the client.
*/

CREATE OR REPLACE FUNCTION public.admin_reset_trade_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  DELETE FROM trade_partner_events WHERE id IS NOT NULL;
  DELETE FROM trade_messages WHERE id IS NOT NULL;
  DELETE FROM trade_offers WHERE id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reset_trade_data() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_reset_trade_data() TO authenticated;
