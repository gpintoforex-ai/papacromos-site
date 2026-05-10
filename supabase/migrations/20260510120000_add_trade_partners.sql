/*
  # Add trade partner pickup points

  Partners are local pickup/drop-off points for accepted sticker trades.
*/

ALTER TABLE trade_offers
  ADD COLUMN IF NOT EXISTS partner_id uuid,
  ADD COLUMN IF NOT EXISTS logistics_status text NOT NULL DEFAULT 'none'
    CHECK (logistics_status IN ('none', 'awaiting_deliveries', 'ready_for_pickup', 'completed')),
  ADD COLUMN IF NOT EXISTS from_user_delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS to_user_delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS from_user_collected_at timestamptz,
  ADD COLUMN IF NOT EXISTS to_user_collected_at timestamptz;

CREATE TABLE IF NOT EXISTS partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  latitude numeric,
  longitude numeric,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

ALTER TABLE trade_offers
  ADD CONSTRAINT trade_offers_partner_id_fkey
  FOREIGN KEY (partner_id) REFERENCES partners(id)
  ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS partner_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(partner_id, user_id)
);

ALTER TABLE partner_staff ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS trade_partner_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL REFERENCES trade_offers(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('delivered', 'collected')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE trade_partner_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_partners_city ON partners(city);
CREATE INDEX IF NOT EXISTS idx_partner_staff_user_id ON partner_staff(user_id);
CREATE INDEX IF NOT EXISTS idx_trade_offers_partner_id ON trade_offers(partner_id);
CREATE INDEX IF NOT EXISTS idx_trade_offers_logistics_status ON trade_offers(logistics_status);
CREATE INDEX IF NOT EXISTS idx_trade_partner_events_trade_id ON trade_partner_events(trade_id);
CREATE INDEX IF NOT EXISTS idx_trade_partner_events_partner_id ON trade_partner_events(partner_id);

DROP POLICY IF EXISTS "Authenticated users can view partners" ON partners;
DROP POLICY IF EXISTS "Admins can manage partners" ON partners;
DROP POLICY IF EXISTS "Users can view own partner staff row" ON partner_staff;
DROP POLICY IF EXISTS "Admins can manage partner staff" ON partner_staff;
DROP POLICY IF EXISTS "Users can view partner events for their trades" ON trade_partner_events;
DROP POLICY IF EXISTS "Partner staff can create partner events" ON trade_partner_events;

CREATE POLICY "Authenticated users can view partners"
  ON partners FOR SELECT
  TO authenticated
  USING (active = true OR public.current_user_is_admin());

CREATE POLICY "Admins can manage partners"
  ON partners FOR ALL
  TO authenticated
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());

CREATE POLICY "Users can view own partner staff row"
  ON partner_staff FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.current_user_is_admin());

CREATE POLICY "Admins can manage partner staff"
  ON partner_staff FOR ALL
  TO authenticated
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());

CREATE POLICY "Users can view partner events for their trades"
  ON trade_partner_events FOR SELECT
  TO authenticated
  USING (
    public.current_user_is_admin()
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM partner_staff
      WHERE partner_staff.partner_id = trade_partner_events.partner_id
        AND partner_staff.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM trade_offers
      WHERE trade_offers.id = trade_partner_events.trade_id
        AND (trade_offers.from_user_id = auth.uid() OR trade_offers.to_user_id = auth.uid())
    )
  );

CREATE POLICY "Partner staff can create partner events"
  ON trade_partner_events FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM partner_staff
      WHERE partner_staff.partner_id = trade_partner_events.partner_id
        AND partner_staff.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view trades involving them" ON trade_offers;
DROP POLICY IF EXISTS "Users can update trades involving them" ON trade_offers;

CREATE POLICY "Users, admins and partners can view related trades"
  ON trade_offers FOR SELECT
  TO authenticated
  USING (
    auth.uid() = from_user_id
    OR auth.uid() = to_user_id
    OR public.current_user_is_admin()
    OR EXISTS (
      SELECT 1
      FROM partner_staff
      WHERE partner_staff.partner_id = trade_offers.partner_id
        AND partner_staff.user_id = auth.uid()
    )
  );

CREATE POLICY "Users, admins and partners can update related trades"
  ON trade_offers FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = from_user_id
    OR auth.uid() = to_user_id
    OR public.current_user_is_admin()
    OR EXISTS (
      SELECT 1
      FROM partner_staff
      WHERE partner_staff.partner_id = trade_offers.partner_id
        AND partner_staff.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = from_user_id
    OR auth.uid() = to_user_id
    OR public.current_user_is_admin()
    OR EXISTS (
      SELECT 1
      FROM partner_staff
      WHERE partner_staff.partner_id = trade_offers.partner_id
        AND partner_staff.user_id = auth.uid()
    )
  );

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
