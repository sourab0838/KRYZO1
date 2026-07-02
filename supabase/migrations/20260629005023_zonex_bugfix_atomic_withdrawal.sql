-- Atomic withdrawal creation: inserts withdrawal row and debits wallet in one transaction
CREATE OR REPLACE FUNCTION public.create_withdrawal(
  p_user_id uuid,
  p_amount numeric(12,2),
  p_upi_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric(12,2);
  v_withdrawal_id uuid;
BEGIN
  -- Get current balance with row lock
  SELECT balance INTO v_balance FROM wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- Debit wallet
  UPDATE wallets
  SET balance = balance - p_amount,
      total_withdrawals = COALESCE(total_withdrawals, 0) + p_amount,
      updated_at = now()
  WHERE user_id = p_user_id;

  -- Create withdrawal record
  INSERT INTO withdrawals (user_id, amount, upi_id, status)
  VALUES (p_user_id, p_amount, p_upi_id, 'pending')
  RETURNING id INTO v_withdrawal_id;

  -- Record wallet transaction
  INSERT INTO wallet_transactions (user_id, type, amount, direction, status, description)
  VALUES (p_user_id, 'withdrawal', p_amount, 'debit', 'success', 'Withdrawal request to UPI: ' || p_upi_id);

  -- Send notification
  PERFORM public.create_notification(p_user_id, 'withdrawal_requested'::notification_type, 'Withdrawal Requested', 'Your withdrawal request of Rs.' || p_amount || ' is pending approval.');

  RETURN v_withdrawal_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_withdrawal TO anon, authenticated;