/*
# Zonex Step 5 — Anti-Fraud Detection
*/

-- ============================================================
-- FRAUD_FLAGS table
-- ============================================================
CREATE TABLE IF NOT EXISTS fraud_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES app_users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('spam_account', 'fake_listing', 'repeated_failed_payments', 'suspicious_login', 'fake_kyc', 'multiple_accounts')),
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description text,
  auto_detected boolean NOT NULL DEFAULT true,
  resolved boolean NOT NULL DEFAULT false,
  resolved_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE fraud_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_fraud_flags" ON fraud_flags;
CREATE POLICY "select_fraud_flags" ON fraud_flags FOR SELECT
  TO anon, authenticated USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_fraud_user ON fraud_flags(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_unresolved ON fraud_flags(resolved, created_at DESC);

-- ============================================================
-- HELPER: flag_fraud — create a fraud flag
-- ============================================================
CREATE OR REPLACE FUNCTION public.flag_fraud(
  p_user_id uuid, p_type text, p_severity text DEFAULT 'medium', p_description text DEFAULT NULL, p_metadata jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_result_id uuid;
BEGIN
  INSERT INTO fraud_flags (user_id, type, severity, description, metadata)
  VALUES (p_user_id, p_type, p_severity, p_description, p_metadata)
  RETURNING id INTO v_result_id;
  RETURN v_result_id;
END;
$$;

-- ============================================================
-- HELPER: resolve_fraud_flag — resolve a fraud flag (admin only)
-- ============================================================
CREATE OR REPLACE FUNCTION public.resolve_fraud_flag(p_flag_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_admin_id uuid;
BEGIN
  v_admin_id := public.get_current_user_id();
  IF v_admin_id IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;
  UPDATE fraud_flags SET resolved = true, resolved_by = v_admin_id, resolved_at = now() WHERE id = p_flag_id;
  PERFORM public.log_admin_action('resolve_fraud_flag', 'fraud_flag', p_flag_id::text, NULL);
END;
$$;

-- ============================================================
-- HELPER: detect_suspicious_login — flag suspicious login patterns
-- ============================================================
CREATE OR REPLACE FUNCTION public.detect_suspicious_login(p_user_id uuid, p_ip_address text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recent_logins int;
  v_distinct_ips int;
  v_existing_flag uuid;
BEGIN
  -- Check for multiple logins from different IPs in short time
  SELECT COUNT(DISTINCT ip_address) INTO v_distinct_ips
  FROM login_history
  WHERE user_id = p_user_id
    AND login_at > now() - interval '1 hour'
    AND device_info = 'SUCCESS'
    AND ip_address IS NOT NULL;

  IF v_distinct_ips >= 3 THEN
    SELECT id INTO v_existing_flag FROM fraud_flags
    WHERE user_id = p_user_id AND type = 'suspicious_login' AND resolved = false
    ORDER BY created_at DESC LIMIT 1;

    IF v_existing_flag IS NULL THEN
      PERFORM public.flag_fraud(p_user_id, 'suspicious_login', 'high',
        'Multiple login attempts from ' || v_distinct_ips || ' different IPs within 1 hour',
        jsonb_build_object('ip_count', v_distinct_ips, 'ip', p_ip_address));
    END IF;
  END IF;

  -- Check for rapid repeated logins (possible session hijacking)
  SELECT COUNT(*) INTO v_recent_logins
  FROM login_history
  WHERE user_id = p_user_id
    AND login_at > now() - interval '5 minutes'
    AND device_info = 'SUCCESS';

  IF v_recent_logins >= 10 THEN
    SELECT id INTO v_existing_flag FROM fraud_flags
    WHERE user_id = p_user_id AND type = 'suspicious_login' AND resolved = false
    ORDER BY created_at DESC LIMIT 1;

    IF v_existing_flag IS NULL THEN
      PERFORM public.flag_fraud(p_user_id, 'suspicious_login', 'medium',
        'Rapid repeated logins: ' || v_recent_logins || ' in 5 minutes',
        jsonb_build_object('login_count', v_recent_logins));
    END IF;
  END IF;
END;
$$;

-- ============================================================
-- HELPER: detect_multiple_accounts — flag users with same IP
-- ============================================================
CREATE OR REPLACE FUNCTION public.detect_multiple_accounts(p_user_id uuid, p_ip_address text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_same_ip_users int;
  v_existing_flag uuid;
BEGIN
  IF p_ip_address IS NULL OR p_ip_address = 'unknown' THEN RETURN; END IF;

  -- Check if this IP has been used by multiple different users
  SELECT COUNT(DISTINCT lh.user_id) INTO v_same_ip_users
  FROM login_history lh
  WHERE lh.ip_address = p_ip_address
    AND lh.device_info = 'SUCCESS'
    AND lh.user_id != p_user_id
    AND lh.login_at > now() - interval '24 hours';

  IF v_same_ip_users >= 3 THEN
    SELECT id INTO v_existing_flag FROM fraud_flags
    WHERE user_id = p_user_id AND type = 'multiple_accounts' AND resolved = false
    ORDER BY created_at DESC LIMIT 1;

    IF v_existing_flag IS NULL THEN
      PERFORM public.flag_fraud(p_user_id, 'multiple_accounts', 'medium',
        'Same IP address used by ' || v_same_ip_users || ' other accounts',
        jsonb_build_object('ip', p_ip_address, 'other_users', v_same_ip_users));
    END IF;
  END IF;
END;
$$;

-- ============================================================
-- HELPER: detect_repeated_failed_payments — flag users with multiple failed payments
-- ============================================================
CREATE OR REPLACE FUNCTION public.detect_repeated_failed_payments(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_failed_count int;
  v_existing_flag uuid;
BEGIN
  SELECT COUNT(*) INTO v_failed_count
  FROM wallet_transactions
  WHERE user_id = p_user_id
    AND status = 'failed'
    AND created_at > now() - interval '24 hours';

  IF v_failed_count >= 3 THEN
    SELECT id INTO v_existing_flag FROM fraud_flags
    WHERE user_id = p_user_id AND type = 'repeated_failed_payments' AND resolved = false
    ORDER BY created_at DESC LIMIT 1;

    IF v_existing_flag IS NULL THEN
      PERFORM public.flag_fraud(p_user_id, 'repeated_failed_payments', 'high',
        'Multiple failed payment attempts: ' || v_failed_count || ' in 24 hours',
        jsonb_build_object('failed_count', v_failed_count));
    END IF;
  END IF;
END;
$$;

-- ============================================================
-- HELPER: detect_fake_kyc — flag suspicious KYC submissions
-- ============================================================
CREATE OR REPLACE FUNCTION public.detect_fake_kyc(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rejected_count int;
  v_existing_flag uuid;
BEGIN
  SELECT COUNT(*) INTO v_rejected_count
  FROM kyc_requests
  WHERE user_id = p_user_id
    AND status = 'rejected';

  IF v_rejected_count >= 2 THEN
    SELECT id INTO v_existing_flag FROM fraud_flags
    WHERE user_id = p_user_id AND type = 'fake_kyc' AND resolved = false
    ORDER BY created_at DESC LIMIT 1;

    IF v_existing_flag IS NULL THEN
      PERFORM public.flag_fraud(p_user_id, 'fake_kyc', 'high',
        'Multiple rejected KYC submissions: ' || v_rejected_count,
        jsonb_build_object('rejected_count', v_rejected_count));
    END IF;
  END IF;
END;
$$;

-- ============================================================
-- Grant execute
-- ============================================================
GRANT EXECUTE ON FUNCTION public.flag_fraud TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_fraud_flag TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.detect_suspicious_login TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.detect_multiple_accounts TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.detect_repeated_failed_payments TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.detect_fake_kyc TO anon, authenticated;
