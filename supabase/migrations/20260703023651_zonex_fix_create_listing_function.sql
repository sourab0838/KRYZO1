-- Drop the existing function and recreate with correct parameter names matching frontend
DROP FUNCTION IF EXISTS public.create_listing_with_gallery(uuid, text, text, text, integer, text, text, integer, integer, integer, integer, integer, text, text, text, text[]);

-- Create listing with gallery - parameters match frontend exactly
CREATE OR REPLACE FUNCTION public.create_listing_with_gallery(
  p_seller_id uuid,
  p_title text,
  p_description text,
  p_game text,
  p_price integer,
  p_level integer,
  p_br_rank text,
  p_cs_rank text,
  p_prime_level integer,
  p_evo_gun_level integer,
  p_seller_whatsapp text DEFAULT NULL,
  p_profile_image text DEFAULT NULL,
  p_gallery_images text[] DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_listing_id uuid;
  v_img_url text;
  v_sort_order integer := 0;
BEGIN
  -- Insert listing
  INSERT INTO account_listings (
    seller_id, title, description, game, price, account_level, br_rank, cs_rank,
    prime_level, evo_gun_level, seller_whatsapp, profile_image, status, uid
  ) VALUES (
    p_seller_id, p_title, p_description, p_game, p_price, p_level, p_br_rank, p_cs_rank,
    p_prime_level, p_evo_gun_level, p_seller_whatsapp, p_profile_image, 'pending', ''
  ) RETURNING id INTO v_listing_id;

  -- Insert gallery images
  FOREACH v_img_url IN ARRAY p_gallery_images
  LOOP
    IF v_img_url IS NOT NULL AND v_img_url != '' THEN
      INSERT INTO listing_galleries (listing_id, image_url, sort_order)
      VALUES (v_listing_id, v_img_url, v_sort_order);
      v_sort_order := v_sort_order + 1;
    END IF;
  END LOOP;

  RETURN v_listing_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_listing_with_gallery TO authenticated;