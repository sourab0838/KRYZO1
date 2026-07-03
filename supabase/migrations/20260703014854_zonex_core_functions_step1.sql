-- ============================================================
-- CORE LISTING AND ORDER FUNCTIONS
-- ============================================================

-- Create listing with gallery images
CREATE OR REPLACE FUNCTION create_listing_with_gallery(
  p_seller_id uuid,
  p_title text,
  p_game text,
  p_uid text,
  p_account_level integer,
  p_br_rank text,
  p_cs_rank text,
  p_evo_gun_level integer,
  p_prime_level integer,
  p_diamonds integer,
  p_price integer,
  p_original_price integer DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_seller_whatsapp text DEFAULT NULL,
  p_profile_image text DEFAULT NULL,
  p_gallery_urls text[] DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_listing_id uuid;
  v_img_url text;
  v_sort_order integer := 0;
BEGIN
  -- Insert listing
  INSERT INTO account_listings (
    seller_id, title, game, uid, account_level, br_rank, cs_rank,
    evo_gun_level, prime_level, diamonds, price, original_price,
    description, seller_whatsapp, profile_image, status
  ) VALUES (
    p_seller_id, p_title, p_game, p_uid, p_account_level, p_br_rank, p_cs_rank,
    p_evo_gun_level, p_prime_level, p_diamonds, p_price, p_original_price,
    p_description, p_seller_whatsapp, p_profile_image, 'pending'
  ) RETURNING id INTO v_listing_id;

  -- Insert gallery images
  FOREACH v_img_url IN ARRAY p_gallery_urls
  LOOP
    IF v_img_url IS NOT NULL AND v_img_url != '' THEN
      INSERT INTO listing_galleries (listing_id, image_url, sort_order)
      VALUES (v_listing_id, v_img_url, v_sort_order);
      v_sort_order := v_sort_order + 1;
    END IF;
  END LOOP;

  RETURN v_listing_id;
END;
$$;

-- Increment listing views
CREATE OR REPLACE FUNCTION increment_listing_views(p_listing_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE account_listings SET views = views + 1 WHERE id = p_listing_id;
END;
$$;

-- Confirm receipt (buyer confirms delivery)
CREATE OR REPLACE FUNCTION confirm_receipt(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  
  IF v_order.status != 'buyer_reviewing' THEN
    RAISE EXCEPTION 'Order must be in buyer_reviewing status';
  END IF;
  
  -- Update order status
  UPDATE orders SET 
    status = 'completed',
    delivery_status = 'confirmed',
    updated_at = now()
  WHERE id = p_order_id;
  
  -- Release escrow to seller
  PERFORM release_escrow(p_order_id);
END;
$$;

-- Create support ticket with initial message
CREATE OR REPLACE FUNCTION create_ticket_with_message(
  p_user_id uuid,
  p_subject text,
  p_category text,
  p_message text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ticket_id uuid;
BEGIN
  -- Create ticket
  INSERT INTO support_tickets (user_id, subject, category, status)
  VALUES (p_user_id, p_subject, p_category, 'open')
  RETURNING id INTO v_ticket_id;
  
  -- Create initial message
  INSERT INTO support_ticket_messages (ticket_id, user_id, sender, message)
  VALUES (v_ticket_id, p_user_id, 'user', p_message);
  
  RETURN v_ticket_id;
END;
$$;

-- Create withdrawal request
CREATE OR REPLACE FUNCTION create_withdrawal(
  p_user_id uuid,
  p_upi_id text,
  p_amount numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet RECORD;
  v_withdrawal_id uuid;
BEGIN
  -- Get wallet
  SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;
  
  IF v_wallet.balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;
  
  -- Deduct from wallet
  UPDATE wallets SET 
    balance = balance - p_amount,
    total_withdrawals = total_withdrawals + p_amount,
    updated_at = now()
  WHERE user_id = p_user_id;
  
  -- Record transaction
  INSERT INTO wallet_transactions (user_id, type, amount, direction, status, description)
  VALUES (p_user_id, 'withdrawal', p_amount, 'debit', 'pending', 'Withdrawal to UPI: ' || p_upi_id);
  
  -- Create withdrawal record
  INSERT INTO withdrawals (user_id, upi_id, amount, status)
  VALUES (p_user_id, p_upi_id, p_amount, 'pending')
  RETURNING id INTO v_withdrawal_id;
  
  RETURN v_withdrawal_id;
END;
$$;

-- Resolve fraud flag
CREATE OR REPLACE FUNCTION resolve_fraud_flag(p_flag_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE fraud_flags SET resolved = true, resolved_at = now()
  WHERE id = p_flag_id;
END;
$$;

-- ============================================================
-- ADMIN FUNCTIONS
-- ============================================================

-- Get dashboard stats
CREATE OR REPLACE FUNCTION admin_get_dashboard_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'total_users', (SELECT COUNT(*) FROM profiles),
    'total_buyers', (SELECT COUNT(*) FROM profiles WHERE id IN (SELECT buyer_id FROM orders GROUP BY buyer_id)),
    'total_sellers', (SELECT COUNT(*) FROM profiles WHERE id IN (SELECT seller_id FROM account_listings GROUP BY seller_id)),
    'verified_sellers', (SELECT COUNT(*) FROM profiles WHERE verified_seller = true),
    'pending_kyc', (SELECT COUNT(*) FROM kyc_verifications WHERE status = 'pending'),
    'approved_kyc', (SELECT COUNT(*) FROM kyc_verifications WHERE status = 'approved'),
    'rejected_kyc', (SELECT COUNT(*) FROM kyc_verifications WHERE status = 'rejected'),
    'active_listings', (SELECT COUNT(*) FROM account_listings WHERE status = 'approved'),
    'pending_listings', (SELECT COUNT(*) FROM account_listings WHERE status = 'pending'),
    'sold_listings', (SELECT COUNT(*) FROM account_listings WHERE status = 'sold'),
    'total_orders', (SELECT COUNT(*) FROM orders),
    'pending_orders', (SELECT COUNT(*) FROM orders WHERE status IN ('pending', 'payment_successful', 'awaiting_delivery')),
    'completed_orders', (SELECT COUNT(*) FROM orders WHERE status = 'completed'),
    'cancelled_orders', (SELECT COUNT(*) FROM orders WHERE status = 'cancelled'),
    'disputed_orders', (SELECT COUNT(*) FROM orders WHERE status = 'disputed'),
    'wallet_deposits', COALESCE((SELECT SUM(amount) FROM wallet_transactions WHERE type = 'deposit' AND status = 'success'), 0),
    'wallet_withdrawals', COALESCE((SELECT SUM(amount) FROM wallet_transactions WHERE type = 'withdrawal' AND status = 'success'), 0),
    'escrow_balance', COALESCE((SELECT SUM(total_amount) FROM escrow_holds WHERE status = 'held'), 0),
    'buyer_fee_revenue', COALESCE((SELECT SUM(platform_fee) FROM orders WHERE status = 'completed'), 0),
    'seller_commission_revenue', COALESCE((SELECT SUM(seller_commission) FROM orders WHERE status = 'completed'), 0),
    'total_platform_revenue', COALESCE((SELECT SUM(platform_fee + seller_commission) FROM orders WHERE status = 'completed'), 0),
    'daily_revenue', COALESCE((SELECT SUM(platform_fee + seller_commission) FROM orders WHERE status = 'completed' AND DATE(created_at) = CURRENT_DATE), 0),
    'weekly_revenue', COALESCE((SELECT SUM(platform_fee + seller_commission) FROM orders WHERE status = 'completed' AND created_at >= CURRENT_DATE - INTERVAL '7 days'), 0),
    'monthly_revenue', COALESCE((SELECT SUM(platform_fee + seller_commission) FROM orders WHERE status = 'completed' AND created_at >= CURRENT_DATE - INTERVAL '30 days'), 0),
    'yearly_revenue', COALESCE((SELECT SUM(platform_fee + seller_commission) FROM orders WHERE status = 'completed' AND created_at >= CURRENT_DATE - INTERVAL '365 days'), 0)
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Update listing status
CREATE OR REPLACE FUNCTION admin_update_listing_status(
  p_listing_id uuid,
  p_action text,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  CASE p_action
    WHEN 'approve' THEN
      UPDATE account_listings SET status = 'approved', updated_at = now() WHERE id = p_listing_id;
    WHEN 'reject' THEN
      UPDATE account_listings SET status = 'rejected', rejection_reason = p_reason, updated_at = now() WHERE id = p_listing_id;
    WHEN 'feature' THEN
      UPDATE account_listings SET featured = true, updated_at = now() WHERE id = p_listing_id;
    WHEN 'unfeature' THEN
      UPDATE account_listings SET featured = false, updated_at = now() WHERE id = p_listing_id;
    WHEN 'hide' THEN
      UPDATE account_listings SET status = 'draft', updated_at = now() WHERE id = p_listing_id;
    ELSE
      RAISE EXCEPTION 'Unknown action: %', p_action;
  END CASE;
END;
$$;

-- Update user status
CREATE OR REPLACE FUNCTION admin_update_user_status(
  p_user_id uuid,
  p_action text,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  CASE p_action
    WHEN 'ban' THEN
      UPDATE profiles SET is_banned = true, banned_reason = p_reason, updated_at = now() WHERE id = p_user_id;
    WHEN 'unban' THEN
      UPDATE profiles SET is_banned = false, banned_reason = NULL, updated_at = now() WHERE id = p_user_id;
    WHEN 'suspend' THEN
      UPDATE profiles SET is_suspended = true, suspended_reason = p_reason, updated_at = now() WHERE id = p_user_id;
    WHEN 'unsuspend' THEN
      UPDATE profiles SET is_suspended = false, suspended_reason = NULL, updated_at = now() WHERE id = p_user_id;
    ELSE
      RAISE EXCEPTION 'Unknown action: %', p_action;
  END CASE;
END;
$$;

-- Update withdrawal status
CREATE OR REPLACE FUNCTION admin_update_withdrawal_status(
  p_withdrawal_id uuid,
  p_status text,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_withdrawal RECORD;
BEGIN
  SELECT * INTO v_withdrawal FROM withdrawals WHERE id = p_withdrawal_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Withdrawal not found';
  END IF;
  
  UPDATE withdrawals SET 
    status = p_status,
    reason = p_reason,
    processed_at = now(),
    updated_at = now()
  WHERE id = p_withdrawal_id;
  
  -- If rejected, refund to wallet
  IF p_status = 'rejected' THEN
    UPDATE wallets SET 
      balance = balance + v_withdrawal.amount,
      total_withdrawals = total_withdrawals - v_withdrawal.amount,
      updated_at = now()
    WHERE user_id = v_withdrawal.user_id;
    
    INSERT INTO wallet_transactions (user_id, type, amount, direction, status, description)
    VALUES (v_withdrawal.user_id, 'refund', v_withdrawal.amount, 'credit', 'success', 'Withdrawal rejected: ' || COALESCE(p_reason, ''));
  END IF;
END;
$$;

-- Broadcast notification
CREATE OR REPLACE FUNCTION admin_broadcast_notification(
  p_type text,
  p_title text,
  p_message text,
  p_target_audience text DEFAULT 'all'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO admin_notifications (type, title, message, target_audience, is_active)
  VALUES (p_type, p_title, p_message, p_target_audience, true);
  
  -- Insert notifications for target users
  IF p_target_audience = 'all' THEN
    INSERT INTO notifications (user_id, type, title, message)
    SELECT id, p_type::notification_type, p_title, p_message FROM profiles;
  ELSIF p_target_audience = 'sellers' THEN
    INSERT INTO notifications (user_id, type, title, message)
    SELECT id, p_type::notification_type, p_title, p_message FROM profiles
    WHERE id IN (SELECT seller_id FROM account_listings GROUP BY seller_id);
  ELSIF p_target_audience = 'buyers' THEN
    INSERT INTO notifications (user_id, type, title, message)
    SELECT id, p_type::notification_type, p_title, p_message FROM profiles
    WHERE id IN (SELECT buyer_id FROM orders GROUP BY buyer_id);
  END IF;
END;
$$;

-- Log login event
CREATE OR REPLACE FUNCTION log_login_event(
  p_user_id uuid,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_success boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO login_logs (user_id, ip_address, user_agent, success)
  VALUES (p_user_id, p_ip_address, p_user_agent, p_success);
END;
$$;

-- Admin release escrow
CREATE OR REPLACE FUNCTION admin_release_escrow(p_order_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM release_escrow(p_order_id);
END;
$$;

-- Admin refund escrow
CREATE OR REPLACE FUNCTION admin_refund_escrow(p_order_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM refund_escrow(p_order_id);
END;
$$;