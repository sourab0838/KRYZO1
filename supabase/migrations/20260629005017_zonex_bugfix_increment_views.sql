-- Atomic view count increment to prevent race conditions
CREATE OR REPLACE FUNCTION public.increment_listing_views(p_listing_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE account_listings SET views = views + 1 WHERE id = p_listing_id;
$$;

GRANT EXECUTE ON FUNCTION public.increment_listing_views TO anon, authenticated;