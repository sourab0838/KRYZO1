-- Fix create_listing_with_gallery to match actual account_listings schema
-- (table uses account_level not level; price is integer not numeric)
CREATE OR REPLACE FUNCTION public.create_listing_with_gallery(
  p_seller_id uuid,
  p_title text,
  p_description text,
  p_game text,
  p_price numeric(12,2),
  p_level integer,
  p_br_rank text,
  p_cs_rank text,
  p_prime_level integer DEFAULT 0,
  p_evo_gun_level integer DEFAULT 0,
  p_seller_whatsapp text DEFAULT NULL,
  p_profile_image text DEFAULT NULL,
  p_gallery_images text[] DEFAULT ARRAY[]::text[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing_id uuid;
  v_img text;
BEGIN
  INSERT INTO account_listings (
    seller_id, title, description, game, price, account_level,
    br_rank, cs_rank, prime_level, evo_gun_level,
    seller_whatsapp, profile_image, status
  )
  VALUES (
    p_seller_id, p_title, p_description, p_game, p_price, p_level,
    p_br_rank, p_cs_rank, p_prime_level, p_evo_gun_level,
    p_seller_whatsapp, p_profile_image, 'pending'
  )
  RETURNING id INTO v_listing_id;

  -- Insert gallery images
  IF p_gallery_images IS NOT NULL THEN
    FOREACH v_img IN ARRAY p_gallery_images LOOP
      IF v_img IS NOT NULL AND v_img != '' THEN
        INSERT INTO listing_galleries (listing_id, image_url)
        VALUES (v_listing_id, v_img);
      END IF;
    END LOOP;
  END IF;

  -- Send notification
  PERFORM public.create_notification(p_seller_id, 'listing_created'::notification_type,
    'Listing Created', 'Your listing "' || p_title || '" has been submitted for review.');

  RETURN v_listing_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_listing_with_gallery TO anon, authenticated;
