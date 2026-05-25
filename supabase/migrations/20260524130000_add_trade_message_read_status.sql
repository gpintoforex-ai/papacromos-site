-- Add explicit read/unread status to trade messages.
ALTER TABLE trade_messages
  ADD COLUMN IF NOT EXISTS is_read boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_trade_messages_is_read ON trade_messages(is_read);

DROP POLICY IF EXISTS "Users can update received trade messages" ON trade_messages;

CREATE POLICY "Users can update received trade messages"
  ON trade_messages FOR UPDATE
  TO authenticated
  USING (
    auth.uid() <> user_id
    AND EXISTS (
      SELECT 1
      FROM trade_offers
      WHERE trade_offers.id = trade_messages.trade_id
        AND (trade_offers.from_user_id = auth.uid() OR trade_offers.to_user_id = auth.uid())
    )
  )
  WITH CHECK (
    auth.uid() <> user_id
    AND EXISTS (
      SELECT 1
      FROM trade_offers
      WHERE trade_offers.id = trade_messages.trade_id
        AND (trade_offers.from_user_id = auth.uid() OR trade_offers.to_user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete own trade messages" ON trade_messages;

CREATE POLICY "Users can delete own trade messages"
  ON trade_messages FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM trade_offers
      WHERE trade_offers.id = trade_messages.trade_id
        AND (trade_offers.from_user_id = auth.uid() OR trade_offers.to_user_id = auth.uid())
    )
  );
