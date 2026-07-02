-- Recreate the missing pending_registrations table that the zonex-auth
-- edge function depends on. The original migration was never applied, so
-- the register endpoint silently failed and complete-registration always
-- returned "Registration data not found. Please start over."

CREATE TABLE IF NOT EXISTS pending_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  username text NOT NULL,
  full_name text NOT NULL,
  phone_country_code text NOT NULL DEFAULT '+91',
  phone_number text NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes')
);

CREATE INDEX IF NOT EXISTS idx_pending_registrations_email ON pending_registrations(email);
CREATE INDEX IF NOT EXISTS idx_pending_registrations_expires ON pending_registrations(expires_at);

ALTER TABLE pending_registrations ENABLE ROW LEVEL SECURITY;

-- The edge function uses the service-role key, which bypasses RLS.
-- No policies are needed for anon/authenticated access since the table
-- is only ever touched server-side by the zonex-auth function.
