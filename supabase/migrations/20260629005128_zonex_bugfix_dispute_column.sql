-- Add dispute_reason column to orders if it doesn't exist
DO $$ BEGIN
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispute_reason text;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Add index on escrow_status for faster dispute queries
CREATE INDEX IF NOT EXISTS idx_orders_escrow_status ON orders(escrow_status) WHERE escrow_status IN ('disputed', 'held');

-- Add index on withdrawals status for admin queries
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status) WHERE status IN ('pending', 'processing');
