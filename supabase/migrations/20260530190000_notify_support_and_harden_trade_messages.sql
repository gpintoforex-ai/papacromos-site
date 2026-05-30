-- Queue push notifications when users receive trade or support messages.

CREATE OR REPLACE FUNCTION public.notify_trade_message_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient_id uuid;
  message_preview text;
BEGIN
  SELECT CASE
    WHEN trade_offers.from_user_id = NEW.user_id THEN trade_offers.to_user_id
    WHEN trade_offers.to_user_id = NEW.user_id THEN trade_offers.from_user_id
    ELSE NULL
  END
  INTO recipient_id
  FROM trade_offers
  WHERE trade_offers.id = NEW.trade_id;

  message_preview := left(trim(regexp_replace(COALESCE(NEW.message, ''), '\s+', ' ', 'g')), 120);

  IF recipient_id IS NOT NULL AND recipient_id <> NEW.user_id THEN
    PERFORM public.queue_push_notification(
      recipient_id,
      'Nova mensagem',
      CASE
        WHEN message_preview = '' THEN 'Recebeste uma nova mensagem numa troca.'
        ELSE message_preview
      END,
      jsonb_build_object('type', 'trade_message', 'trade_id', NEW.trade_id, 'message_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trade_message_created_push ON trade_messages;
CREATE TRIGGER trade_message_created_push
  AFTER INSERT ON trade_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_trade_message_created();

CREATE OR REPLACE FUNCTION public.notify_support_message_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient_id uuid;
  ticket_subject text;
  message_preview text;
BEGIN
  SELECT support_tickets.user_id, support_tickets.subject
  INTO recipient_id, ticket_subject
  FROM support_tickets
  WHERE support_tickets.id = NEW.ticket_id;

  message_preview := left(trim(regexp_replace(COALESCE(NEW.message, ''), '\s+', ' ', 'g')), 120);

  IF recipient_id IS NOT NULL AND recipient_id <> NEW.user_id THEN
    PERFORM public.queue_push_notification(
      recipient_id,
      'Nova resposta do suporte',
      CASE
        WHEN message_preview = '' THEN 'Recebeste uma nova resposta do suporte.'
        ELSE message_preview
      END,
      jsonb_build_object(
        'type', 'support_message',
        'ticket_id', NEW.ticket_id,
        'message_id', NEW.id,
        'subject', ticket_subject
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_message_created_push ON support_ticket_messages;
CREATE TRIGGER support_message_created_push
  AFTER INSERT ON support_ticket_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_support_message_created();

NOTIFY pgrst, 'reload schema';
