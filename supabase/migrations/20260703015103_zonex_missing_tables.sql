-- ============================================================
-- MISSING TABLES FOR FUNCTIONS
-- ============================================================

-- Admin notifications table
CREATE TABLE IF NOT EXISTS admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  target_audience text NOT NULL DEFAULT 'all',
  is_active boolean NOT NULL DEFAULT true,
  admin_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Legal documents table
CREATE TABLE IF NOT EXISTS legal_documents (
  doc_type text PRIMARY KEY,
  title text NOT NULL,
  content text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Support settings table
CREATE TABLE IF NOT EXISTS support_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() UNIQUE,
  whatsapp_number text DEFAULT '',
  telegram_username text DEFAULT '',
  support_email text DEFAULT '',
  business_hours text DEFAULT '',
  auto_reply text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- FAQ entries table
CREATE TABLE IF NOT EXISTS faq_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Payment gateways table
CREATE TABLE IF NOT EXISTS payment_gateways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  api_key text DEFAULT '',
  api_secret text DEFAULT '',
  webhook_secret text DEFAULT '',
  is_enabled boolean NOT NULL DEFAULT false,
  sandbox_mode boolean NOT NULL DEFAULT true,
  currency text NOT NULL DEFAULT 'INR',
  supports_refund boolean NOT NULL DEFAULT false,
  supports_partial_refund boolean NOT NULL DEFAULT false,
  min_amount numeric DEFAULT 0,
  max_amount numeric DEFAULT 500000,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Email settings table
CREATE TABLE IF NOT EXISTS email_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() UNIQUE,
  resend_api_key text DEFAULT '',
  sender_email text DEFAULT '',
  sender_name text DEFAULT 'Kryzo',
  otp_subject text DEFAULT 'Your OTP Code',
  otp_template text DEFAULT '',
  otp_expiry_minutes integer DEFAULT 10,
  welcome_email_enabled boolean DEFAULT true,
  welcome_subject text DEFAULT 'Welcome to Kryzo!',
  welcome_template text DEFAULT '',
  password_reset_template text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- GST settings table
CREATE TABLE IF NOT EXISTS gst_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() UNIQUE,
  gst_enabled boolean NOT NULL DEFAULT false,
  gst_percentage numeric NOT NULL DEFAULT 18,
  gst_number text DEFAULT '',
  company_name text DEFAULT '',
  company_address text DEFAULT '',
  company_city text DEFAULT '',
  company_state text DEFAULT '',
  company_pincode text DEFAULT '',
  company_pan text DEFAULT '',
  invoice_prefix text DEFAULT 'INV',
  invoice_starting_number integer DEFAULT 1001,
  invoice_logo_url text DEFAULT '',
  invoice_footer_text text DEFAULT '',
  hsn_sac_code text DEFAULT '9984',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Payment logs table
CREATE TABLE IF NOT EXISTS payment_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway_name text NOT NULL,
  event_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  amount numeric DEFAULT 0,
  currency text DEFAULT 'INR',
  user_id uuid,
  order_id text,
  payment_id text,
  metadata jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- User activity logs table
CREATE TABLE IF NOT EXISTS user_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  ip_address text,
  user_agent text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Bank details table
CREATE TABLE IF NOT EXISTS bank_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id),
  account_holder_name text NOT NULL,
  account_number text NOT NULL,
  ifsc_code text NOT NULL,
  bank_name text NOT NULL,
  branch_name text,
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Login logs table
CREATE TABLE IF NOT EXISTS login_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  ip_address text,
  user_agent text,
  success boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Backup logs table
CREATE TABLE IF NOT EXISTS backup_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  file_name text,
  file_size_bytes integer,
  triggered_by uuid REFERENCES auth.users(id),
  triggered_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Fraud flags table
CREATE TABLE IF NOT EXISTS fraud_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  type text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  description text,
  auto_detected boolean NOT NULL DEFAULT false,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE faq_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_gateways ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE gst_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_flags ENABLE ROW LEVEL SECURITY;

-- RLS Policies for admin tables (admin only access)
CREATE POLICY "admin_only_admin_notifications" ON admin_notifications FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

CREATE POLICY "admin_only_legal_documents" ON legal_documents FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

CREATE POLICY "admin_only_support_settings" ON support_settings FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

CREATE POLICY "admin_only_faq_entries" ON faq_entries FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- Allow users to read published FAQs
CREATE POLICY "read_published_faqs" ON faq_entries FOR SELECT
  TO authenticated USING (is_published = true);

CREATE POLICY "admin_only_payment_gateways" ON payment_gateways FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

CREATE POLICY "admin_only_email_settings" ON email_settings FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

CREATE POLICY "admin_only_gst_settings" ON gst_settings FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

CREATE POLICY "admin_only_payment_logs" ON payment_logs FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

CREATE POLICY "admin_only_user_activity_logs" ON user_activity_logs FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

CREATE POLICY "user_own_bank_details" ON bank_details FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "admin_all_bank_details" ON bank_details FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

CREATE POLICY "admin_only_login_logs" ON login_logs FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

CREATE POLICY "admin_only_backup_logs" ON backup_logs FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

CREATE POLICY "admin_only_fraud_flags" ON fraud_flags FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- Insert default payment gateways
INSERT INTO payment_gateways (name, display_name, is_enabled, sandbox_mode) VALUES
  ('razorpay', 'Razorpay', true, true),
  ('cashfree', 'Cashfree', false, true)
ON CONFLICT (name) DO NOTHING;

-- Insert default support settings
INSERT INTO support_settings (whatsapp_number, telegram_username, support_email, business_hours, auto_reply)
VALUES ('', '', '', '', '')
ON CONFLICT ON CONSTRAINT support_settings_pkey DO NOTHING;

-- Insert default email settings
INSERT INTO email_settings DEFAULT VALUES
ON CONFLICT ON CONSTRAINT email_settings_pkey DO NOTHING;

-- Insert default GST settings
INSERT INTO gst_settings DEFAULT VALUES
ON CONFLICT ON CONSTRAINT gst_settings_pkey DO NOTHING;

-- Insert default legal documents
INSERT INTO legal_documents (doc_type, title, content) VALUES
  ('terms', 'Terms and Conditions', 'Your terms and conditions go here.'),
  ('privacy', 'Privacy Policy', 'Your privacy policy goes here.')
ON CONFLICT (doc_type) DO NOTHING;

-- Add missing columns to profiles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_banned') THEN
    ALTER TABLE profiles ADD COLUMN is_banned boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_suspended') THEN
    ALTER TABLE profiles ADD COLUMN is_suspended boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'banned_reason') THEN
    ALTER TABLE profiles ADD COLUMN banned_reason text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'suspended_reason') THEN
    ALTER TABLE profiles ADD COLUMN suspended_reason text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'deleted_at') THEN
    ALTER TABLE profiles ADD COLUMN deleted_at timestamptz;
  END IF;
END $$;