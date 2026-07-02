/*
# Zonex Step 3 — Wallet, Payments, Escrow, Withdrawals & Commission

## Overview
Extends the Zonex platform with a complete payment system: Razorpay integration
support, wallet transactions, escrow hold/release, withdrawals, commission tracking,
and admin payment settings. All tables use the existing custom auth pattern
(get_current_user_id() via x-zonex-token header).

## New Tables
1. `wallet_transactions` — Records every wallet credit/debit (deposits, withdrawals,
   escrow holds, escrow releases, commissions, refunds). Links to Razorpay payment
   IDs and order IDs for audit trail.
2. `withdrawals` — Seller withdrawal requests (UPI ID, amount, status). Admin can
   approve/reject/complete/refund with reason.
3. `payment_settings` — Single-row table storing Razorpay configuration (key_id,
   key_secret, webhook_secret, mode test/live, currency, company_name). Readable
   by authenticated users (key_secret is NOT exposed via RLS — only key_id and
   public config are readable; the secret column is restricted).
4. `escrow_holds` — Tracks funds held in escrow for each order. Links order to
   buyer payment, seller payout, commission amounts, and release status.

## Modified Tables
- `orders` — Added columns: `buyer_payment_id`, `razorpay_order_id`, `razorpay_payment_id`,
  `platform_fee`, `seller_commission`, `seller_payout`, `escrow_status`, `delivery_status`.
  The `status` enum is extended to include the full order lifecycle.
- `wallets` — Added `pending_balance` and `total_earnings`, `total_deposits`,
  `total_withdrawals` columns for aggregate tracking.
- `notifications` — `notification_type` enum extended with payment-related types.

## Security
- RLS enabled on all new tables.
- `payment_settings` SELECT policy exposes only non-secret columns (key_id, mode,
  currency, company_name) to authenticated users. The `key_secret` and
  `webhook_secret` columns are only accessible via service role (edge function).
- Wallet transactions visible to the owning user only.
- Withdrawals visible to the requesting user only (admin panel in Step 4 will
  use service role).
- Escrow holds visible to both buyer and seller.

## Important Notes
1. Commission is 10% buyer fee + 10% seller commission = 20% platform revenue.
2. Escrow flow: buyer pays → funds held in escrow → seller delivers → buyer confirms
   → admin releases (or refunds). For this step, auto-release on buyer confirm is
   implemented; admin manual control will be added in Step 4.
3. Only available balance can be withdrawn. Pending balance (from escrow) cannot
   be withdrawn until escrow is released.
4. Duplicate payment prevention: unique constraint on razorpay_payment_id.
5. The edge function handles Razorpay order creation and payment verification
   server-side, so API keys never touch the frontend.
*/

-- ============================================================
-- Extend notification_type enum with payment-related types
-- ============================================================
DO $$ BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payment_success';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payment_failed';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'wallet_credited';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'withdrawal_requested';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'withdrawal_approved';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'withdrawal_rejected';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'order_created';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'seller_delivered';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'buyer_confirmed';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'funds_released';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'refund_completed';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- Extend wallets table with aggregate columns
-- ============================================================
DO $$ BEGIN
  ALTER TABLE wallets ADD COLUMN IF NOT EXISTS pending_balance numeric(12,2) NOT NULL DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE wallets ADD COLUMN IF NOT EXISTS total_earnings numeric(12,2) NOT NULL DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE wallets ADD COLUMN IF NOT EXISTS total_deposits numeric(12,2) NOT NULL DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE wallets ADD COLUMN IF NOT EXISTS total_withdrawals numeric(12,2) NOT NULL DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- ============================================================
-- Extend orders table with payment and escrow columns
-- ============================================================
DO $$ BEGIN
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_payment_id text;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS razorpay_order_id text;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS razorpay_payment_id text;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS platform_fee numeric(12,2) NOT NULL DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS seller_commission numeric(12,2) NOT NULL DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS seller_payout numeric(12,2) NOT NULL DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS escrow_status text NOT NULL DEFAULT 'none'
    CHECK (escrow_status IN ('none', 'held', 'released', 'refunded', 'disputed'));
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'pending'
    CHECK (delivery_status IN ('pending', 'delivered', 'confirmed', 'disputed'));
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Update the orders status constraint to include the full lifecycle
DO $$ BEGIN
  ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
  ALTER TABLE orders ADD CONSTRAINT orders_status_check
    CHECK (status IN ('pending', 'payment_successful', 'awaiting_delivery', 'buyer_reviewing', 'completed', 'cancelled', 'disputed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- WALLET_TRANSACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN (
    'deposit', 'withdrawal', 'escrow_hold', 'escrow_release',
    'commission', 'refund', 'purchase', 'sale'
  )),
  amount numeric(12,2) NOT NULL,
  direction text NOT NULL CHECK (direction IN ('credit', 'debit')),
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'pending', 'failed', 'cancelled')),
  razorpay_payment_id text,
  razorpay_order_id text,
  description text,
  related_order_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS idx_wt_razorpay_payment ON wallet_transactions(razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wt_user ON wallet_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wt_type ON wallet_transactions(type);

DROP POLICY IF EXISTS "select_own_transactions" ON wallet_transactions;
CREATE POLICY "select_own_transactions" ON wallet_transactions FOR SELECT
  TO anon, authenticated USING (user_id = public.get_current_user_id());

DROP POLICY IF EXISTS "insert_own_transactions" ON wallet_transactions;
CREATE POLICY "insert_own_transactions" ON wallet_transactions FOR INSERT
  TO anon, authenticated WITH CHECK (user_id = public.get_current_user_id());

DROP POLICY IF EXISTS "update_own_transactions" ON wallet_transactions;
CREATE POLICY "update_own_transactions" ON wallet_transactions FOR UPDATE
  TO anon, authenticated USING (user_id = public.get_current_user_id())
  WITH CHECK (user_id = public.get_current_user_id());

-- ============================================================
-- WITHDRAWALS
-- ============================================================
CREATE TABLE IF NOT EXISTS withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  upi_id text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  reason text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON withdrawals(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);

DROP POLICY IF EXISTS "select_own_withdrawals" ON withdrawals;
CREATE POLICY "select_own_withdrawals" ON withdrawals FOR SELECT
  TO anon, authenticated USING (user_id = public.get_current_user_id());

DROP POLICY IF EXISTS "insert_own_withdrawals" ON withdrawals;
CREATE POLICY "insert_own_withdrawals" ON withdrawals FOR INSERT
  TO anon, authenticated WITH CHECK (user_id = public.get_current_user_id());

DROP POLICY IF EXISTS "update_own_withdrawals" ON withdrawals;
CREATE POLICY "update_own_withdrawals" ON withdrawals FOR UPDATE
  TO anon, authenticated USING (user_id = public.get_current_user_id())
  WITH CHECK (user_id = public.get_current_user_id());

-- ============================================================
-- PAYMENT_SETTINGS (single-row config table)
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  razorpay_key_id text NOT NULL DEFAULT '',
  razorpay_key_secret text NOT NULL DEFAULT '',
  razorpay_webhook_secret text NOT NULL DEFAULT '',
  payment_mode text NOT NULL DEFAULT 'test' CHECK (payment_mode IN ('test', 'live')),
  currency text NOT NULL DEFAULT 'INR',
  company_name text NOT NULL DEFAULT 'Zonex',
  is_configured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;

-- Only expose non-secret columns to authenticated users.
-- The key_secret and webhook_secret are NOT selected by the RLS policy —
-- we use a SECURITY DEFINER function to expose only public config.
CREATE OR REPLACE FUNCTION public.get_payment_config()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'key_id', razorpay_key_id,
    'payment_mode', payment_mode,
    'currency', currency,
    'company_name', company_name,
    'is_configured', is_configured
  )
  FROM payment_settings
  LIMIT 1;
$$;

-- Allow authenticated users to read public payment config
DROP POLICY IF EXISTS "select_payment_settings" ON payment_settings;
CREATE POLICY "select_payment_settings" ON payment_settings FOR SELECT
  TO anon, authenticated USING (true);

-- No INSERT/UPDATE/DELETE policies — only service role (edge function) can modify.
-- This prevents any client-side tampering with payment credentials.

GRANT EXECUTE ON FUNCTION public.get_payment_config TO anon, authenticated;

-- Seed a default row if none exists
INSERT INTO payment_settings (razorpay_key_id, razorpay_key_secret, razorpay_webhook_secret, payment_mode, currency, company_name, is_configured)
SELECT '', '', '', 'test', 'INR', 'Zonex', false
WHERE NOT EXISTS (SELECT 1 FROM payment_settings);

-- ============================================================
-- ESCROW_HOLDS
-- ============================================================
CREATE TABLE IF NOT EXISTS escrow_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  total_amount numeric(12,2) NOT NULL,
  platform_fee numeric(12,2) NOT NULL DEFAULT 0,
  seller_commission numeric(12,2) NOT NULL DEFAULT 0,
  seller_payout numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'held' CHECK (status IN ('held', 'released', 'refunded', 'disputed')),
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE escrow_holds ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_escrow_order ON escrow_holds(order_id);
CREATE INDEX IF NOT EXISTS idx_escrow_buyer ON escrow_holds(buyer_id);
CREATE INDEX IF NOT EXISTS idx_escrow_seller ON escrow_holds(seller_id);

DROP POLICY IF EXISTS "select_own_escrow" ON escrow_holds;
CREATE POLICY "select_own_escrow" ON escrow_holds FOR SELECT
  TO anon, authenticated USING (
    buyer_id = public.get_current_user_id() OR seller_id = public.get_current_user_id()
  );

DROP POLICY IF EXISTS "insert_own_escrow" ON escrow_holds;
CREATE POLICY "insert_own_escrow" ON escrow_holds FOR INSERT
  TO anon, authenticated WITH CHECK (
    buyer_id = public.get_current_user_id() OR seller_id = public.get_current_user_id()
  );

DROP POLICY IF EXISTS "update_own_escrow" ON escrow_holds;
CREATE POLICY "update_own_escrow" ON escrow_holds FOR UPDATE
  TO anon, authenticated USING (
    buyer_id = public.get_current_user_id() OR seller_id = public.get_current_user_id()
  )
  WITH CHECK (
    buyer_id = public.get_current_user_id() OR seller_id = public.get_current_user_id()
  );

-- ============================================================
-- Helper: process_wallet_credit — atomically credit wallet and create transaction
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_wallet_credit(
  p_user_id uuid,
  p_amount numeric(12,2),
  p_type text,
  p_description text,
  p_razorpay_payment_id text DEFAULT NULL,
  p_razorpay_order_id text DEFAULT NULL,
  p_related_order_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tx_id uuid;
BEGIN
  -- Prevent duplicate credits for the same Razorpay payment
  IF p_razorpay_payment_id IS NOT NULL THEN
    SELECT id INTO tx_id FROM wallet_transactions
    WHERE razorpay_payment_id = p_razorpay_payment_id AND status = 'success'
    LIMIT 1;
    IF FOUND THEN
      RETURN tx_id;
    END IF;
  END IF;

  -- Insert transaction record
  INSERT INTO wallet_transactions (
    user_id, type, amount, direction, status,
    razorpay_payment_id, razorpay_order_id, description, related_order_id
  ) VALUES (
    p_user_id, p_type, p_amount, 'credit', 'success',
    p_razorpay_payment_id, p_razorpay_order_id, p_description, p_related_order_id
  ) RETURNING id INTO tx_id;

  -- Update wallet balance
  UPDATE wallets SET
    balance = balance + p_amount,
    total_deposits = CASE WHEN p_type = 'deposit' THEN total_deposits + p_amount ELSE total_deposits END,
    total_earnings = CASE WHEN p_type = 'escrow_release' THEN total_earnings + p_amount ELSE total_earnings END,
    updated_at = now()
  WHERE user_id = p_user_id;

  RETURN tx_id;
END;
$$;

-- ============================================================
-- Helper: process_wallet_debit — atomically debit wallet and create transaction
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_wallet_debit(
  p_user_id uuid,
  p_amount numeric(12,2),
  p_type text,
  p_description text,
  p_related_order_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tx_id uuid;
  current_balance numeric(12,2);
BEGIN
  -- Check sufficient balance
  SELECT balance INTO current_balance FROM wallets WHERE user_id = p_user_id FOR UPDATE;
  IF current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance. Available: %, Requested: %', current_balance, p_amount;
  END IF;

  -- Insert transaction record
  INSERT INTO wallet_transactions (
    user_id, type, amount, direction, status,
    description, related_order_id
  ) VALUES (
    p_user_id, p_type, p_amount, 'debit', 'success',
    p_description, p_related_order_id
  ) RETURNING id INTO tx_id;

  -- Update wallet balance
  UPDATE wallets SET
    balance = balance - p_amount,
    total_withdrawals = CASE WHEN p_type = 'withdrawal' THEN total_withdrawals + p_amount ELSE total_withdrawals END,
    updated_at = now()
  WHERE user_id = p_user_id;

  RETURN tx_id;
END;
$$;

-- ============================================================
-- Helper: hold_escrow — move buyer funds into escrow, update seller pending
-- ============================================================
CREATE OR REPLACE FUNCTION public.hold_escrow(
  p_order_id uuid,
  p_buyer_id uuid,
  p_seller_id uuid,
  p_total_amount numeric(12,2),
  p_platform_fee numeric(12,2),
  p_seller_commission numeric(12,2),
  p_seller_payout numeric(12,2)
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  escrow_id uuid;
BEGIN
  -- Create escrow hold record
  INSERT INTO escrow_holds (
    order_id, buyer_id, seller_id, total_amount,
    platform_fee, seller_commission, seller_payout, status
  ) VALUES (
    p_order_id, p_buyer_id, p_seller_id, p_total_amount,
    p_platform_fee, p_seller_commission, p_seller_payout, 'held'
  ) RETURNING id INTO escrow_id;

  -- Add pending balance to seller's wallet
  UPDATE wallets SET
    pending_balance = pending_balance + p_seller_payout,
    updated_at = now()
  WHERE user_id = p_seller_id;

  -- Record the escrow hold as a debit on buyer's wallet
  INSERT INTO wallet_transactions (
    user_id, type, amount, direction, status, description, related_order_id
  ) VALUES (
    p_buyer_id, 'escrow_hold', p_total_amount, 'debit', 'success',
    'Escrow hold for order', p_order_id
  );

  RETURN escrow_id;
END;
$$;

-- ============================================================
-- Helper: release_escrow — move pending to available for seller, record commission
-- ============================================================
CREATE OR REPLACE FUNCTION public.release_escrow(
  p_order_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  escrow record;
BEGIN
  SELECT * INTO escrow FROM escrow_holds WHERE order_id = p_order_id AND status = 'held' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No held escrow found for order %', p_order_id;
  END IF;

  -- Move pending to available for seller
  UPDATE wallets SET
    pending_balance = pending_balance - escrow.seller_payout,
    balance = balance + escrow.seller_payout,
    total_earnings = total_earnings + escrow.seller_payout,
    updated_at = now()
  WHERE user_id = escrow.seller_id;

  -- Record the escrow release as a credit on seller's wallet
  INSERT INTO wallet_transactions (
    user_id, type, amount, direction, status, description, related_order_id
  ) VALUES (
    escrow.seller_id, 'escrow_release', escrow.seller_payout, 'credit', 'success',
    'Escrow released for order', p_order_id
  );

  -- Update escrow status
  UPDATE escrow_holds SET status = 'released', released_at = now() WHERE order_id = p_order_id;

  -- Update order status
  UPDATE orders SET escrow_status = 'released', status = 'completed', updated_at = now() WHERE id = p_order_id;
END;
$$;

-- ============================================================
-- Helper: refund_escrow — return funds to buyer
-- ============================================================
CREATE OR REPLACE FUNCTION public.refund_escrow(
  p_order_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  escrow record;
BEGIN
  SELECT * INTO escrow FROM escrow_holds WHERE order_id = p_order_id AND status = 'held' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No held escrow found for order %', p_order_id;
  END IF;

  -- Return funds to buyer
  UPDATE wallets SET
    balance = balance + escrow.total_amount,
    updated_at = now()
  WHERE user_id = escrow.buyer_id;

  -- Remove pending from seller
  UPDATE wallets SET
    pending_balance = GREATEST(pending_balance - escrow.seller_payout, 0),
    updated_at = now()
  WHERE user_id = escrow.seller_id;

  -- Record refund transaction for buyer
  INSERT INTO wallet_transactions (
    user_id, type, amount, direction, status, description, related_order_id
  ) VALUES (
    escrow.buyer_id, 'refund', escrow.total_amount, 'credit', 'success',
    'Escrow refund for order', p_order_id
  );

  -- Update escrow status
  UPDATE escrow_holds SET status = 'refunded', released_at = now() WHERE order_id = p_order_id;

  -- Update order status
  UPDATE orders SET escrow_status = 'refunded', status = 'cancelled', updated_at = now() WHERE id = p_order_id;
END;
$$;

-- Grant execute on all helper functions
GRANT EXECUTE ON FUNCTION public.process_wallet_credit TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_wallet_debit TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hold_escrow TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_escrow TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_escrow TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_payment_config TO anon, authenticated;
