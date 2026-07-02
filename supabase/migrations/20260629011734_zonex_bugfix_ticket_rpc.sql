-- Atomic ticket creation: creates ticket and initial message in one transaction
CREATE OR REPLACE FUNCTION public.create_ticket_with_message(
  p_user_id uuid,
  p_subject text,
  p_category text,
  p_message text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket_id uuid;
BEGIN
  INSERT INTO support_tickets (user_id, subject, category, status)
  VALUES (p_user_id, p_subject, p_category, 'open')
  RETURNING id INTO v_ticket_id;

  INSERT INTO support_ticket_messages (ticket_id, user_id, sender, message)
  VALUES (v_ticket_id, p_user_id, 'user', p_message);

  PERFORM public.create_notification(p_user_id, 'support'::notification_type,
    'Ticket Created', 'Your support ticket "' || p_subject || '" has been submitted.');

  RETURN v_ticket_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_ticket_with_message TO anon, authenticated;
