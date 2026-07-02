import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Zonex-Token",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400) {
  return json({ error: message }, status);
}

// Get current user from x-zonex-token header
async function getCurrentUserId(req: Request): Promise<string | null> {
  const token = req.headers.get("x-zonex-token");
  if (!token) return null;
  const { createHash } = await import("node:crypto");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { data } = await supabase
    .from("auth_sessions")
    .select("user_id")
    .eq("token_hash", tokenHash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return data?.user_id ?? null;
}

// Get payment settings from DB
async function getPaymentSettings() {
  const { data } = await supabase
    .from("payment_settings")
    .select("*")
    .limit(1)
    .maybeSingle();
  return data;
}

// Create Razorpay order via their API
async function createRazorpayOrder(
  keyId: string,
  keySecret: string,
  amount: number,
  currency: string,
  receipt: string,
  notes: Record<string, string>
) {
  const auth = btoa(`${keyId}:${keySecret}`);
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Basic ${auth}`,
    },
    body: JSON.stringify({
      amount: Math.round(amount * 100),
      currency,
      receipt,
      notes,
    }),
  });
  return response.json();
}

// Verify Razorpay payment signature
async function verifyRazorpaySignature(
  keySecret: string,
  razorpayOrderId: string,
  razorpayPaymentId: string,
  signature: string
): Promise<boolean> {
  const { createHmac } = await import("node:crypto");
  const body = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expectedSignature = createHmac("sha256", keySecret).update(body).digest("hex");
  return expectedSignature === signature;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace("/functions/v1/zonex-payments", "");
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    // ============================================================
    // CREATE ORDER — Create a Razorpay order for wallet top-up
    // ============================================================
    if (path === "/create-order" && req.method === "POST") {
      const userId = await getCurrentUserId(req);
      if (!userId) return errorResponse("Unauthorized", 401);

      const { amount } = body;
      if (typeof amount !== "number" || isNaN(amount) || amount < 1) return errorResponse("Invalid amount");

      const settings = await getPaymentSettings();
      const isConfigured = settings && settings.is_configured && settings.razorpay_key_id && settings.razorpay_key_secret;

      // Demo/Test Mode: if not configured, create a mock order for testing
      if (!isConfigured) {
        const mockOrderId = `demo_order_${Date.now()}_${userId.slice(0, 8)}`;
        return json({
          order_id: mockOrderId,
          amount: Math.round(amount * 100),
          currency: "INR",
          key_id: "demo_mode",
          company_name: "Zonex (Demo Mode)",
          payment_mode: "test",
          demo_mode: true,
        });
      }

      const { data: user } = await supabase
        .from("app_users")
        .select("email, username")
        .eq("id", userId)
        .maybeSingle();

      const receipt = `zonex_${Date.now()}_${userId.slice(0, 8)}`;
      const order = await createRazorpayOrder(
        settings.razorpay_key_id,
        settings.razorpay_key_secret,
        amount,
        settings.currency || "INR",
        receipt,
        {
          user_id: userId,
          purpose: "wallet_topup",
          email: user?.email || "",
        }
      );

      if (order.error) {
        return errorResponse(order.error.description || "Failed to create order", 400);
      }

      return json({
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id: settings.razorpay_key_id,
        company_name: settings.company_name,
        payment_mode: settings.payment_mode,
      });
    }

    // ============================================================
    // VERIFY PAYMENT — Verify Razorpay signature and credit wallet
    // ============================================================
    if (path === "/verify-payment" && req.method === "POST") {
      const userId = await getCurrentUserId(req);
      if (!userId) return errorResponse("Unauthorized", 401);

      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = body;
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return errorResponse("Missing payment details");
      }

      const settings = await getPaymentSettings();
      const isConfigured = settings && settings.is_configured && settings.razorpay_key_secret;

      // Demo/Test Mode: skip signature verification, auto-credit wallet
      if (!isConfigured || razorpay_order_id.startsWith("demo_order_")) {
        // Check for duplicate credit
        const { data: existing } = await supabase
          .from("wallet_transactions")
          .select("id")
          .eq("razorpay_payment_id", razorpay_payment_id)
          .eq("status", "success")
          .maybeSingle();
        if (existing) {
          return json({ success: true, message: "Payment already processed", duplicate: true });
        }

        // Credit wallet via RPC
        const { error: creditError } = await supabase.rpc("process_wallet_credit", {
          p_user_id: userId,
          p_amount: amount,
          p_type: "deposit",
          p_description: "Wallet top-up (Demo Mode)",
          p_razorpay_payment_id: razorpay_payment_id,
          p_razorpay_order_id: razorpay_order_id,
        });
        if (creditError) {
          return errorResponse("Failed to credit wallet: " + creditError.message, 500);
        }

        // Send notification
        await supabase.rpc("create_notification", {
          p_user_id: userId, p_type: "payment_success",
          p_title: "Payment Successful",
          p_message: `₹${amount} has been added to your wallet.`,
        });

        return json({ success: true, message: "Payment verified and wallet credited (Demo Mode)" });
      }

      // Verify signature
      const isValid = await verifyRazorpaySignature(
        settings.razorpay_key_secret,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      );

      if (!isValid) {
        // Record failed transaction
        await supabase.from("wallet_transactions").insert({
          user_id: userId,
          type: "deposit",
          amount,
          direction: "credit",
          status: "failed",
          razorpay_payment_id,
          razorpay_order_id,
          description: "Failed payment - invalid signature",
        });
        return errorResponse("Payment verification failed", 400);
      }

      // Check for duplicate credit
      const { data: existing } = await supabase
        .from("wallet_transactions")
        .select("id")
        .eq("razorpay_payment_id", razorpay_payment_id)
        .eq("status", "success")
        .maybeSingle();

      if (existing) {
        return json({ success: true, message: "Payment already processed", duplicate: true });
      }

      // Credit wallet via RPC
      const { error: creditError } = await supabase.rpc("process_wallet_credit", {
        p_user_id: userId,
        p_amount: amount,
        p_type: "deposit",
        p_description: `Wallet top-up via Razorpay`,
        p_razorpay_payment_id: razorpay_payment_id,
        p_razorpay_order_id: razorpay_order_id,
      });

      if (creditError) {
        return errorResponse("Failed to credit wallet: " + creditError.message, 500);
      }

      // Send notification
      await supabase.rpc("create_notification", {
        p_user_id: userId,
        p_type: "payment_success",
        p_title: "Payment Successful",
        p_message: `₹${amount} has been added to your wallet.`,
      });
      await supabase.rpc("create_notification", {
        p_user_id: userId,
        p_type: "wallet_credited",
        p_title: "Wallet Credited",
        p_message: `₹${amount} credited to your wallet via Razorpay.`,
      });

      return json({ success: true, message: "Payment verified and wallet credited" });
    }

    // ============================================================
    // CREATE PURCHASE ORDER — Create order for buying an account
    // ============================================================
    if (path === "/create-purchase" && req.method === "POST") {
      const userId = await getCurrentUserId(req);
      if (!userId) return errorResponse("Unauthorized", 401);

      const { listing_id } = body;
      if (!listing_id) return errorResponse("Listing ID required");

      // Get listing
      const { data: listing } = await supabase
        .from("account_listings")
        .select("*")
        .eq("id", listing_id)
        .eq("status", "approved")
        .maybeSingle();

      if (!listing) return errorResponse("Listing not found or not available");
      if (listing.seller_id === userId) return errorResponse("You cannot buy your own listing");

      // Check for existing pending order
      const { data: existingOrder } = await supabase
        .from("orders")
        .select("id")
        .eq("listing_id", listing_id)
        .eq("buyer_id", userId)
        .in("status", ["pending", "payment_successful", "awaiting_delivery", "buyer_reviewing"])
        .maybeSingle();

      if (existingOrder) return errorResponse("You already have a pending order for this listing");

      // Calculate commission
      const listingPrice = listing.price;
      const platformFee = Math.round(listingPrice * 0.10);
      const sellerCommission = Math.round(listingPrice * 0.10);
      const sellerPayout = listingPrice - sellerCommission;
      const totalAmount = listingPrice + platformFee;

      // Create order
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          listing_id: listing_id,
          buyer_id: userId,
          seller_id: listing.seller_id,
          amount: totalAmount,
          status: "pending",
          platform_fee: platformFee,
          seller_commission: sellerCommission,
          seller_payout: sellerPayout,
          escrow_status: "none",
          delivery_status: "pending",
          seller_whatsapp_revealed: listing.seller_whatsapp,
        })
        .select()
        .single();

      if (orderError) return errorResponse("Failed to create order: " + orderError.message, 500);

      // Create Razorpay order
      const settings = await getPaymentSettings();
      const isConfigured = settings && settings.is_configured && settings.razorpay_key_id && settings.razorpay_key_secret;

      // Demo/Test Mode: create a mock Razorpay order
      if (!isConfigured) {
        const mockRazorpayOrderId = `demo_purchase_${order.id.slice(0, 8)}`;
        await supabase
          .from("orders")
          .update({ razorpay_order_id: mockRazorpayOrderId })
          .eq("id", order.id);

        // Send notifications
        await supabase.rpc("create_notification", {
          p_user_id: userId, p_type: "order_created",
          p_title: "Order Created",
          p_message: `Order created for "${listing.title}". Total: ₹${totalAmount} (incl. 10% platform fee).`,
        });
        await supabase.rpc("create_notification", {
          p_user_id: listing.seller_id, p_type: "order_created",
          p_title: "New Order",
          p_message: `New order for "${listing.title}". Please prepare for delivery.`,
        });

        return json({
          order_id: order.id,
          razorpay_order_id: mockRazorpayOrderId,
          amount: totalAmount * 100,
          currency: "INR",
          key_id: "demo_mode",
          company_name: "Zonex (Demo Mode)",
          payment_mode: "test",
          listing_title: listing.title,
          seller_whatsapp: listing.seller_whatsapp,
          total_amount: totalAmount,
          platform_fee: platformFee,
          seller_payout: sellerPayout,
          demo_mode: true,
        });
      }

      const { data: user } = await supabase
        .from("app_users")
        .select("email, username")
        .eq("id", userId)
        .maybeSingle();

      const receipt = `zonex_purchase_${order.id.slice(0, 8)}`;
      const razorpayOrder = await createRazorpayOrder(
        settings.razorpay_key_id,
        settings.razorpay_key_secret,
        totalAmount,
        settings.currency || "INR",
        receipt,
        {
          user_id: userId,
          purpose: "purchase",
          listing_id: listing_id,
          order_id: order.id,
          email: user?.email || "",
        }
      );

      if (razorpayOrder.error) {
        return errorResponse(razorpayOrder.error.description || "Failed to create payment order", 400);
      }

      // Update order with Razorpay order ID
      await supabase
        .from("orders")
        .update({ razorpay_order_id: razorpayOrder.id })
        .eq("id", order.id);

      // Send notifications
      await supabase.rpc("create_notification", {
        p_user_id: userId,
        p_type: "order_created",
        p_title: "Order Created",
        p_message: `Order created for "${listing.title}". Total: ₹${totalAmount} (incl. 10% platform fee).`,
      });
      await supabase.rpc("create_notification", {
        p_user_id: listing.seller_id,
        p_type: "order_created",
        p_title: "New Order",
        p_message: `New order for "${listing.title}". Please prepare for delivery.`,
      });

      return json({
        order_id: order.id,
        razorpay_order_id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        key_id: settings.razorpay_key_id,
        company_name: settings.company_name,
        payment_mode: settings.payment_mode,
        listing_title: listing.title,
        seller_whatsapp: listing.seller_whatsapp,
        total_amount: totalAmount,
        platform_fee: platformFee,
        seller_payout: sellerPayout,
      });
    }

    // ============================================================
    // VERIFY PURCHASE — Verify purchase payment and hold escrow
    // ============================================================
    if (path === "/verify-purchase" && req.method === "POST") {
      const userId = await getCurrentUserId(req);
      if (!userId) return errorResponse("Unauthorized", 401);

      const { order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
      if (!order_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return errorResponse("Missing payment details");
      }

      const settings = await getPaymentSettings();
      const isConfigured = settings && settings.is_configured && settings.razorpay_key_secret;

      // Demo/Test Mode: skip signature verification
      if (!isConfigured || razorpay_order_id.startsWith("demo_purchase_")) {
        // Get order
        const { data: order } = await supabase
          .from("orders")
          .select("*")
          .eq("id", order_id)
          .eq("buyer_id", userId)
          .maybeSingle();
        if (!order) return errorResponse("Order not found");
        if (order.status !== "pending") return errorResponse("Order already processed");

        // Check for duplicate
        const { data: existingTx } = await supabase
          .from("wallet_transactions")
          .select("id")
          .eq("razorpay_payment_id", razorpay_payment_id)
          .eq("status", "success")
          .maybeSingle();
        if (existingTx) {
          return json({ success: true, message: "Payment already processed", duplicate: true });
        }

        // Update order status
        await supabase
          .from("orders")
          .update({
            status: "payment_successful",
            razorpay_payment_id: razorpay_payment_id,
            escrow_status: "held",
            delivery_status: "pending",
            updated_at: new Date().toISOString(),
          })
          .eq("id", order_id);

        // Hold escrow
        await supabase.rpc("hold_escrow", {
          p_order_id: order_id,
          p_buyer_id: order.buyer_id,
          p_seller_id: order.seller_id,
          p_total_amount: order.amount,
          p_platform_fee: order.platform_fee,
          p_seller_commission: order.seller_commission,
          p_seller_payout: order.seller_payout,
        });

        // Update listing status to sold
        await supabase
          .from("account_listings")
          .update({ status: "sold" })
          .eq("id", order.listing_id);

        // Send notifications
        await supabase.rpc("create_notification", {
          p_user_id: userId, p_type: "payment_success",
          p_title: "Payment Successful",
          p_message: `Payment of ₹${order.amount} successful. Funds held in escrow. Seller will deliver the account shortly.`,
        });
        await supabase.rpc("create_notification", {
          p_user_id: order.seller_id, p_type: "order_created",
          p_title: "Payment Received",
          p_message: `Payment received for order. ₹${order.seller_payout} is now in your pending balance. Deliver the account to release funds.`,
        });

        return json({
          success: true,
          message: "Payment verified, escrow held (Demo Mode)",
          seller_whatsapp: order.seller_whatsapp_revealed,
        });
      }

      // Verify signature
      const isValid = await verifyRazorpaySignature(
        settings.razorpay_key_secret,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      );

      if (!isValid) {
        return errorResponse("Payment verification failed", 400);
      }

      // Get order
      const { data: order } = await supabase
        .from("orders")
        .select("*")
        .eq("id", order_id)
        .eq("buyer_id", userId)
        .maybeSingle();

      if (!order) return errorResponse("Order not found");
      if (order.status !== "pending") return errorResponse("Order already processed");

      // Check for duplicate
      const { data: existingTx } = await supabase
        .from("wallet_transactions")
        .select("id")
        .eq("razorpay_payment_id", razorpay_payment_id)
        .eq("status", "success")
        .maybeSingle();

      if (existingTx) {
        return json({ success: true, message: "Payment already processed", duplicate: true });
      }

      // Update order status
      await supabase
        .from("orders")
        .update({
          status: "payment_successful",
          razorpay_payment_id: razorpay_payment_id,
          escrow_status: "held",
          delivery_status: "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", order_id);

      // Hold escrow
      await supabase.rpc("hold_escrow", {
        p_order_id: order_id,
        p_buyer_id: order.buyer_id,
        p_seller_id: order.seller_id,
        p_total_amount: order.amount,
        p_platform_fee: order.platform_fee,
        p_seller_commission: order.seller_commission,
        p_seller_payout: order.seller_payout,
      });

      // Update listing status to sold
      await supabase
        .from("account_listings")
        .update({ status: "sold" })
        .eq("id", order.listing_id);

      // Send notifications
      await supabase.rpc("create_notification", {
        p_user_id: userId,
        p_type: "payment_success",
        p_title: "Payment Successful",
        p_message: `Payment of ₹${order.amount} successful. Funds held in escrow. Seller will deliver the account shortly.`,
      });
      await supabase.rpc("create_notification", {
        p_user_id: order.seller_id,
        p_type: "order_created",
        p_title: "Payment Received",
        p_message: `Payment received for order. ₹${order.seller_payout} is now in your pending balance. Deliver the account to release funds.`,
      });

      return json({
        success: true,
        message: "Payment verified, escrow held",
        seller_whatsapp: order.seller_whatsapp_revealed,
      });
    }

    // ============================================================
    // CONFIRM DELIVERY — Buyer confirms account received, release escrow
    // ============================================================
    if (path === "/confirm-delivery" && req.method === "POST") {
      const userId = await getCurrentUserId(req);
      if (!userId) return errorResponse("Unauthorized", 401);

      const { order_id } = body;
      if (!order_id) return errorResponse("Order ID required");

      const { data: order } = await supabase
        .from("orders")
        .select("*")
        .eq("id", order_id)
        .eq("buyer_id", userId)
        .maybeSingle();

      if (!order) return errorResponse("Order not found");
      if (order.delivery_status !== "delivered") {
        return errorResponse("Seller has not marked this order as delivered yet");
      }

      // Release escrow
      const { error: releaseError } = await supabase.rpc("release_escrow", { p_order_id: order_id });
      if (releaseError) return errorResponse("Failed to release escrow: " + releaseError.message, 500);

      // Update delivery status
      await supabase
        .from("orders")
        .update({ delivery_status: "confirmed", status: "completed", updated_at: new Date().toISOString() })
        .eq("id", order_id);

      // Send notifications
      await supabase.rpc("create_notification", {
        p_user_id: userId,
        p_type: "buyer_confirmed",
        p_title: "Order Completed",
        p_message: `You confirmed receipt. Escrow funds released to seller.`,
      });
      await supabase.rpc("create_notification", {
        p_user_id: order.seller_id,
        p_type: "funds_released",
        p_title: "Funds Released",
        p_message: `₹${order.seller_payout} released from escrow to your available balance.`,
      });

      return json({ success: true, message: "Delivery confirmed, funds released" });
    }

    // ============================================================
    // MARK DELIVERED — Seller marks order as delivered
    // ============================================================
    if (path === "/mark-delivered" && req.method === "POST") {
      const userId = await getCurrentUserId(req);
      if (!userId) return errorResponse("Unauthorized", 401);

      const { order_id } = body;
      if (!order_id) return errorResponse("Order ID required");

      const { data: order } = await supabase
        .from("orders")
        .select("*")
        .eq("id", order_id)
        .eq("seller_id", userId)
        .maybeSingle();

      if (!order) return errorResponse("Order not found");
      if (order.escrow_status !== "held") return errorResponse("Escrow not held for this order");
      if (order.delivery_status !== "pending") return errorResponse("Already marked as delivered");

      await supabase
        .from("orders")
        .update({
          delivery_status: "delivered",
          status: "buyer_reviewing",
          updated_at: new Date().toISOString(),
        })
        .eq("id", order_id);

      await supabase.rpc("create_notification", {
        p_user_id: order.buyer_id,
        p_type: "seller_delivered",
        p_title: "Account Delivered",
        p_message: `Seller has delivered the account. Please confirm receipt to release escrow funds.`,
      });

      return json({ success: true, message: "Marked as delivered" });
    }

    // ============================================================
    // GET PAYMENT CONFIG — Public config for frontend
    // ============================================================
    if (path === "/config" && req.method === "GET") {
      const { data, error } = await supabase.rpc("get_payment_config");
      if (error) return errorResponse("Failed to load config", 500);
      return json(data);
    }

    // ============================================================
    // SAVE PAYMENT SETTINGS — Admin only (service role check)
    // ============================================================
    if (path === "/save-settings" && req.method === "POST") {
      const userId = await getCurrentUserId(req);
      if (!userId) return errorResponse("Unauthorized", 401);

      // Verify admin role
      const { data: adminRole } = await supabase
        .from("admin_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();
      if (!adminRole || !["super_admin", "moderator"].includes(adminRole.role)) {
        return errorResponse("Access denied: admin role required", 403);
      }

      const { razorpay_key_id, razorpay_key_secret, razorpay_webhook_secret, payment_mode, currency, company_name } = body;

      if (!razorpay_key_id || !razorpay_key_secret) {
        return errorResponse("Key ID and Key Secret are required");
      }

      const { data: existing } = await supabase
        .from("payment_settings")
        .select("id")
        .limit(1)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("payment_settings")
          .update({
            razorpay_key_id,
            razorpay_key_secret,
            razorpay_webhook_secret: razorpay_webhook_secret || "",
            payment_mode: payment_mode || "test",
            currency: currency || "INR",
            company_name: company_name || "Zonex",
            is_configured: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        if (error) return errorResponse("Failed to save settings: " + error.message, 500);
      } else {
        const { error } = await supabase
          .from("payment_settings")
          .insert({
            razorpay_key_id,
            razorpay_key_secret,
            razorpay_webhook_secret: razorpay_webhook_secret || "",
            payment_mode: payment_mode || "test",
            currency: currency || "INR",
            company_name: company_name || "Zonex",
            is_configured: true,
          });
        if (error) return errorResponse("Failed to save settings: " + error.message, 500);
      }

      return json({ success: true, message: "Payment settings saved" });
    }

    // ============================================================
    // WEBHOOK — Razorpay webhook handler
    // ============================================================
    if (path === "/webhook" && req.method === "POST") {
      const signature = req.headers.get("x-razorpay-signature");
      const rawBody = await req.text();

      const settings = await getPaymentSettings();
      if (!settings || !settings.razorpay_webhook_secret) {
        return errorResponse("Webhook secret not configured", 503);
      }

      // Verify webhook signature
      const { createHmac } = await import("node:crypto");
      const expectedSignature = createHmac("sha256", settings.razorpay_webhook_secret).update(rawBody).digest("hex");

      if (expectedSignature !== signature) {
        return errorResponse("Invalid webhook signature", 401);
      }

      const event = JSON.parse(rawBody);

      // Handle payment.captured event
      if (event.event === "payment.captured") {
        const payment = event.payload.payment.entity;
        const razorpayPaymentId = payment.id;
        const razorpayOrderId = payment.order_id;
        const amount = payment.amount / 100;

        // Check if already processed
        const { data: existing } = await supabase
          .from("wallet_transactions")
          .select("id")
          .eq("razorpay_payment_id", razorpayPaymentId)
          .eq("status", "success")
          .maybeSingle();

        if (!existing) {
          // Find the user from notes
          const userId = payment.notes?.user_id;
          if (userId) {
            const purpose = payment.notes?.purpose;
            if (purpose === "wallet_topup") {
              await supabase.rpc("process_wallet_credit", {
                p_user_id: userId,
                p_amount: amount,
                p_type: "deposit",
                p_description: "Wallet top-up via Razorpay webhook",
                p_razorpay_payment_id: razorpayPaymentId,
                p_razorpay_order_id: razorpayOrderId,
              });
            } else if (purpose === "purchase") {
              // Find the order by razorpay_order_id and process escrow
              const { data: order } = await supabase
                .from("orders")
                .select("*")
                .eq("razorpay_order_id", razorpayOrderId)
                .maybeSingle();
              if (order && order.status === "pending") {
                await supabase
                  .from("orders")
                  .update({
                    status: "payment_successful",
                    razorpay_payment_id: razorpayPaymentId,
                    escrow_status: "held",
                    delivery_status: "pending",
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", order.id);
                await supabase.rpc("hold_escrow", {
                  p_order_id: order.id,
                  p_buyer_id: order.buyer_id,
                  p_seller_id: order.seller_id,
                  p_total_amount: order.amount,
                  p_platform_fee: order.platform_fee,
                  p_seller_commission: order.seller_commission,
                  p_seller_payout: order.seller_payout,
                });
                await supabase
                  .from("account_listings")
                  .update({ status: "sold" })
                  .eq("id", order.listing_id);
              }
            }
          }
        }
      }

      return json({ success: true });
    }

    return errorResponse("Not found", 404);
  } catch (err: any) {
    return errorResponse(err.message || "Internal server error", 500);
  }
});
