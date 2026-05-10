/*
  # Add trade negotiation details and messages

  Adds delivery method, an initial note, and a chat table for trade negotiation.
*/

ALTER TABLE trade_offers
  ADD COLUMN IF NOT EXISTS delivery_method text NOT NULL DEFAULT 'presencial'
    CHECK (delivery_method IN ('presencial', 'correio', 'outro')),
  ADD COLUMN IF NOT EXISTS note text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS trade_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL REFERENCES trade_offers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE trade_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_trade_messages_trade_id ON trade_messages(trade_id);
CREATE INDEX IF NOT EXISTS idx_trade_messages_user_id ON trade_messages(user_id);

DROP POLICY IF EXISTS "Users can view messages for their trades" ON trade_messages;
DROP POLICY IF EXISTS "Users can create messages for their trades" ON trade_messages;

CREATE POLICY "Users can view messages for their trades"
  ON trade_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM trade_offers
      WHERE trade_offers.id = trade_messages.trade_id
        AND (trade_offers.from_user_id = auth.uid() OR trade_offers.to_user_id = auth.uid())
    )
  );

CREATE POLICY "Users can create messages for their trades"
  ON trade_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM trade_offers
      WHERE trade_offers.id = trade_messages.trade_id
        AND (trade_offers.from_user_id = auth.uid() OR trade_offers.to_user_id = auth.uid())
    )
  );
