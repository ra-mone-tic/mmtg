// Supabase Edge Function: direct-auth
// Direct sign-in for Telegram Desktop where initData may be missing.
// SECURITY: telegram_id/first_name/etc here are CLIENT-SUPPLIED and UNVERIFIED
// (no HMAC signature, unlike verify-telegram). Anyone who knows/guesses a
// telegram_id can reach this far. To prevent privilege escalation, this
// endpoint NEVER issues a session for an account that is in admin_roles —
// a valid Supabase JWT would let the caller hit `is_admin()` RPC directly
// themselves, bypassing whatever the frontend does with the JSON body.
// Regular (non-admin) accounts still get a working session, so Desktop
// keeps functioning for normal browsing even without initData.
// Real admin access must always go through verify-telegram (signed initData).
// Rate-limited: 5 attempts/min per IP + telegram_id.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Rate limiting (in-memory) ────────────────────────
const RATE_LIMIT = 5;            // max attempts per window
const WINDOW_MS  = 60_000;       // 1 minute
const rateMap    = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? "unknown";
}

function checkRateLimit(ip: string, telegramId: string): boolean {
  const key = `${ip}:${telegramId}`;
  const now = Date.now();
  const entry = rateMap.get(key);

  if (!entry || now >= entry.resetAt) {
    rateMap.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT) {
    return false;
  }

  entry.count++;
  return true;
}

// ── Periodic cleanup to prevent memory leak ──────────
// Run every 2 minutes; keep only entries that haven't expired
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateMap) {
    if (now >= entry.resetAt) rateMap.delete(key);
  }
}, 120_000);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { telegram_id, first_name, last_name, username, photo_url } = await req.json();
    const ip = getClientIp(req);
    console.log(`[AUTH_DIAG:direct-auth] start | telegram_id=${telegram_id} | username=${username ?? 'null'} | ip=${ip} | initData=absent`);

    if (!telegram_id) {
      return new Response(JSON.stringify({ error: "telegram_id required" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // ── Rate limiting check ──────────────────────────
    const rateAllowed = checkRateLimit(ip, String(telegram_id));
    console.log(`[AUTH_DIAG:direct-auth] rate_limit | ip=${ip} | telegram_id=${telegram_id} | result=${rateAllowed ? 'allowed' : 'blocked'}`);
    if (!rateAllowed) {
      return new Response(JSON.stringify({ error: "Too many requests. Try again later." }), {
        status: 429, headers: { ...CORS, "Content-Type": "application/json", "Retry-After": "60" },
      });
    }

    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botToken) {
      return new Response(JSON.stringify({ error: "TELEGRAM_BOT_TOKEN not set" }), {
        status: 500, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // ── Deterministic auth ─────────────────────────────
    const enc = new TextEncoder();
    const pwKey = await crypto.subtle.importKey(
      "raw", enc.encode(botToken),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const pwBuf = await crypto.subtle.sign("HMAC", pwKey, enc.encode(`meow_tg_${telegram_id}`));
    const password = Array.from(new Uint8Array(pwBuf))
      .map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
    const email = `tg_${telegram_id}@meow.app`;

    // ── Supabase admin client ──────────────────────────
    console.log(`[AUTH_DIAG:direct-auth] creating admin client`);
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ── Create auth user if not exists ────────────────
    let authUserId;
    try {
      console.log(`[AUTH_DIAG:direct-auth] trying createUser`);
      const { data: created } = await admin.auth.admin.createUser({
        email, password,
        email_confirm: true,
        user_metadata: { telegram_id },
      });
      authUserId = created?.user?.id;
      console.log(`[AUTH_DIAG:direct-auth] createUser result | authUserId=${authUserId ?? 'null'}`);
    } catch {
      console.log(`[AUTH_DIAG:direct-auth] createUser failed, looking up existing user`);
      const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
      authUserId = list?.users?.find(u => u.email === email)?.id;
      console.log(`[AUTH_DIAG:direct-auth] existing user lookup | authUserId=${authUserId ?? 'null'}`);
    }
    if (!authUserId) {
      console.log(`[AUTH_DIAG:direct-auth] ERROR: could not resolve auth user`);
      return new Response(JSON.stringify({ error: "Could not resolve auth user" }), {
        status: 500, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // ── SECURITY GATE: refuse BEFORE signing in if this account is an admin.
    // We must not issue any session/JWT for an admin account through this
    // unverified path — once a valid token exists, the caller can call
    // is_admin() RPC directly and there is nothing the JSON body can do
    // to prevent that. So the only safe option is: no token, ever.
    console.log(`[AUTH_DIAG:direct-auth] pre-check admin_roles before issuing any session`);
    const { data: adminRow } = await admin
      .from("admin_roles").select("role").eq("user_id", authUserId).single();

    if (adminRow) {
      console.log(`[AUTH_DIAG:direct-auth] REFUSED | telegram_id=${telegram_id} resolves to an admin account, unverified login blocked`);
      return new Response(JSON.stringify({
        error: "Admin accounts require verified Telegram initData. Unverified desktop fallback is not permitted for this account.",
        unverified: true,
      }), { status: 403, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    // ── Sign in (non-admin accounts only) ──────────────
    console.log(`[AUTH_DIAG:direct-auth] signing in | authUserId=${authUserId}`);
    const regular = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );
    const { data: signIn, error: signInErr } = await regular.auth.signInWithPassword({ email, password });
    if (signInErr || !signIn?.session) {
      console.log(`[AUTH_DIAG:direct-auth] sign-in failed | error=${signInErr?.message ?? 'null session'}`);
      return new Response(JSON.stringify({ error: "Sign-in failed" }), {
        status: 500, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    console.log(`[AUTH_DIAG:direct-auth] sign-in OK | hasSession=true`);

    // ── Upsert profile ────────────────────────────────
    console.log(`[AUTH_DIAG:direct-auth] upserting profile`);
    await admin.from("profiles").upsert({
      id: authUserId,
      telegram_id,
      username:  username  ?? null,
      first_name: first_name ?? "",
      last_name: last_name  ?? null,
      photo_url: photo_url  ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });

    // ── Load profile ──────────────────────────────────
    console.log(`[AUTH_DIAG:direct-auth] loading profile`);
    const { data: profile } = await admin
      .from("profiles").select("*").eq("id", authUserId).single();
    console.log(`[AUTH_DIAG:direct-auth] profile loaded | hasProfile=!!${!!profile}`);

    console.log(`[AUTH_DIAG:direct-auth] success_unverified | telegram_id=${telegram_id} | is_admin=false (forced, unverified path)`);

    return new Response(JSON.stringify({
      session: signIn.session,
      profile: { ...profile, is_admin: false },
      unverified: true,
    }), { headers: { ...CORS, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[direct-auth]", err);
    return new Response(
      JSON.stringify({ error: String(err?.message ?? err) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
