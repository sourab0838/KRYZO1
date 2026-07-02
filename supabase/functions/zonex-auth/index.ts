import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import bcrypt from "npm:bcryptjs@2.4.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resendApiKey = Deno.env.get("RESEND_API_KEY");
const fromEmail = "noreply@kryzostore.com";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const OTP_EXPIRY_MINUTES = 5;
const OTP_RESEND_COOLDOWN_SEC = 60;
const OTP_RATE_LIMIT_PER_HOUR = 10;
const MAX_OTP_ATTEMPTS = 5;
const PENDING_REGISTRATION_EXPIRY_MINUTES = 30;

// Simple encryption for storing password temporarily
const ENCRYPTION_KEY = Deno.env.get("ENCRYPTION_KEY") || supabaseServiceKey.substring(0, 32);

async function encrypt(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(ENCRYPTION_KEY.substring(0, 32)),
    "AES-GCM",
    false,
    ["encrypt"]
  );
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    keyMaterial,
    data
  );
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function decrypt(encryptedBase64: string): Promise<string> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(ENCRYPTION_KEY.substring(0, 32)),
    "AES-GCM",
    false,
    ["decrypt"]
  );
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    keyMaterial,
    data
  );
  return decoder.decode(decrypted);
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400) {
  return json({ error: message }, status);
}

function generateOtp(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return (arr[0] % 900000 + 100000).toString();
}

interface EmailResult { ok: boolean; error?: string; }

async function sendEmailOtp(to: string, code: string, purpose: string): Promise<EmailResult> {
  if (!resendApiKey) return { ok: false, error: "RESEND_API_KEY secret is not set in the Edge Function environment." };
  const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#ffffff;color:#000000;margin:0;padding:24px 0">
    <div style="max-width:420px;margin:0 auto;padding:0">
      <p style="font-size:15px;line-height:1.5;margin:0 0 16px">Hello,</p>
      <p style="font-size:15px;line-height:1.5;margin:0 0 24px">Your verification code is:</p>
      <p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:0 0 24px;text-align:left">${code}</p>
      <p style="font-size:15px;line-height:1.5;margin:0 0 8px">Use this code to verify your email.</p>
      <p style="font-size:15px;line-height:1.5;margin:0 0 24px">This code expires in ${OTP_EXPIRY_MINUTES} minutes.</p>
      <p style="font-size:15px;line-height:1.5;margin:0 0 24px">If you didn't request this code, ignore this email.</p>
      <p style="font-size:15px;line-height:1.5;margin:0">Regards,<br>KryzoStore Team</p>
    </div>
  </body></html>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: fromEmail, to: [to], subject: "KryzoStore – Your Verification Code", html }),
    });
    if (res.ok) return { ok: true };
    let errBody: any = null;
    try { errBody = await res.json(); } catch { try { errBody = await res.text(); } catch { /* ignore */ } }
    const msg = errBody?.message || errBody?.error || (typeof errBody === "string" ? errBody : JSON.stringify(errBody)) || `HTTP ${res.status}`;
    return { ok: false, error: `Resend API error (${res.status}): ${msg}` };
  } catch (err: any) {
    return { ok: false, error: `Network/exception calling Resend: ${err?.message || String(err)}` };
  }
}

async function cleanup() {
  try {
    await supabaseAdmin.from("pending_registrations").delete().lt("expires_at", new Date().toISOString());
    await supabaseAdmin.from("otp_codes").delete().lt("expires_at", new Date().toISOString());
  } catch { /* ignore */ }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/zonex-auth\/?/, "") || "/";
    const body = req.method === "POST" ? await req.json() : {};

    await cleanup();

    // ---- SEND OTP (for registration or password reset) ----
    if (path === "send-otp") {
      const { email, purpose = "registration" } = body;
      if (!email) return errorResponse("Email is required.");

      const emailLower = email.toLowerCase();

      if (purpose === "registration") {
        const { data: existing } = await supabaseAdmin
          .from("profiles").select("id").eq("email", emailLower).maybeSingle();
        if (existing) return errorResponse("An account with this email already exists.");
      }

      if (purpose === "password_reset") {
        const { data: existing } = await supabaseAdmin
          .from("profiles").select("id").eq("email", emailLower).maybeSingle();
        if (!existing) return errorResponse("No account found with this email.");
      }

      const { data: recentOtp } = await supabaseAdmin
        .from("otp_codes").select("created_at")
        .eq("email", emailLower).eq("purpose", purpose)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (recentOtp) {
        const elapsed = (Date.now() - new Date(recentOtp.created_at).getTime()) / 1000;
        if (elapsed < OTP_RESEND_COOLDOWN_SEC) {
          const wait = Math.ceil(OTP_RESEND_COOLDOWN_SEC - elapsed);
          return errorResponse(`Please wait ${wait} seconds before requesting a new OTP.`);
        }
      }

      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count: otpCount } = await supabaseAdmin
        .from("otp_codes").select("*", { count: "exact", head: true })
        .eq("email", emailLower).gte("created_at", oneHourAgo);
      if (otpCount && otpCount >= OTP_RATE_LIMIT_PER_HOUR) {
        return errorResponse("Too many OTP requests. Please try again later.");
      }

      const code = generateOtp();
      const codeHash = await bcrypt.hash(code, 10);
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

      await supabaseAdmin.from("otp_codes")
        .update({ consumed: true })
        .eq("email", emailLower).eq("purpose", purpose).eq("consumed", false);

      const { error: insertError } = await supabaseAdmin.from("otp_codes").insert({
        email: emailLower,
        code_hash: codeHash,
        purpose,
        expires_at: expiresAt,
      });
      if (insertError) throw new Error("Failed to store OTP.");

      const emailResult = await sendEmailOtp(emailLower, code, purpose);

      return json({
        success: true,
        message: emailResult.ok ? "OTP sent to your email." : `OTP generated but email delivery failed: ${emailResult.error}`,
        emailSent: emailResult.ok,
        ...(emailResult.ok ? {} : { devOtp: code, emailError: emailResult.error }),
      });
    }

    // ---- VERIFY OTP ----
    if (path === "verify-otp") {
      const { email, otp, purpose = "registration" } = body;
      if (!email || !otp) return errorResponse("Email and OTP are required.");

      const emailLower = email.toLowerCase();

      const { data: otpRecord } = await supabaseAdmin
        .from("otp_codes").select("*")
        .eq("email", emailLower).eq("purpose", purpose).eq("consumed", false)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();

      if (!otpRecord) return errorResponse("No valid OTP found. Please request a new one.");
      if (new Date(otpRecord.expires_at) < new Date()) return errorResponse("OTP has expired. Please request a new one.");
      if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) return errorResponse("Too many failed attempts. Please request a new OTP.");

      const otpValid = await bcrypt.compare(otp, otpRecord.code_hash);
      if (!otpValid) {
        await supabaseAdmin.from("otp_codes").update({ attempts: otpRecord.attempts + 1 }).eq("id", otpRecord.id);
        return errorResponse("Invalid OTP. Please check and try again.");
      }

      await supabaseAdmin.from("otp_codes").update({ consumed: true }).eq("id", otpRecord.id);

      return json({ success: true, message: "OTP verified successfully." });
    }

    // ---- REGISTER (step 1: store data + send OTP) ----
    if (path === "register") {
      const { fullName, username, email, phoneCountryCode, phoneNumber, password } = body;
      if (!fullName || !username || !email || !phoneNumber || !password) {
        return errorResponse("All fields are required.");
      }
      if (password.length < 8) return errorResponse("Password must be at least 8 characters.");

      const emailLower = email.toLowerCase();
      const usernameLower = username.toLowerCase();

      const { data: emailExists } = await supabaseAdmin
        .from("profiles").select("id").eq("email", emailLower).maybeSingle();
      if (emailExists) return errorResponse("An account with this email already exists.");

      const { data: usernameExists } = await supabaseAdmin
        .from("profiles").select("id").eq("username", usernameLower).maybeSingle();
      if (usernameExists) return errorResponse("This username is already taken.");

      const { data: phoneExists } = await supabaseAdmin
        .from("profiles").select("id")
        .eq("phone_country_code", phoneCountryCode || "+91")
        .eq("phone_number", phoneNumber).maybeSingle();
      if (phoneExists) return errorResponse("This phone number is already registered.");

      // Encrypt password for temporary storage
      const encryptedPassword = await encrypt(password);
      const expiresAt = new Date(Date.now() + PENDING_REGISTRATION_EXPIRY_MINUTES * 60 * 1000).toISOString();

      await supabaseAdmin.from("pending_registrations").upsert({
        email: emailLower,
        username: usernameLower,
        full_name: fullName,
        phone_country_code: phoneCountryCode || "+91",
        phone_number: phoneNumber,
        password_hash: encryptedPassword,
        expires_at: expiresAt,
      }, { onConflict: "email" });

      // Generate and store OTP
      const code = generateOtp();
      const codeHash = await bcrypt.hash(code, 10);
      const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

      await supabaseAdmin.from("otp_codes")
        .update({ consumed: true })
        .eq("email", emailLower).eq("purpose", "registration").eq("consumed", false);

      const { error: otpInsertError } = await supabaseAdmin.from("otp_codes").insert({
        email: emailLower,
        code_hash: codeHash,
        purpose: "registration",
        expires_at: otpExpiresAt,
      });
      if (otpInsertError) throw new Error("Failed to store OTP.");

      const emailResult = await sendEmailOtp(emailLower, code, "registration");

      return json({
        success: true,
        message: emailResult.ok
          ? "OTP sent to your email. Please check your inbox."
          : `Account data saved but email delivery failed: ${emailResult.error}`,
        emailSent: emailResult.ok,
        ...(emailResult.ok ? {} : { devOtp: code, emailError: emailResult.error }),
      });
    }

    // ---- COMPLETE REGISTRATION (step 2: verify OTP + create user) ----
    if (path === "complete-registration") {
      const { email, otp } = body;
      if (!email || !otp) return errorResponse("Email and OTP are required.");

      const emailLower = email.toLowerCase();

      // Verify OTP
      const { data: otpRecord } = await supabaseAdmin
        .from("otp_codes").select("*")
        .eq("email", emailLower).eq("purpose", "registration").eq("consumed", false)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();

      if (!otpRecord) return errorResponse("No valid OTP found. Please request a new one.");
      if (new Date(otpRecord.expires_at) < new Date()) return errorResponse("OTP has expired. Please request a new one.");
      if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) return errorResponse("Too many failed attempts. Please request a new OTP.");

      const otpValid = await bcrypt.compare(otp, otpRecord.code_hash);
      if (!otpValid) {
        await supabaseAdmin.from("otp_codes").update({ attempts: otpRecord.attempts + 1 }).eq("id", otpRecord.id);
        return errorResponse("Invalid OTP. Please check and try again.");
      }

      await supabaseAdmin.from("otp_codes").update({ consumed: true }).eq("id", otpRecord.id);

      // Get pending registration data
      const { data: pending } = await supabaseAdmin
        .from("pending_registrations").select("*")
        .eq("email", emailLower).maybeSingle();

      if (!pending) return errorResponse("Registration data not found. Please start over.");
      if (new Date(pending.expires_at) < new Date()) {
        await supabaseAdmin.from("pending_registrations").delete().eq("id", pending.id);
        return errorResponse("Registration session expired. Please start over.");
      }

      // Decrypt password
      const rawPassword = await decrypt(pending.password_hash);

      // Re-check duplicates
      const { data: emailExists } = await supabaseAdmin
        .from("profiles").select("id").eq("email", emailLower).maybeSingle();
      if (emailExists) return errorResponse("An account with this email already exists.");

      const { data: usernameExists } = await supabaseAdmin
        .from("profiles").select("id").eq("username", pending.username).maybeSingle();
      if (usernameExists) return errorResponse("This username is already taken.");

      // Create Supabase Auth user (auto-confirmed since OTP was verified)
      const { data: newAuthUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: emailLower,
        password: rawPassword,
        email_confirm: true,
        user_metadata: {
          full_name: pending.full_name,
          username: pending.username,
          phone_country_code: pending.phone_country_code,
          phone_number: pending.phone_number,
        },
      });

      if (authError) {
        if (authError.message.includes("already registered")) {
          return errorResponse("An account with this email already exists.");
        }
        return errorResponse(authError.message);
      }

      if (!newAuthUser.user) return errorResponse("Failed to create user account.");

      // Clean up pending registration and stored password
      await supabaseAdmin.from("pending_registrations").delete().eq("id", pending.id);

      // Create welcome notifications
      await supabaseAdmin.rpc("create_notification", {
        p_user_id: newAuthUser.user.id,
        p_type: "registration",
        p_title: "Welcome to Zonex!",
        p_message: `Hi ${pending.full_name}, your account has been created successfully.`,
      });
      await supabaseAdmin.rpc("create_notification", {
        p_user_id: newAuthUser.user.id,
        p_type: "email_otp",
        p_title: "Email Verified",
        p_message: "Your email address was verified during registration.",
      });

      // Get profile
      const { data: profile } = await supabaseAdmin
        .from("profiles").select("username, full_name")
        .eq("id", newAuthUser.user.id).maybeSingle();

      return json({
        success: true,
        message: "Account created successfully!",
        user: {
          id: newAuthUser.user.id,
          email: newAuthUser.user.email,
          username: profile?.username || pending.username,
          fullName: profile?.full_name || pending.full_name,
        },
      });
    }

    // ---- LOGIN ----
    if (path === "login") {
      const { identifier, password } = body;
      if (!identifier || !password) return errorResponse("Email/username and password are required.");

      let loginEmail = identifier.toLowerCase();
      if (!identifier.includes("@")) {
        const { data: profile } = await supabaseAdmin
          .from("profiles").select("email")
          .eq("username", identifier.toLowerCase()).maybeSingle();
        if (!profile) return errorResponse("Invalid credentials.");
        loginEmail = profile.email;
      }

      const { data: profile } = await supabaseAdmin
        .from("profiles").select("id, full_name, username")
        .eq("email", loginEmail).maybeSingle();
      if (!profile) return errorResponse("Invalid credentials.");

      const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(profile.id);
      if (authUser?.user_metadata?.is_banned) return errorResponse("Your account has been banned. Contact support.");
      if (authUser?.user_metadata?.is_suspended) return errorResponse("Your account has been suspended. Contact support.");

      const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        auth: { persistSession: false },
      });

      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

      if (error) {
        if (error.message.includes("Email not confirmed")) {
          return errorResponse("Please verify your email first.");
        }
        return errorResponse("Invalid credentials.");
      }

      await supabaseAdmin.rpc("log_login_event", {
        p_user_id: data.user.id,
        p_ip_address: req.headers.get("x-forwarded-for") || "unknown",
        p_user_agent: req.headers.get("user-agent") || "unknown",
        p_device_info: "SUCCESS",
      });

      await supabaseAdmin.rpc("create_notification", {
        p_user_id: data.user.id,
        p_type: "login",
        p_title: "New Login",
        p_message: "A successful login was recorded on your account.",
      });

      return json({
        success: true,
        message: "Login successful!",
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
        },
        user: {
          id: data.user.id,
          email: data.user.email,
          username: profile.username,
          fullName: profile.full_name,
        },
      });
    }

    // ---- FORGOT PASSWORD ----
    if (path === "forgot-password") {
      const { email } = body;
      if (!email) return errorResponse("Email is required.");

      const emailLower = email.toLowerCase();

      const { data: profile } = await supabaseAdmin
        .from("profiles").select("id").eq("email", emailLower).maybeSingle();
      if (!profile) return errorResponse("No account found with this email.");

      const { data: recentOtp } = await supabaseAdmin
        .from("otp_codes").select("created_at")
        .eq("email", emailLower).eq("purpose", "password_reset")
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (recentOtp) {
        const elapsed = (Date.now() - new Date(recentOtp.created_at).getTime()) / 1000;
        if (elapsed < OTP_RESEND_COOLDOWN_SEC) {
          const wait = Math.ceil(OTP_RESEND_COOLDOWN_SEC - elapsed);
          return errorResponse(`Please wait ${wait} seconds before requesting a new code.`);
        }
      }

      const code = generateOtp();
      const codeHash = await bcrypt.hash(code, 10);
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

      await supabaseAdmin.from("otp_codes").update({ consumed: true })
        .eq("email", emailLower).eq("purpose", "password_reset").eq("consumed", false);

      await supabaseAdmin.from("otp_codes").insert({
        email: emailLower, code_hash: codeHash, purpose: "password_reset", expires_at: expiresAt,
      });

      const emailResult = await sendEmailOtp(emailLower, code, "password_reset");

      await supabaseAdmin.rpc("create_notification", {
        p_user_id: profile.id,
        p_type: "password_reset",
        p_title: "Password Reset Requested",
        p_message: "A password reset code was requested for your account.",
      });

      return json({
        success: true,
        message: emailResult.ok
          ? "Password reset code sent to your email."
          : `Reset code generated but email delivery failed: ${emailResult.error}`,
        emailSent: emailResult.ok,
        ...(emailResult.ok ? {} : { devOtp: code, emailError: emailResult.error }),
      });
    }

    // ---- RESET PASSWORD ----
    if (path === "reset-password") {
      const { email, otp, newPassword } = body;
      if (!email || !otp || !newPassword) return errorResponse("Email, OTP, and new password are required.");
      if (newPassword.length < 8) return errorResponse("Password must be at least 8 characters.");

      const emailLower = email.toLowerCase();

      const { data: otpRecord } = await supabaseAdmin
        .from("otp_codes").select("*")
        .eq("email", emailLower).eq("purpose", "password_reset").eq("consumed", false)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();

      if (!otpRecord) return errorResponse("No valid reset code found. Please request a new one.");
      if (new Date(otpRecord.expires_at) < new Date()) return errorResponse("Reset code has expired. Please request a new one.");
      if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) return errorResponse("Too many failed attempts. Please request a new code.");

      const otpValid = await bcrypt.compare(otp, otpRecord.code_hash);
      if (!otpValid) {
        await supabaseAdmin.from("otp_codes").update({ attempts: otpRecord.attempts + 1 }).eq("id", otpRecord.id);
        return errorResponse("Invalid reset code.");
      }

      await supabaseAdmin.from("otp_codes").update({ consumed: true }).eq("id", otpRecord.id);

      const { data: profile } = await supabaseAdmin
        .from("profiles").select("id").eq("email", emailLower).maybeSingle();
      if (!profile) return errorResponse("User not found.");

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(profile.id, {
        password: newPassword,
      });
      if (updateError) return errorResponse(updateError.message || "Failed to update password.");

      await supabaseAdmin.auth.admin.signOut(profile.id, "global");

      await supabaseAdmin.rpc("create_notification", {
        p_user_id: profile.id,
        p_type: "password_reset",
        p_title: "Password Changed",
        p_message: "Your password was successfully reset. All sessions have been logged out.",
      });

      return json({ success: true, message: "Password reset successfully! Please log in with your new password." });
    }

    // ---- REFRESH SESSION ----
    if (path === "refresh-session") {
      const { refreshToken } = body;
      if (!refreshToken) return errorResponse("Refresh token is required.", 401);

      const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        auth: { persistSession: false },
      });

      const { data, error } = await supabaseClient.auth.refreshSession({ refresh_token: refreshToken });
      if (error || !data.session) return errorResponse("Invalid or expired refresh token.", 401);

      const { data: profile } = await supabaseAdmin
        .from("profiles").select("username, full_name").eq("id", data.user!.id).maybeSingle();

      return json({
        success: true,
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
        },
        user: {
          id: data.user!.id,
          email: data.user!.email,
          username: profile?.username,
          fullName: profile?.full_name,
        },
      });
    }

    // ---- SESSION ----
    if (path === "session") {
      const authHeader = req.headers.get("authorization");
      if (!authHeader?.startsWith("Bearer ")) return errorResponse("No authorization header.", 401);

      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !user) return errorResponse("Invalid or expired session.", 401);

      const { data: profile } = await supabaseAdmin
        .from("profiles").select("username, full_name").eq("id", user.id).maybeSingle();

      return json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          username: profile?.username,
          fullName: profile?.full_name,
        },
      });
    }

    // ---- LOGOUT ----
    if (path === "logout") {
      const authHeader = req.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.replace("Bearer ", "");
        await supabaseAdmin.auth.admin.signOut(token);
      }
      return json({ success: true, message: "Logged out successfully." });
    }

    return errorResponse("Not found.", 404);
  } catch (err: any) {
    return errorResponse(err.message || "Internal server error.", 500);
  }
});
