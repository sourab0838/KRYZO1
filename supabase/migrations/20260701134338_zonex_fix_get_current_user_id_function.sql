-- Fix get_current_user_id() to use Supabase Auth (auth.uid()) instead
-- of the legacy custom auth_sessions table lookup. The app migrated to
-- Supabase Auth, so the JWT comes in via the standard Authorization
-- header. The old implementation read a custom x-zonex-token header
-- and looked up auth_sessions, which always returned NULL for
-- Supabase Auth users, causing all RLS policies to block reads/writes
-- and leaving pages stuck on infinite loading.

CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid();
$$;

-- Also add select policy for kyc_face_verifications update (already has insert+select)
-- and ensure profiles has a delete policy (missing)
DROP POLICY IF EXISTS "delete_own_profile" ON profiles;
CREATE POLICY "delete_own_profile" ON profiles FOR DELETE
  TO authenticated USING (id = auth.uid());

-- Ensure kyc_requests has delete policy for own records
DROP POLICY IF EXISTS "delete_own_kyc" ON kyc_requests;
CREATE POLICY "delete_own_kyc" ON kyc_requests FOR DELETE
  TO authenticated USING (user_id = auth.uid());

-- Ensure withdrawals has delete policy for own records
DROP POLICY IF EXISTS "delete_own_withdrawals" ON withdrawals;
CREATE POLICY "delete_own_withdrawals" ON withdrawals FOR DELETE
  TO authenticated USING (user_id = auth.uid());
