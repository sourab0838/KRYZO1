-- Atomic confirm receipt: releases escrow and updates order in one transaction
CREATE OR REPLACE FUNCTION public.confirm_receipt(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_seller_id uuid;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id AND delivery_status = 'delivered';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found or not delivered yet';
  END IF;

  -- Update order status
  UPDATE orders
  SET status = 'completed',
      delivery_status = 'confirmed',
      escrow_status = 'released',
      updated_at = now()
  WHERE id = p_order_id;

  -- Release escrow: move from pending to available for seller
  UPDATE wallets
  SET pending_balance = GREATEST(pending_balance - v_order.seller_payout, 0),
      balance = balance + v_order.seller_payout,
      total_earnings = COALESCE(total_earnings, 0) + v_order.seller_payout,
      updated_at = now()
  WHERE user_id = v_order.seller_id;

  -- Update escrow hold
  UPDATE escrow_holds
  SET status = 'released', released_at = now()
  WHERE order_id = p_order_id;

  -- Record wallet transaction for seller
  INSERT INTO wallet_transactions (user_id, type, amount, direction, status, description)
  VALUES (v_order.seller_id, 'sale', v_order.seller_payout, 'credit', 'success',
          'Escrow released for order ' || p_order_id::text);

  -- Send notifications
  PERFORM public.create_notification(v_order.buyer_id, 'buyer_confirmed'::notification_type,
    'Order Completed', 'You confirmed receipt. Escrow funds released to seller.');
  PERFORM public.create_notification(v_order.seller_id, 'funds_released'::notification_type,
    'Funds Released', 'Rs.' || v_order.seller_payout || ' released from escrow to your available balance.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_receipt TO anon, authenticated;
