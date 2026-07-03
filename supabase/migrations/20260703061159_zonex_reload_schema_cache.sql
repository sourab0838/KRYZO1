-- Reload the PostgREST schema cache to pick up the new FK relationships
-- This notifies Supabase to refresh its internal schema cache

NOTIFY pgrst, 'reload schema';

-- Alternative: Create a function to notify and grant access
CREATE OR REPLACE FUNCTION reload_schema_cache()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  NOTIFY pgrst, 'reload schema';
END;
$$;

SELECT reload_schema_cache();