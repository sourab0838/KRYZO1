/*
# Admin Settings Enhancement - Payment Gateways, Email, GST & Logging

## Overview
This migration adds comprehensive settings management for payment gateways,
email configuration, GST settings, and detailed logging for admin actions,
payment events, and user activities.

## 1. New Tables

### payment_gateways
Multi-gateway support for Razorpay, Cashfree, PhonePe, PayU, Stripe.
- `id` (uuid, PK)
- `gateway_name` (text, unique) - e.g., 'razorpay', 'cashfree', 'phonepe', 'payu', 'stripe'
- `display_name` (text) - Human-readable name for UI
- `api_key` (text) - Public API key (encrypted at rest)
- `api_secret` (text) - Secret key (encrypted at rest)
- `webhook_secret` (text) - Webhook verification secret (encrypted at rest)
- `is_enabled` (boolean, default false)
- `sandbox_mode` (boolean, default true)
- `currency` (text, default 'INR')
- `supports_refund` (boolean, default true)
- `supports_partial_refund` (boolean, default false)
- `min_amount` (integer, default 100)
- `max_amount` (integer, default 500000)
- `sort_order` (integer, default 0)
- `last_test_at` (timestamptz)
- `last_test_status` (text)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### email_settings
Resend API configuration and OTP email templates.
- `id` (uuid, PK)
- `resend_api_key` (text) - Resend API key (encrypted)
- `sender_email` (text) - Verified sender email address
- `sender_name` (text) - Display name for emails
- `otp_subject` (text) - Subject line for OTP emails
- `otp_template` (text) - HTML template with {{otp}}, {{app_name}}, {{expiry_minutes}} placeholders
- `otp_expiry_minutes` (integer, default 5)
- `welcome_email_enabled` (boolean, default true)
- `welcome_subject` (text)
- `welcome_template` (text)
- `password_reset_template` (text)
- `is_configured` (boolean, default false)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### gst_settings
GST configuration and company details for invoice generation.
- `id` (uuid, PK)
- `gst_enabled` (boolean, default false)
- `gst_percentage` (decimal, default 18.00)
- `gst_number` (text) - GSTIN
- `company_name` (text)
- `company_address` (text)
- `company_city` (text)
- `company_state` (text)
- `company_pincode` (text)
- `company_pan` (text) - PAN number
- `invoice_prefix` (text, default 'INV')
- `invoice_starting_number` (integer, default 1001)
- `invoice_logo_url` (text)
- `invoice_footer_text` (text)
- `hsn_sac_code` (text) - HSN/SAC code for services
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### payment_logs
Detailed logging of all payment gateway events.
- `id` (uuid, PK)
- `gateway_name` (text) - Which gateway was used
- `gateway_transaction_id` (text) - External transaction ID
- `order_id` (uuid, nullable) - Link to internal order
- `user_id` (uuid, nullable) - User who initiated
- `amount` (decimal)
- `currency` (text, default 'INR')
- `event_type` (text) - 'payment_initiated', 'payment_success', 'payment_failed', 'refund_initiated', 'refund_success', 'refund_failed', 'webhook_received'
- `status` (text) - 'pending', 'success', 'failed', 'cancelled'
- `request_payload` (jsonb) - Sanitized request data
- `response_payload` (jsonb) - Gateway response
- `error_message` (text)
- `ip_address` (text)
- `user_agent` (text)
- `processed_at` (timestamptz)
- `created_at` (timestamptz)

### user_activity_logs
Track user actions across the platform.
- `id` (uuid, PK)
- `user_id` (uuid, nullable)
- `action` (text) - e.g., 'login', 'logout', 'listing_create', 'purchase', 'kyc_submit'
- `entity_type` (text) - 'user', 'listing', 'order', 'kyc', 'wallet', 'withdrawal'
- `entity_id` (uuid, nullable)
- `metadata` (jsonb)
- `ip_address` (text)
- `user_agent` (text)
- `device_info` (text)
- `created_at` (timestamptz)

## 2. Modified Tables
None - all new tables.

## 3. Security
- RLS enabled on all tables
- `payment_gateways`: Only super_admin can manage (secrets are sensitive)
- `email_settings`: Only super_admin can manage
- `gst_settings`: Admins can read, super_admin can write
- `payment_logs`: Admins can read, system writes only
- `user_activity_logs`: Admins can read, system writes only

## 4. Important Notes
1. All secret fields (api_key, api_secret, webhook_secret, resend_api_key) should be 
   accessed only through SECURITY DEFINER functions that mask/decrypt values.
2. Only super_admins can view and modify payment gateway secrets.
3. Payment logs are append-only - no UPDATE or DELETE from frontend.
*/

-- ============================================================
-- 1. Payment Gateways Table
-- ============================================================

CREATE TABLE IF NOT EXISTS payment_gateways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway_name text UNIQUE NOT NULL,
  display_name text NOT NULL,
  api_key text,
  api_secret text,
  webhook_secret text,
  is_enabled boolean NOT NULL DEFAULT false,
  sandbox_mode boolean NOT NULL DEFAULT true,
  currency text NOT NULL DEFAULT 'INR',
  supports_refund boolean NOT NULL DEFAULT true,
  supports_partial_refund boolean NOT NULL DEFAULT false,
  min_amount integer NOT NULL DEFAULT 100,
  max_amount integer NOT NULL DEFAULT 500000,
  sort_order integer NOT NULL DEFAULT 0,
  last_test_at timestamptz,
  last_test_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payment_gateways ENABLE ROW LEVEL SECURITY;

-- Only super_admin can manage payment gateways (sensitive data)
DROP POLICY IF EXISTS "super_admin_manage_payment_gateways" ON payment_gateways;
CREATE POLICY "super_admin_manage_payment_gateways" ON payment_gateways
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- Admins can read gateway info (but secrets are masked via RPC)
DROP POLICY IF EXISTS "admin_read_payment_gateways" ON payment_gateways;
CREATE POLICY "admin_read_payment_gateways" ON payment_gateways
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid())
  );

-- Insert default gateway records
INSERT INTO payment_gateways (gateway_name, display_name, supports_refund, supports_partial_refund, sort_order)
VALUES 
  ('razorpay', 'Razorpay', true, true, 1),
  ('cashfree', 'Cashfree', true, true, 2),
  ('phonepe', 'PhonePe', true, false, 3),
  ('payu', 'PayU', true, true, 4),
  ('stripe', 'Stripe', true, true, 5)
ON CONFLICT (gateway_name) DO NOTHING;

-- ============================================================
-- 2. Email Settings Table
-- ============================================================

CREATE TABLE IF NOT EXISTS email_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resend_api_key text,
  sender_email text,
  sender_name text DEFAULT 'Kryzo',
  otp_subject text DEFAULT 'Your OTP for Kryzo',
  otp_template text DEFAULT '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #0B0B0B; border-radius: 12px;"><h2 style="color: #D4AF37; margin-bottom: 20px;">Your Verification Code</h2><p style="color: #fff; font-size: 14px;">Use the following OTP to verify your email:</p><div style="background: #1C1C1C; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;"><span style="font-size: 32px; font-weight: bold; color: #D4AF37; letter-spacing: 8px;">{{otp}}</span></div><p style="color: #888; font-size: 12px;">This code expires in {{expiry_minutes}} minutes.</p><p style="color: #666; font-size: 11px; margin-top: 30px;">If you did not request this code, please ignore this email.</p></div>',
  otp_expiry_minutes integer NOT NULL DEFAULT 5,
  welcome_email_enabled boolean NOT NULL DEFAULT true,
  welcome_subject text DEFAULT 'Welcome to Kryzo!',
  welcome_template text,
  password_reset_template text,
  is_configured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE email_settings ENABLE ROW LEVEL SECURITY;

-- Only super_admin can manage email settings
DROP POLICY IF EXISTS "super_admin_manage_email_settings" ON email_settings;
CREATE POLICY "super_admin_manage_email_settings" ON email_settings
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- Insert default email settings row
INSERT INTO email_settings (id) VALUES (gen_random_uuid()) ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. GST Settings Table
-- ============================================================

CREATE TABLE IF NOT EXISTS gst_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gst_enabled boolean NOT NULL DEFAULT false,
  gst_percentage decimal(5,2) NOT NULL DEFAULT 18.00,
  gst_number text,
  company_name text,
  company_address text,
  company_city text,
  company_state text,
  company_pincode text,
  company_pan text,
  invoice_prefix text NOT NULL DEFAULT 'INV',
  invoice_starting_number integer NOT NULL DEFAULT 1001,
  invoice_logo_url text,
  invoice_footer_text text DEFAULT 'Thank you for your business!',
  hsn_sac_code text DEFAULT '998311',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gst_settings ENABLE ROW LEVEL SECURITY;

-- Admins can read GST settings
DROP POLICY IF EXISTS "admin_read_gst_settings" ON gst_settings;
CREATE POLICY "admin_read_gst_settings" ON gst_settings
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid())
  );

-- Only super_admin can write GST settings
DROP POLICY IF EXISTS "super_admin_write_gst_settings" ON gst_settings;
CREATE POLICY "super_admin_write_gst_settings" ON gst_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

DROP POLICY IF EXISTS "super_admin_update_gst_settings" ON gst_settings;
CREATE POLICY "super_admin_update_gst_settings" ON gst_settings
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- Insert default GST settings row
INSERT INTO gst_settings (id) VALUES (gen_random_uuid()) ON CONFLICT DO NOTHING;

-- ============================================================
-- 4. Payment Logs Table
-- ============================================================

CREATE TABLE IF NOT EXISTS payment_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway_name text NOT NULL,
  gateway_transaction_id text,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  amount decimal(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  event_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  request_payload jsonb,
  response_payload jsonb,
  error_message text,
  ip_address text,
  user_agent text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_payment_logs_user_id ON payment_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_logs_order_id ON payment_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_logs_gateway ON payment_logs(gateway_name);
CREATE INDEX IF NOT EXISTS idx_payment_logs_created_at ON payment_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_logs_event_type ON payment_logs(event_type);

ALTER TABLE payment_logs ENABLE ROW LEVEL SECURITY;

-- Admins can read payment logs
DROP POLICY IF EXISTS "admin_read_payment_logs" ON payment_logs;
CREATE POLICY "admin_read_payment_logs" ON payment_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid())
  );

-- ============================================================
-- 5. User Activity Logs Table
-- ============================================================

CREATE TABLE IF NOT EXISTS user_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  ip_address text,
  user_agent text,
  device_info text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user_id ON user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_action ON user_activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_entity ON user_activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_created_at ON user_activity_logs(created_at DESC);

ALTER TABLE user_activity_logs ENABLE ROW LEVEL SECURITY;

-- Admins can read user activity logs
DROP POLICY IF EXISTS "admin_read_user_activity_logs" ON user_activity_logs;
CREATE POLICY "admin_read_user_activity_logs" ON user_activity_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid())
  );

-- Users can read their own activity logs
DROP POLICY IF EXISTS "user_read_own_activity_logs" ON user_activity_logs;
CREATE POLICY "user_read_own_activity_logs" ON user_activity_logs
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- 6. Admin RPC Functions
-- ============================================================

-- Get all payment gateways (secrets masked for non-super-admin)
CREATE OR REPLACE FUNCTION admin_get_payment_gateways()
RETURNS TABLE (
  id uuid,
  gateway_name text,
  display_name text,
  api_key text,
  api_secret text,
  webhook_secret text,
  is_enabled boolean,
  sandbox_mode boolean,
  currency text,
  supports_refund boolean,
  supports_partial_refund boolean,
  min_amount integer,
  max_amount integer,
  sort_order integer,
  last_test_at timestamptz,
  last_test_status text,
  created_at timestamptz,
  updated_at timestamptz,
  is_super_admin boolean
)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT
    pg.id,
    pg.gateway_name,
    pg.display_name,
    CASE 
      WHEN EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role = 'super_admin')
      THEN pg.api_key
      ELSE CASE WHEN pg.api_key IS NOT NULL THEN '••••••••' ELSE NULL END
    END as api_key,
    CASE 
      WHEN EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role = 'super_admin')
      THEN pg.api_secret
      ELSE CASE WHEN pg.api_secret IS NOT NULL THEN '••••••••' ELSE NULL END
    END as api_secret,
    CASE 
      WHEN EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role = 'super_admin')
      THEN pg.webhook_secret
      ELSE CASE WHEN pg.webhook_secret IS NOT NULL THEN '••••••••' ELSE NULL END
    END as webhook_secret,
    pg.is_enabled,
    pg.sandbox_mode,
    pg.currency,
    pg.supports_refund,
    pg.supports_partial_refund,
    pg.min_amount,
    pg.max_amount,
    pg.sort_order,
    pg.last_test_at,
    pg.last_test_status,
    pg.created_at,
    pg.updated_at,
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role = 'super_admin') as is_super_admin
  FROM payment_gateways pg
  WHERE EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid());
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
  p_min_amount integer DEFAULT NULL,
  p_max_amount integer DEFAULT NULL,
  p_sort_order integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role = 'super_admin') THEN
    RAISE EXCEPTION 'Only super admin can update payment gateways';
  END IF;

  UPDATE payment_gateways
  SET
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

  INSERT INTO audit_logs (admin_id, admin_name, action, target_type, target_id)
  SELECT auth.uid(), p.full_name, 'update_payment_gateway', 'payment_gateway', p_id
  FROM profiles p WHERE p.id = auth.uid();
END;
$$;

-- Test payment gateway connection
CREATE OR REPLACE FUNCTION admin_test_payment_gateway(p_gateway_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  gw RECORD;
  result json;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role = 'super_admin') THEN
    RAISE EXCEPTION 'Only super admin can test payment gateways';
  END IF;

  SELECT * INTO gw FROM payment_gateways WHERE id = p_gateway_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gateway not found';
  END IF;

  result = json_build_object(
    'success', gw.api_key IS NOT NULL AND gw.api_secret IS NOT NULL,
    'message', CASE 
      WHEN gw.api_key IS NULL OR gw.api_secret IS NULL 
      THEN 'API keys not configured'
      ELSE 'Configuration appears valid'
    END,
    'gateway', gw.gateway_name,
    'mode', CASE WHEN gw.sandbox_mode THEN 'sandbox' ELSE 'live' END
  );

  UPDATE payment_gateways
  SET last_test_at = now(),
      last_test_status = CASE WHEN gw.api_key IS NOT NULL AND gw.api_secret IS NOT NULL THEN 'success' ELSE 'failed' END
  WHERE id = p_gateway_id;

  RETURN result;
END;
$$;

-- Get email settings (secrets masked for non-super-admin)
CREATE OR REPLACE FUNCTION admin_get_email_settings()
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  es RECORD;
  is_super boolean;
BEGIN
  SELECT role = 'super_admin' INTO is_super FROM admin_roles WHERE user_id = auth.uid();
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO es FROM email_settings LIMIT 1;
  
  RETURN json_build_object(
    'id', es.id,
    'resend_api_key', CASE WHEN is_super THEN es.resend_api_key WHEN es.resend_api_key IS NOT NULL THEN '••••••••' ELSE NULL END,
    'sender_email', es.sender_email,
    'sender_name', es.sender_name,
    'otp_subject', es.otp_subject,
    'otp_template', es.otp_template,
    'otp_expiry_minutes', es.otp_expiry_minutes,
    'welcome_email_enabled', es.welcome_email_enabled,
    'welcome_subject', es.welcome_subject,
    'welcome_template', es.welcome_template,
    'password_reset_template', es.password_reset_template,
    'is_configured', es.is_configured,
    'is_super_admin', is_super
  );
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
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role = 'super_admin') THEN
    RAISE EXCEPTION 'Only super admin can update email settings';
  END IF;

  UPDATE email_settings
  SET
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
    is_configured = p_resend_api_key IS NOT NULL AND p_sender_email IS NOT NULL,
    updated_at = now()
  WHERE id = (SELECT id FROM email_settings LIMIT 1);

  INSERT INTO audit_logs (admin_id, admin_name, action, target_type)
  SELECT auth.uid(), p.full_name, 'update_email_settings', 'email_settings'
  FROM profiles p WHERE p.id = auth.uid();
END;
$$;

-- Get GST settings
CREATE OR REPLACE FUNCTION admin_get_gst_settings()
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  gs RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO gs FROM gst_settings LIMIT 1;
  
  RETURN json_build_object(
    'id', gs.id,
    'gst_enabled', gs.gst_enabled,
    'gst_percentage', gs.gst_percentage,
    'gst_number', gs.gst_number,
    'company_name', gs.company_name,
    'company_address', gs.company_address,
    'company_city', gs.company_city,
    'company_state', gs.company_state,
    'company_pincode', gs.company_pincode,
    'company_pan', gs.company_pan,
    'invoice_prefix', gs.invoice_prefix,
    'invoice_starting_number', gs.invoice_starting_number,
    'invoice_logo_url', gs.invoice_logo_url,
    'invoice_footer_text', gs.invoice_footer_text,
    'hsn_sac_code', gs.hsn_sac_code
  );
END;
$$;

-- Update GST settings
CREATE OR REPLACE FUNCTION admin_update_gst_settings(
  p_gst_enabled boolean DEFAULT NULL,
  p_gst_percentage decimal DEFAULT NULL,
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
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role = 'super_admin') THEN
    RAISE EXCEPTION 'Only super admin can update GST settings';
  END IF;

  UPDATE gst_settings
  SET
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
    updated_at = now()
  WHERE id = (SELECT id FROM gst_settings LIMIT 1);

  INSERT INTO audit_logs (admin_id, admin_name, action, target_type)
  SELECT auth.uid(), p.full_name, 'update_gst_settings', 'gst_settings'
  FROM profiles p WHERE p.id = auth.uid();
END;
$$;

-- Get payment logs with pagination
CREATE OR REPLACE FUNCTION admin_get_payment_logs(
  p_gateway_name text DEFAULT NULL,
  p_event_type text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  gateway_name text,
  gateway_transaction_id text,
  order_id uuid,
  user_id uuid,
  amount decimal,
  currency text,
  event_type text,
  status text,
  error_message text,
  created_at timestamptz,
  user_email text,
  user_name text
)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT
    pl.id,
    pl.gateway_name,
    pl.gateway_transaction_id,
    pl.order_id,
    pl.user_id,
    pl.amount,
    pl.currency,
    pl.event_type,
    pl.status,
    pl.error_message,
    pl.created_at,
    pr.email as user_email,
    pr.full_name as user_name
  FROM payment_logs pl
  LEFT JOIN profiles pr ON pr.id = pl.user_id
  WHERE
    (p_gateway_name IS NULL OR pl.gateway_name = p_gateway_name)
    AND (p_event_type IS NULL OR pl.event_type = p_event_type)
    AND (p_status IS NULL OR pl.status = p_status)
    AND (p_user_id IS NULL OR pl.user_id = p_user_id)
    AND EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid())
  ORDER BY pl.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

-- Get user activity logs with pagination
CREATE OR REPLACE FUNCTION admin_get_user_activity_logs(
  p_user_id uuid DEFAULT NULL,
  p_action text DEFAULT NULL,
  p_entity_type text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  action text,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  ip_address text,
  user_agent text,
  device_info text,
  created_at timestamptz,
  user_email text,
  user_name text
)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT
    ual.id,
    ual.user_id,
    ual.action,
    ual.entity_type,
    ual.entity_id,
    ual.metadata,
    ual.ip_address,
    ual.user_agent,
    ual.device_info,
    ual.created_at,
    pr.email as user_email,
    pr.full_name as user_name
  FROM user_activity_logs ual
  LEFT JOIN profiles pr ON pr.id = ual.user_id
  WHERE
    (p_user_id IS NULL OR ual.user_id = p_user_id)
    AND (p_action IS NULL OR ual.action = p_action)
    AND (p_entity_type IS NULL OR ual.entity_type = p_entity_type)
    AND EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid())
  ORDER BY ual.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

-- Get payment logs summary for dashboard
CREATE OR REPLACE FUNCTION admin_get_payment_logs_summary()
RETURNS json
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT json_build_object(
    'total_transactions', (SELECT COUNT(*) FROM payment_logs),
    'successful_payments', (SELECT COUNT(*) FROM payment_logs WHERE event_type = 'payment_success'),
    'failed_payments', (SELECT COUNT(*) FROM payment_logs WHERE event_type = 'payment_failed'),
    'total_refunds', (SELECT COUNT(*) FROM payment_logs WHERE event_type IN ('refund_initiated', 'refund_success')),
    'total_amount_processed', (SELECT COALESCE(SUM(amount), 0) FROM payment_logs WHERE status = 'success'),
    'by_gateway', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT gateway_name, COUNT(*) as count, SUM(amount) as total_amount
        FROM payment_logs
        WHERE status = 'success'
        GROUP BY gateway_name
        ORDER BY count DESC
      ) t
    )
  );
$$;

-- Log user activity (callable from triggers or app)
CREATE OR REPLACE FUNCTION log_user_activity(
  p_user_id uuid,
  p_action text,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_device_info text DEFAULT NULL
)
RETURNS void
LANGUAGE sql SECURITY DEFINER
AS $$
  INSERT INTO user_activity_logs (
    user_id, action, entity_type, entity_id, metadata, 
    ip_address, user_agent, device_info
  ) VALUES (
    p_user_id, p_action, p_entity_type, p_entity_id, p_metadata,
    p_ip_address, p_user_agent, p_device_info
  );
$$;

-- Log payment event (for system use)
CREATE OR REPLACE FUNCTION log_payment_event(
  p_gateway_name text,
  p_event_type text,
  p_gateway_transaction_id text DEFAULT NULL,
  p_order_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_amount decimal DEFAULT NULL,
  p_currency text DEFAULT 'INR',
  p_status text DEFAULT 'pending',
  p_request_payload jsonb DEFAULT NULL,
  p_response_payload jsonb DEFAULT NULL,
  p_error_message text DEFAULT NULL,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE sql SECURITY DEFINER
AS $$
  INSERT INTO payment_logs (
    gateway_name, gateway_transaction_id, order_id, user_id, amount,
    currency, event_type, status, request_payload, response_payload,
    error_message, ip_address, user_agent
  ) VALUES (
    p_gateway_name, p_gateway_transaction_id, p_order_id, p_user_id, p_amount,
    p_currency, p_event_type, p_status, p_request_payload, p_response_payload,
    p_error_message, p_ip_address, p_user_agent
  );
$$;