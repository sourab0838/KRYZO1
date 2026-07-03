-- Ensure listing_galleries has proper policies for users to insert their own images
DROP POLICY IF EXISTS select_listing_galleries ON listing_galleries;
DROP POLICY IF EXISTS insert_listing_galleries ON listing_galleries;
DROP POLICY IF EXISTS select_own_listing_galleries ON listing_galleries;

-- Users can view gallery images for approved listings or their own
CREATE POLICY select_listing_galleries ON listing_galleries FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM account_listings WHERE id = listing_id AND (status = 'approved' OR seller_id = auth.uid()))
  );

-- Users can insert gallery images for their own listings
CREATE POLICY insert_own_listing_galleries ON listing_galleries FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM account_listings WHERE id = listing_id AND seller_id = auth.uid())
  );

-- Ensure wallet transactions have proper user policies
DROP POLICY IF EXISTS select_own_transactions ON wallet_transactions;
DROP POLICY IF EXISTS insert_own_transactions ON wallet_transactions;

CREATE POLICY select_own_transactions ON wallet_transactions FOR SELECT
  TO authenticated USING (user_id = auth.uid());

CREATE POLICY insert_own_transactions ON wallet_transactions FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

-- Ensure notifications policies
DROP POLICY IF EXISTS select_own_notifications ON notifications;
DROP POLICY IF EXISTS update_own_notifications ON notifications;
DROP POLICY IF EXISTS insert_own_notifications ON notifications;

CREATE POLICY select_own_notifications ON notifications FOR SELECT
  TO authenticated USING (user_id = auth.uid());

CREATE POLICY update_own_notifications ON notifications FOR UPDATE
  TO authenticated USING (user_id = auth.uid());

CREATE POLICY insert_own_notifications ON notifications FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

-- Support ticket messages user policies
DROP POLICY IF EXISTS select_own_ticket_messages ON support_ticket_messages;
DROP POLICY IF EXISTS insert_own_ticket_messages ON support_ticket_messages;

CREATE POLICY select_own_ticket_messages ON support_ticket_messages FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM support_tickets WHERE id = ticket_id AND user_id = auth.uid())
  );

CREATE POLICY insert_own_ticket_messages ON support_ticket_messages FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM support_tickets WHERE id = ticket_id AND user_id = auth.uid())
  );

-- Chat conversations and messages user policies
DROP POLICY IF EXISTS select_own_conversations ON chat_conversations;
DROP POLICY IF EXISTS insert_own_conversations ON chat_conversations;

CREATE POLICY select_own_conversations ON chat_conversations FOR SELECT
  TO authenticated USING (buyer_id = auth.uid() OR seller_id = auth.uid());

CREATE POLICY insert_own_conversations ON chat_conversations FOR INSERT
  TO authenticated WITH CHECK (buyer_id = auth.uid() OR seller_id = auth.uid());

-- Chat messages
DROP POLICY IF EXISTS select_own_chat_messages ON chat_messages;
DROP POLICY IF EXISTS insert_own_chat_messages ON chat_messages;

CREATE POLICY select_own_chat_messages ON chat_messages FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM chat_conversations WHERE id = conversation_id AND (buyer_id = auth.uid() OR seller_id = auth.uid()))
  );

CREATE POLICY insert_own_chat_messages ON chat_messages FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM chat_conversations WHERE id = conversation_id AND (buyer_id = auth.uid() OR seller_id = auth.uid()))
  );

-- Listing wishlists
DROP POLICY IF EXISTS select_own_wishlists ON listing_wishlists;
DROP POLICY IF EXISTS insert_own_wishlists ON listing_wishlists;
DROP POLICY IF EXISTS delete_own_wishlists ON listing_wishlists;

CREATE POLICY select_own_wishlists ON listing_wishlists FOR SELECT
  TO authenticated USING (user_id = auth.uid());

CREATE POLICY insert_own_wishlists ON listing_wishlists FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY delete_own_wishlists ON listing_wishlists FOR DELETE
  TO authenticated USING (user_id = auth.uid());

-- Listing compares
DROP POLICY IF EXISTS select_own_compares ON listing_compares;
DROP POLICY IF EXISTS insert_own_compares ON listing_compares;
DROP POLICY IF EXISTS delete_own_compares ON listing_compares;

CREATE POLICY select_own_compares ON listing_compares FOR SELECT
  TO authenticated USING (user_id = auth.uid());

CREATE POLICY insert_own_compares ON listing_compares FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY delete_own_compares ON listing_compares FOR DELETE
  TO authenticated USING (user_id = auth.uid());

-- Listing reviews
DROP POLICY IF EXISTS select_listing_reviews ON listing_reviews;
DROP POLICY IF EXISTS insert_own_reviews ON listing_reviews;

CREATE POLICY select_listing_reviews ON listing_reviews FOR SELECT
  TO authenticated USING (true);

CREATE POLICY insert_own_reviews ON listing_reviews FOR INSERT
  TO authenticated WITH CHECK (reviewer_id = auth.uid());

-- Auth sessions
DROP POLICY IF EXISTS select_own_sessions ON auth_sessions;
DROP POLICY IF EXISTS insert_own_sessions ON auth_sessions;
DROP POLICY IF EXISTS delete_own_sessions ON auth_sessions;

CREATE POLICY select_own_sessions ON auth_sessions FOR SELECT
  TO authenticated USING (user_id = auth.uid());

CREATE POLICY insert_own_sessions ON auth_sessions FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY delete_own_sessions ON auth_sessions FOR DELETE
  TO authenticated USING (user_id = auth.uid());

-- Coupons - allow users to read active coupons
DROP POLICY IF EXISTS coupons_read_active ON coupons;
CREATE POLICY coupons_read_active ON coupons FOR SELECT
  TO authenticated USING (is_active = true AND valid_until > now());