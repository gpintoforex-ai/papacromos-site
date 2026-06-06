-- Queue one email per recipient/sender when new trade proposals are created.

CREATE OR REPLACE FUNCTION public.queue_trade_offer_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  offer_group record;
BEGIN
  FOR offer_group IN
    SELECT
      new_trade_offers.to_user_id,
      new_trade_offers.from_user_id,
      count(*) AS proposal_count,
      min(new_trade_offers.id) AS first_trade_id,
      COALESCE(NULLIF(sender.username, ''), sender.email, 'Utilizador') AS sender_name
    FROM new_trade_offers
    LEFT JOIN user_profiles sender ON sender.id = new_trade_offers.from_user_id
    WHERE new_trade_offers.to_user_id IS NOT NULL
      AND new_trade_offers.from_user_id IS NOT NULL
      AND new_trade_offers.to_user_id <> new_trade_offers.from_user_id
    GROUP BY
      new_trade_offers.to_user_id,
      new_trade_offers.from_user_id,
      COALESCE(NULLIF(sender.username, ''), sender.email, 'Utilizador')
  LOOP
    PERFORM public.queue_email_notification(
      offer_group.to_user_id,
      'Nova proposta de troca',
      offer_group.sender_name || ' enviou-te ' || offer_group.proposal_count || ' proposta' ||
        CASE WHEN offer_group.proposal_count = 1 THEN '' ELSE 's' END ||
        ' de troca no Papa Cromos.',
      jsonb_build_object(
        'type', 'trade_offer',
        'trade_id', offer_group.first_trade_id,
        'from_user_id', offer_group.from_user_id,
        'sender_name', offer_group.sender_name,
        'proposal_count', offer_group.proposal_count
      )
    );
  END LOOP;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trade_offer_created_email ON public.trade_offers;
CREATE TRIGGER trade_offer_created_email
  AFTER INSERT ON public.trade_offers
  REFERENCING NEW TABLE AS new_trade_offers
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.queue_trade_offer_email();

NOTIFY pgrst, 'reload schema';
