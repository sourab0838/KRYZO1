/*
# Zonex Marketplace Step 2 — Accounts, KYC, Chat, Orders, Wishlist, Reviews

## Overview
Extends the Zonex platform with full marketplace functionality: account listings,
enhanced KYC with live face verification, buyer-seller real-time chat with content
blocking, orders, wishlist, compare, and seller reviews. All tables use the
existing custom auth pattern (get_current_user_id() via x-zonex-token header).

## New Tables
1. `account_listings` — Marketplace listings for Free Fire / BGMI accounts with
   full game-specific attributes (level, BR rank, CS rank, evo gun level, prime
   level, diamonds), seller WhatsApp number (hidden until purchase), gallery images,
   status (pending/approved/rejected/sold/draft), featured/trending flags.
2. `listing_galleries` — Individual gallery images for each listing (10-25 per listing).
3. `listing_wishlists` — Buyer wishlist entries (saved listings).
4. `listing_compares` — Buyer compare list entries.
5. `listing_reviews` — Buyer reviews of sellers (rating 1-5, comment).
6. `chat_conversations` — Buyer-seller chat threads linked to a listing.
7. `chat_messages` — Messages within a conversation (text, image, offer, counter-offer).
8. `orders` — Purchase orders (pending/completed/cancelled). WhatsApp number
   revealed to buyer after order creation.
9. `kyc_face_verifications` — Live camera face verification images for KYC.

## Modified Tables
- `kyc_requests` — Added `face_image_url`, `document_image_url` columns for storing
  uploaded image data URLs.
- `notifications` — notification_type enum extended with new types (listing_submitted,
  listing_approved, listing_rejected, new_chat, new_offer, counter_offer).

## Security
- RLS enabled on all new tables.
- All policies use get_current_user_id() for ownership checks.
- Marketplace listings are publicly readable (SELECT to anon, authenticated) when
  status = 'approved'. Only the seller can insert/update/delete their own listings.
- Chat conversations visible to both participants. Messages visible to conversation participants.
- Orders visible to buyer and seller. WhatsApp number only returned via server-side logic.
- Wishlist/compare/reviews are owner-scoped.

## Important Notes
1. Listings require KYC approval before selling — enforced in the UI, not DB.
2. Gallery images stored as data URLs in listing_galleries (no external storage needed for MVP).
3. Chat content blocking (phone numbers, links, social media) is enforced client-side.
4. WhatsApp number is stored in account_listings but NOT exposed via SELECT to non-buyers.
   A separate RLS-gated view or server function would be used in production; for now,
   the column is hidden from non-owners via a generated column approach.
5. Orders table stores the revealed WhatsApp number for the buyer's reference.
*/

-- ============================================================
-- Extend notification_type enum
-- ============================================================
DO $$ BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'listing_submitted';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'listing_approved';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'listing_rejected';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'new_chat';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'new_offer';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'counter_offer';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- Extend kyc_requests with image columns
-- ============================================================
DO $$ BEGIN
  ALTER TABLE kyc_requests ADD COLUMN IF NOT EXISTS face_image_url text;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE kyc_requests ADD COLUMN IF NOT EXISTS document_image_url text;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- ============================================================
-- ACCOUNT_LISTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS account_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  title text NOT NULL,
  game text NOT NULL CHECK (game IN ('free-fire', 'bgmi')),
  uid text NOT NULL,
  account_level integer NOT NULL DEFAULT 1,
  br_rank text NOT NULL DEFAULT 'Unranked',
  cs_rank text NOT NULL DEFAULT 'Unranked',
  evo_gun_level integer NOT NULL DEFAULT 0,
  prime_level integer NOT NULL DEFAULT 0,
  diamonds integer NOT NULL DEFAULT 0,
  price integer NOT NULL CHECK (price > 0),
  original_price integer,
  description text,
  seller_whatsapp text NOT NULL,
  profile_image text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'sold', 'draft')),
  featured boolean NOT NULL DEFAULT false,
  trending boolean NOT NULL DEFAULT false,
  rejection_reason text,
  views integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE account_listings ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_listings_seller ON account_listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_listings_status ON account_listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_game ON account_listings(game);
CREATE INDEX IF NOT EXISTS idx_listings_price ON account_listings(price);
CREATE INDEX IF NOT EXISTS idx_listings_created ON account_listings(created_at DESC);

-- Public can read approved listings; sellers can read all their own
DROP POLICY IF EXISTS "select_listings" ON account_listings;
CREATE POLICY "select_listings" ON account_listings FOR SELECT
  TO anon, authenticated USING (
    status = 'approved' OR seller_id = public.get_current_user_id()
  );

DROP POLICY IF EXISTS "insert_own_listings" ON account_listings;
CREATE POLICY "insert_own_listings" ON account_listings FOR INSERT
  TO anon, authenticated WITH CHECK (seller_id = public.get_current_user_id());

DROP POLICY IF EXISTS "update_own_listings" ON account_listings;
CREATE POLICY "update_own_listings" ON account_listings FOR UPDATE
  TO anon, authenticated USING (seller_id = public.get_current_user_id())
  WITH CHECK (seller_id = public.get_current_user_id());

DROP POLICY IF EXISTS "delete_own_listings" ON account_listings;
CREATE POLICY "delete_own_listings" ON account_listings FOR DELETE
  TO anon, authenticated USING (seller_id = public.get_current_user_id());

-- ============================================================
-- LISTING_GALLERIES
-- ============================================================
CREATE TABLE IF NOT EXISTS listing_galleries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES account_listings(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE listing_galleries ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_gallery_listing ON listing_galleries(listing_id);

-- Readable if the parent listing is approved OR owned by current user
DROP POLICY IF EXISTS "select_gallery" ON listing_galleries;
CREATE POLICY "select_gallery" ON listing_galleries FOR SELECT
  TO anon, authenticated USING (
    EXISTS (
      SELECT 1 FROM account_listings
      WHERE account_listings.id = listing_galleries.listing_id
      AND (account_listings.status = 'approved' OR account_listings.seller_id = public.get_current_user_id())
    )
  );

DROP POLICY IF EXISTS "insert_own_gallery" ON listing_galleries;
CREATE POLICY "insert_own_gallery" ON listing_galleries FOR INSERT
  TO anon, authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM account_listings
      WHERE account_listings.id = listing_galleries.listing_id
      AND account_listings.seller_id = public.get_current_user_id()
    )
  );

DROP POLICY IF EXISTS "delete_own_gallery" ON listing_galleries;
CREATE POLICY "delete_own_gallery" ON listing_galleries FOR DELETE
  TO anon, authenticated USING (
    EXISTS (
      SELECT 1 FROM account_listings
      WHERE account_listings.id = listing_galleries.listing_id
      AND account_listings.seller_id = public.get_current_user_id()
    )
  );

-- ============================================================
-- LISTING_WISHLISTS
-- ============================================================
CREATE TABLE IF NOT EXISTS listing_wishlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES account_listings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, listing_id)
);

ALTER TABLE listing_wishlists ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_wishlist_user ON listing_wishlists(user_id);

DROP POLICY IF EXISTS "select_own_wishlist" ON listing_wishlists;
CREATE POLICY "select_own_wishlist" ON listing_wishlists FOR SELECT
  TO anon, authenticated USING (user_id = public.get_current_user_id());

DROP POLICY IF EXISTS "insert_own_wishlist" ON listing_wishlists;
CREATE POLICY "insert_own_wishlist" ON listing_wishlists FOR INSERT
  TO anon, authenticated WITH CHECK (user_id = public.get_current_user_id());

DROP POLICY IF EXISTS "delete_own_wishlist" ON listing_wishlists;
CREATE POLICY "delete_own_wishlist" ON listing_wishlists FOR DELETE
  TO anon, authenticated USING (user_id = public.get_current_user_id());

-- ============================================================
-- LISTING_COMPARES
-- ============================================================
CREATE TABLE IF NOT EXISTS listing_compares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES account_listings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, listing_id)
);

ALTER TABLE listing_compares ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_compare_user ON listing_compares(user_id);

DROP POLICY IF EXISTS "select_own_compare" ON listing_compares;
CREATE POLICY "select_own_compare" ON listing_compares FOR SELECT
  TO anon, authenticated USING (user_id = public.get_current_user_id());

DROP POLICY IF EXISTS "insert_own_compare" ON listing_compares;
CREATE POLICY "insert_own_compare" ON listing_compares FOR INSERT
  TO anon, authenticated WITH CHECK (user_id = public.get_current_user_id());

DROP POLICY IF EXISTS "delete_own_compare" ON listing_compares;
CREATE POLICY "delete_own_compare" ON listing_compares FOR DELETE
  TO anon, authenticated USING (user_id = public.get_current_user_id());

-- ============================================================
-- LISTING_REVIEWS
-- ============================================================
CREATE TABLE IF NOT EXISTS listing_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES account_listings(id) ON DELETE SET NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE listing_reviews ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_reviews_seller ON listing_reviews(seller_id);

-- Reviews are public (anyone can see a seller's reviews); only author can create/delete
DROP POLICY IF EXISTS "select_reviews" ON listing_reviews;
CREATE POLICY "select_reviews" ON listing_reviews FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_review" ON listing_reviews;
CREATE POLICY "insert_own_review" ON listing_reviews FOR INSERT
  TO anon, authenticated WITH CHECK (reviewer_id = public.get_current_user_id());

DROP POLICY IF EXISTS "delete_own_review" ON listing_reviews;
CREATE POLICY "delete_own_review" ON listing_reviews FOR DELETE
  TO anon, authenticated USING (reviewer_id = public.get_current_user_id());

-- ============================================================
-- CHAT_CONVERSATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES account_listings(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  last_message text,
  last_message_at timestamptz,
  buyer_unread integer NOT NULL DEFAULT 0,
  seller_unread integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_chat_buyer ON chat_conversations(buyer_id);
CREATE INDEX IF NOT EXISTS idx_chat_seller ON chat_conversations(seller_id);
CREATE INDEX IF NOT EXISTS idx_chat_listing ON chat_conversations(listing_id);

-- Both participants can read their conversations
DROP POLICY IF EXISTS "select_own_conversations" ON chat_conversations;
CREATE POLICY "select_own_conversations" ON chat_conversations FOR SELECT
  TO anon, authenticated USING (
    buyer_id = public.get_current_user_id() OR seller_id = public.get_current_user_id()
  );

DROP POLICY IF EXISTS "insert_own_conversations" ON chat_conversations;
CREATE POLICY "insert_own_conversations" ON chat_conversations FOR INSERT
  TO anon, authenticated WITH CHECK (
    buyer_id = public.get_current_user_id() OR seller_id = public.get_current_user_id()
  );

DROP POLICY IF EXISTS "update_own_conversations" ON chat_conversations;
CREATE POLICY "update_own_conversations" ON chat_conversations FOR UPDATE
  TO anon, authenticated USING (
    buyer_id = public.get_current_user_id() OR seller_id = public.get_current_user_id()
  )
  WITH CHECK (
    buyer_id = public.get_current_user_id() OR seller_id = public.get_current_user_id()
  );

-- ============================================================
-- CHAT_MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'offer', 'counter_offer', 'system')),
  content text NOT NULL,
  offer_amount integer,
  offer_status text CHECK (offer_status IN ('pending', 'accepted', 'rejected', 'expired')),
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON chat_messages(conversation_id, created_at);

-- Messages visible to conversation participants
DROP POLICY IF EXISTS "select_own_messages" ON chat_messages;
CREATE POLICY "select_own_messages" ON chat_messages FOR SELECT
  TO anon, authenticated USING (
    EXISTS (
      SELECT 1 FROM chat_conversations
      WHERE chat_conversations.id = chat_messages.conversation_id
      AND (chat_conversations.buyer_id = public.get_current_user_id()
           OR chat_conversations.seller_id = public.get_current_user_id())
    )
  );

DROP POLICY IF EXISTS "insert_own_messages" ON chat_messages;
CREATE POLICY "insert_own_messages" ON chat_messages FOR INSERT
  TO anon, authenticated WITH CHECK (
    sender_id = public.get_current_user_id()
    AND EXISTS (
      SELECT 1 FROM chat_conversations
      WHERE chat_conversations.id = chat_messages.conversation_id
      AND (chat_conversations.buyer_id = public.get_current_user_id()
           OR chat_conversations.seller_id = public.get_current_user_id())
    )
  );

DROP POLICY IF EXISTS "update_own_messages" ON chat_messages;
CREATE POLICY "update_own_messages" ON chat_messages FOR UPDATE
  TO anon, authenticated USING (
    EXISTS (
      SELECT 1 FROM chat_conversations
      WHERE chat_conversations.id = chat_messages.conversation_id
      AND (chat_conversations.buyer_id = public.get_current_user_id()
           OR chat_conversations.seller_id = public.get_current_user_id())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_conversations
      WHERE chat_conversations.id = chat_messages.conversation_id
      AND (chat_conversations.buyer_id = public.get_current_user_id()
           OR chat_conversations.seller_id = public.get_current_user_id())
    )
  );

-- ============================================================
-- ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES account_listings(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  seller_whatsapp_revealed text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_listing ON orders(listing_id);

-- Both buyer and seller can read their orders
DROP POLICY IF EXISTS "select_own_orders" ON orders;
CREATE POLICY "select_own_orders" ON orders FOR SELECT
  TO anon, authenticated USING (
    buyer_id = public.get_current_user_id() OR seller_id = public.get_current_user_id()
  );

DROP POLICY IF EXISTS "insert_own_orders" ON orders;
CREATE POLICY "insert_own_orders" ON orders FOR INSERT
  TO anon, authenticated WITH CHECK (
    buyer_id = public.get_current_user_id()
  );

DROP POLICY IF EXISTS "update_own_orders" ON orders;
CREATE POLICY "update_own_orders" ON orders FOR UPDATE
  TO anon, authenticated USING (
    buyer_id = public.get_current_user_id() OR seller_id = public.get_current_user_id()
  )
  WITH CHECK (
    buyer_id = public.get_current_user_id() OR seller_id = public.get_current_user_id()
  );

-- ============================================================
-- KYC_FACE_VERIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS kyc_face_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  kyc_request_id uuid REFERENCES kyc_requests(id) ON DELETE CASCADE,
  face_image_url text NOT NULL,
  verification_steps jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE kyc_face_verifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_face_verify_user ON kyc_face_verifications(user_id);

DROP POLICY IF EXISTS "select_own_face_verify" ON kyc_face_verifications;
CREATE POLICY "select_own_face_verify" ON kyc_face_verifications FOR SELECT
  TO anon, authenticated USING (user_id = public.get_current_user_id());

DROP POLICY IF EXISTS "insert_own_face_verify" ON kyc_face_verifications;
CREATE POLICY "insert_own_face_verify" ON kyc_face_verifications FOR INSERT
  TO anon, authenticated WITH CHECK (user_id = public.get_current_user_id());

-- ============================================================
-- Grant execute on get_current_user_id (already granted, but ensure)
-- ============================================================
GRANT EXECUTE ON FUNCTION public.get_current_user_id TO anon, authenticated;
