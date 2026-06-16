// Supabase Edge Function: verify-telegram
// Verifies Telegram WebApp initData, creates/finds user, returns session

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { initData } = await req.json();
    if (!initData) throw new Error("initData required");

    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN not set");

    // ── Verify HMAC-SHA256 ────────────────────────────
    // Per Telegram docs: data_check_string is built from all params EXCEPT
    // "hash" and "signature". Both must be removed before building the string.
    // "signature" is an Ed25519 field added in newer Telegram Desktop versions —
    // it is NOT part of what hash was computed over.
    const params = new URLSearchParams(initData);
    const hash   = params.get("hash");
    params.delete("hash");
    params.delete("signature"); // ← tdesktop adds this; must be excluded from HMAC check

    if (!hash) throw new Error("No hash in initData");

    const dataCheckStr = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)   // URLSearchParams auto-decodes — correct per Telegram spec
      .join("\n");

    const enc = new TextEncoder();

    // secret = HMAC-SHA256("WebAppData", bot_token)
    const webAppDataKey = await crypto.subtle.importKey(
      "raw", enc.encode("WebAppData"),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const secretBuf = await crypto.subtle.sign("HMAC", webAppDataKey, enc.encode(botToken));

    const hmacKey = await crypto.subtle.importKey(
      "raw", secretBuf,
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const sigBuf = await crypto.subtle.sign("HMAC", hmacKey, enc.encode(dataCheckStr));
    const computed = Array.from(new Uint8Array(sigBuf))
      .map(b => b.toString(16).padStart(2, "0")).join("");

    const isValid = computed === hash;
    // auth_date check — allow up to 7 days (Telegram Desktop may have stale initData)
    const authDate = parseInt(params.get("auth_date") ?? "0");
    const stale    = authDate > 0 && (Date.now() / 1000 - authDate) > 604800; // 7 days

    if (!isValid || stale) {
      return new Response(
        JSON.stringify({
          error: !isValid ? "Invalid signature" : "initData expired (>7 days)",
        }),
        { status: 401, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // ── Parse Telegram user ───────────────────────────
    const userStr = params.get("user");
    if (!userStr) throw new Error("No user data in initData");
    const tgUser = JSON.parse(userStr) as {
      id: number; username?: string; first_name?: string; last_name?: string; photo_url?: string;
    };

    // ── Supabase admin client ─────────────────────────
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Derive deterministic password: HMAC(botToken, "meow_tg_{id}")
    const pwKey = await crypto.subtle.importKey(
      "raw", enc.encode(botToken),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const pwBuf  = await crypto.subtle.sign("HMAC", pwKey, enc.encode(`meow_tg_${tgUser.id}`));
    const password = Array.from(new Uint8Array(pwBuf))
      .map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
    const email = `tg_${tgUser.id}@meow.app`;

    // ── Create auth user if not exists ────────────────
    // NOTE: Supabase JS v2 never throws — always returns { data, error }.
    // So we check the error field explicitly instead of relying on try/catch.
    let authUserId: string | undefined;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { telegram_id: tgUser.id },
    });
    if (created?.user?.id) {
      // Fresh user — just created successfully
      authUserId = created.user.id;
    } else {
      // User already exists (or other non-fatal error) — look up by email
      console.warn("[verify-telegram] createUser did not return user, looking up existing:", createErr?.message);
      const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
      authUserId = list?.users?.find(u => u.email === email)?.id;
    }
    if (!authUserId) throw new Error("Could not resolve auth user");

    // ── Sign in to get session ────────────────────────
    const regular = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );
    const { data: signIn, error: signInErr } = await regular.auth.signInWithPassword({ email, password });
    if (signInErr || !signIn?.session) throw signInErr ?? new Error("Sign-in failed");

    // ── Upsert profile ────────────────────────────────
    await admin.from("profiles").upsert({
      id:         authUserId,
      telegram_id: tgUser.id,
      username:   tgUser.username   ?? null,
      first_name: tgUser.first_name ?? "",
      last_name:  tgUser.last_name  ?? null,
      photo_url:  tgUser.photo_url  ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });

    // ── Load full profile ─────────────────────────────
    const { data: profile } = await admin
      .from("profiles").select("*").eq("id", authUserId).single();

    const { data: adminRow } = await admin
      .from("admin_roles").select("role").eq("user_id", authUserId).single();

    return new Response(JSON.stringify({
      session: signIn.session,
      profile: { ...profile, is_admin: !!adminRow },
    }), { headers: { ...CORS, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[verify-telegram]", err);
    return new Response(
      JSON.stringify({ error: String(err?.message ?? err) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
