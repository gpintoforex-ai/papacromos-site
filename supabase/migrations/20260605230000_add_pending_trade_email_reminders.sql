-- Track email reminders for pending trade proposals so scheduled jobs do not resend them continuously.

ALTER TABLE public.trade_offers
  ADD COLUMN IF NOT EXISTS pending_email_last_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_trade_offers_pending_email_reminders
  ON public.trade_offers(status, pending_email_last_sent_at, created_at)
  WHERE status = 'pending';
