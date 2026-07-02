-- Coupons table for discount codes
CREATE TABLE IF NOT EXISTS coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  discount_type text NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value numeric NOT NULL DEFAULT 0,
  min_order_amount numeric NOT NULL DEFAULT 0,
  max_discount numeric NOT NULL DEFAULT 0,
  usage_limit integer NOT NULL DEFAULT 100,
  used_count integer NOT NULL DEFAULT 0,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Reports table for user/listing reports
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reported_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reported_listing_id uuid REFERENCES account_listings(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'other' CHECK (type IN ('scam', 'fake_listing', 'harassment', 'spam', 'other')),
  reason text NOT NULL,
  evidence_urls text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'investigating', 'resolved', 'dismissed')),
  resolution_notes text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Coupon policies (admin only can manage, users can read active coupons)
CREATE POLICY "coupons_read_active" ON coupons FOR SELECT
  TO authenticated USING (is_active = true AND valid_until > now());

CREATE POLICY "coupons_admin_all" ON coupons FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- Report policies
CREATE POLICY "reports_user_create" ON reports FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "reports_user_own" ON reports FOR SELECT
  TO authenticated USING (auth.uid() = reporter_id);

CREATE POLICY "reports_admin_all" ON reports FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(is_active, valid_until);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(type);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_reported_user ON reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_reports_reported_listing ON reports(reported_listing_id);

-- Trigger for updated_at (if function doesn't exist)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_coupons_updated_at ON coupons;
CREATE TRIGGER update_coupons_updated_at
  BEFORE UPDATE ON coupons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_reports_updated_at ON reports;
CREATE TRIGGER update_reports_updated_at
  BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();