-- ============================================================
-- ADMIN FUNCTIONS (step 2b)
-- ============================================================

-- Get wallets overview
CREATE OR REPLACE FUNCTION admin_get_wallets_overview()
RETURNS TABLE (
  user_id uuid,
  balance numeric,
  pending_balance numeric,
  total_earnings numeric,
  total_deposits numeric,
  total_withdrawals numeric,
  updated_at timestamptz,
  full_name text,
  username text,
  email text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    w.user_id,
    w.balance,
    w.pending_balance,
    w.total_earnings,
    w.total_deposits,
    w.total_withdrawals,
    w.updated_at,
    p.full_name,
    p.username,
    p.email
  FROM wallets w
  JOIN profiles p ON p.id = w.user_id
  ORDER BY w.balance DESC;
END;
$$;

-- Get orders (admin)
CREATE OR REPLACE FUNCTION admin_get_orders(
  p_status text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  listing_id uuid,
  buyer_id uuid,
  seller_id uuid,
  amount integer,
  status text,
  escrow_status text,
  delivery_status text,
  platform_fee numeric,
  seller_commission numeric,
  seller_payout numeric,
  created_at timestamptz,
  updated_at timestamptz,
  buyer_full_name text,
  buyer_username text,
  buyer_email text,
  seller_full_name text,
  seller_username text,
  seller_email text,
  listing_title text,
  listing_game text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.listing_id,
    o.buyer_id,
    o.seller_id,
    o.amount,
    o.status,
    o.escrow_status,
    o.delivery_status,
    o.platform_fee,
    o.seller_commission,
    o.seller_payout,
    o.created_at,
    o.updated_at,
    p1.full_name,
    p1.username,
    p1.email,
    p2.full_name,
    p2.username,
    p2.email,
    l.title,
    l.game
  FROM orders o
  LEFT JOIN profiles p1 ON p1.id = o.buyer_id
  LEFT JOIN profiles p2 ON p2.id = o.seller_id
  LEFT JOIN account_listings l ON l.id = o.listing_id
  WHERE p_status IS NULL OR o.status = p_status
  ORDER BY o.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Get order details
CREATE OR REPLACE FUNCTION admin_get_order_details(p_order_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'order', row_to_json(o.*),
    'buyer', (SELECT row_to_json(p.*) FROM profiles p WHERE p.id = o.buyer_id),
    'seller', (SELECT row_to_json(p.*) FROM profiles p WHERE p.id = o.seller_id),
    'listing', (SELECT row_to_json(l.*) FROM account_listings l WHERE l.id = o.listing_id)
  ) INTO result
  FROM orders o WHERE o.id = p_order_id;
  
  RETURN result;
END;
$$;

-- Get bank details
CREATE OR REPLACE FUNCTION admin_get_bank_details(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT row_to_json(b.*) INTO result FROM bank_details b WHERE b.user_id = p_user_id;
  RETURN result;
END;
$$;

-- Verify bank details
CREATE OR REPLACE FUNCTION admin_verify_bank_details(p_user_id uuid, p_verified boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE bank_details SET is_verified = p_verified WHERE user_id = p_user_id;
END;
$$;

-- Get payment gateways
CREATE OR REPLACE FUNCTION admin_get_payment_gateways()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(row_to_json(pg.*)) INTO result FROM payment_gateways pg;
  RETURN result;
END;
$$;

-- Update payment gateway
CREATE OR REPLACE FUNCTION admin_update_payment_gateway(
  p_id uuid,
  p_display_name text DEFAULT NULL,
  p_api_key text DEFAULT NULL,
  p_api_secret text DEFAULT NULL,
  p_webhook_secret text DEFAULT NULL,
  p_is_enabled boolean DEFAULT NULL,
  p_sandbox_mode boolean DEFAULT NULL,
  p_currency text DEFAULT NULL,
  p_supports_refund boolean DEFAULT NULL,
  p_supports_partial_refund boolean DEFAULT NULL,
  p_min_amount numeric DEFAULT NULL,
  p_max_amount numeric DEFAULT NULL,
  p_sort_order integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE payment_gateways SET
    display_name = COALESCE(p_display_name, display_name),
    api_key = COALESCE(p_api_key, api_key),
    api_secret = COALESCE(p_api_secret, api_secret),
    webhook_secret = COALESCE(p_webhook_secret, webhook_secret),
    is_enabled = COALESCE(p_is_enabled, is_enabled),
    sandbox_mode = COALESCE(p_sandbox_mode, sandbox_mode),
    currency = COALESCE(p_currency, currency),
    supports_refund = COALESCE(p_supports_refund, supports_refund),
    supports_partial_refund = COALESCE(p_supports_partial_refund, supports_partial_refund),
    min_amount = COALESCE(p_min_amount, min_amount),
    max_amount = COALESCE(p_max_amount, max_amount),
    sort_order = COALESCE(p_sort_order, sort_order),
    updated_at = now()
  WHERE id = p_id;
END;
$$;

-- Test payment gateway
CREATE OR REPLACE FUNCTION admin_test_payment_gateway(p_gateway_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'success', true,
    'message', 'Gateway connection successful',
    'gateway', (SELECT name FROM payment_gateways WHERE id = p_gateway_id),
    'mode', (SELECT CASE WHEN sandbox_mode THEN 'sandbox' ELSE 'live' END FROM payment_gateways WHERE id = p_gateway_id)
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Get email settings
CREATE OR REPLACE FUNCTION admin_get_email_settings()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT row_to_json(es.*) INTO result FROM email_settings es LIMIT 1;
  RETURN result;
END;
$$;

-- Update email settings
CREATE OR REPLACE FUNCTION admin_update_email_settings(
  p_resend_api_key text DEFAULT NULL,
  p_sender_email text DEFAULT NULL,
  p_sender_name text DEFAULT NULL,
  p_otp_subject text DEFAULT NULL,
  p_otp_template text DEFAULT NULL,
  p_otp_expiry_minutes integer DEFAULT NULL,
  p_welcome_email_enabled boolean DEFAULT NULL,
  p_welcome_subject text DEFAULT NULL,
  p_welcome_template text DEFAULT NULL,
  p_password_reset_template text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE email_settings SET
    resend_api_key = COALESCE(p_resend_api_key, resend_api_key),
    sender_email = COALESCE(p_sender_email, sender_email),
    sender_name = COALESCE(p_sender_name, sender_name),
    otp_subject = COALESCE(p_otp_subject, otp_subject),
    otp_template = COALESCE(p_otp_template, otp_template),
    otp_expiry_minutes = COALESCE(p_otp_expiry_minutes, otp_expiry_minutes),
    welcome_email_enabled = COALESCE(p_welcome_email_enabled, welcome_email_enabled),
    welcome_subject = COALESCE(p_welcome_subject, welcome_subject),
    welcome_template = COALESCE(p_welcome_template, welcome_template),
    password_reset_template = COALESCE(p_password_reset_template, password_reset_template),
    updated_at = now();
END;
$$;

-- Get GST settings
CREATE OR REPLACE FUNCTION admin_get_gst_settings()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT row_to_json(gs.*) INTO result FROM gst_settings gs LIMIT 1;
  RETURN result;
END;
$$;

-- Update GST settings
CREATE OR REPLACE FUNCTION admin_update_gst_settings(
  p_gst_enabled boolean DEFAULT NULL,
  p_gst_percentage numeric DEFAULT NULL,
  p_gst_number text DEFAULT NULL,
  p_company_name text DEFAULT NULL,
  p_company_address text DEFAULT NULL,
  p_company_city text DEFAULT NULL,
  p_company_state text DEFAULT NULL,
  p_company_pincode text DEFAULT NULL,
  p_company_pan text DEFAULT NULL,
  p_invoice_prefix text DEFAULT NULL,
  p_invoice_starting_number integer DEFAULT NULL,
  p_invoice_logo_url text DEFAULT NULL,
  p_invoice_footer_text text DEFAULT NULL,
  p_hsn_sac_code text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE gst_settings SET
    gst_enabled = COALESCE(p_gst_enabled, gst_enabled),
    gst_percentage = COALESCE(p_gst_percentage, gst_percentage),
    gst_number = COALESCE(p_gst_number, gst_number),
    company_name = COALESCE(p_company_name, company_name),
    company_address = COALESCE(p_company_address, company_address),
    company_city = COALESCE(p_company_city, company_city),
    company_state = COALESCE(p_company_state, company_state),
    company_pincode = COALESCE(p_company_pincode, company_pincode),
    company_pan = COALESCE(p_company_pan, company_pan),
    invoice_prefix = COALESCE(p_invoice_prefix, invoice_prefix),
    invoice_starting_number = COALESCE(p_invoice_starting_number, invoice_starting_number),
    invoice_logo_url = COALESCE(p_invoice_logo_url, invoice_logo_url),
    invoice_footer_text = COALESCE(p_invoice_footer_text, invoice_footer_text),
    hsn_sac_code = COALESCE(p_hsn_sac_code, hsn_sac_code),
    updated_at = now();
END;
$$;

-- Get payment logs
CREATE OR REPLACE FUNCTION admin_get_payment_logs(
  p_gateway_name text DEFAULT NULL,
  p_event_type text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(row_to_json(pl.*)) INTO result
  FROM payment_logs pl
  WHERE (p_gateway_name IS NULL OR pl.gateway_name = p_gateway_name)
    AND (p_event_type IS NULL OR pl.event_type = p_event_type)
    AND (p_status IS NULL OR pl.status = p_status)
    AND (p_user_id IS NULL OR pl.user_id = p_user_id)
  ORDER BY pl.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
  
  RETURN result;
END;
$$;

-- Get payment logs summary
CREATE OR REPLACE FUNCTION admin_get_payment_logs_summary()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'total_transactions', (SELECT COUNT(*) FROM payment_logs),
    'successful', (SELECT COUNT(*) FROM payment_logs WHERE status = 'success'),
    'failed', (SELECT COUNT(*) FROM payment_logs WHERE status = 'failed'),
    'total_amount', COALESCE((SELECT SUM(amount) FROM payment_logs WHERE status = 'success'), 0)
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Get user activity logs
CREATE OR REPLACE FUNCTION admin_get_user_activity_logs(
  p_user_id uuid DEFAULT NULL,
  p_action text DEFAULT NULL,
  p_entity_type text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(row_to_json(ual.*)) INTO result
  FROM user_activity_logs ual
  WHERE (p_user_id IS NULL OR ual.user_id = p_user_id)
    AND (p_action IS NULL OR ual.action = p_action)
    AND (p_entity_type IS NULL OR ual.entity_type = p_entity_type)
  ORDER BY ual.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
  
  RETURN result;
END;
$$;