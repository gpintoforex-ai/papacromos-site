CREATE OR REPLACE FUNCTION public.notify_trade_status_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient_id uuid;
  notification_title text;
  notification_body text;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  recipient_id := CASE
    WHEN auth.uid() IS NOT NULL AND auth.uid() = NEW.from_user_id THEN NEW.to_user_id
    WHEN auth.uid() IS NOT NULL AND auth.uid() = NEW.to_user_id THEN NEW.from_user_id
    ELSE NEW.from_user_id
  END;

  notification_title := CASE NEW.status
    WHEN 'accepted' THEN 'Troca aceite'
    WHEN 'rejected' THEN 'Troca recusada'
    WHEN 'completed' THEN 'Troca concluida'
    ELSE 'Estado da troca atualizado'
  END;

  notification_body := CASE NEW.status
    WHEN 'accepted' THEN 'A tua proposta de troca foi aceite.'
    WHEN 'rejected' THEN 'A tua proposta de troca foi recusada.'
    WHEN 'completed' THEN 'Uma troca foi marcada como concluida.'
    ELSE 'Uma troca foi atualizada.'
  END;

  IF recipient_id IS NOT NULL THEN
    PERFORM public.queue_push_notification(
      recipient_id,
      notification_title,
      notification_body,
      jsonb_build_object('type', 'trade_status', 'trade_id', NEW.id, 'status', NEW.status)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trade_status_changed_push ON trade_offers;
CREATE TRIGGER trade_status_changed_push
  AFTER UPDATE OF status ON trade_offers
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_trade_status_changed();
