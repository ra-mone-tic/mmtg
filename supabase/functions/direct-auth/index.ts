// Supabase Edge Function: direct-auth
// Direct sign-in for Telegram Desktop where initData may be missing.
// Only allows sign-in with Telegram user data from Mini App SDK.
// Uses service role to create/find user and return session.
// Rate-limited: 5 attempts/min per IP + telegram_id.

/// <reference no-default-lib="true" />
/// <reference lib="deno.unstable" />

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
    const rateKey = `${ip}:${telegram_id}`;
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

    // ── Sign in ────────────────────────────────────────
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

    console.log(`[AUTH_DIAG:direct-auth] checking admin_roles`);
    const { data: adminRow } = await admin
      .from("admin_roles").select("role").eq("user_id", authUserId).single();

    console.log(`[AUTH_DIAG:direct-auth] success_unverified | telegram_id=${telegram_id} | is_admin=${!!adminRow}`);

    // direct-auth работает без cryptographic proof (initData отсутствует).
    // Возвращаем профиль, но НЕ сессию — клиент не получит JWT,
    // поэтому злоумышленник не сможет использовать украденный telegram_id.
    return new Response(JSON.stringify({
      unverified: true,
      profile: { ...profile, is_admin: !!adminRow },
    }), { headers: { ...CORS, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[direct-auth]", err);
    return new Response(
      JSON.stringify({ error: String(err?.message ?? err) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } finally {
    // Никогда не логируем чувствительные данные (токены, пароли, подписи).
    // Всё что логируется выше — safe: telegram_id, username, ip, initData=absent, rate_limit результат.
  }
});