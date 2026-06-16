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
    // IMPORTANT: Parse initData manually to preserve RAW URL-encoded values.
    // URLSearchParams auto-decodes (%7B → {), which breaks HMAC verification
    // because Telegram signs the RAW encoded string.
    const rawPairs  = initData.split("&").filter(Boolean);
    const rawParams = new Map<string, string>();
    let hash: string | null = null;

    for (const pair of rawPairs) {
      const eqIdx = pair.indexOf("=");
      if (eqIdx === -1) continue;
      const key = pair.slice(0, eqIdx);
      const rawVal = pair.slice(eqIdx + 1); // keep URL-encoded as-is
      if (key === "hash") {
        hash = decodeURIComponent(rawVal);
      } else if (key !== "signature") {
        rawParams.set(key, rawVal);
      }
    }

    if (!hash) throw new Error("No hash in initData");

    const dataCheckStr = [...rawParams.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)   // raw encoded values – matches Telegram signature
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
    const authDate = parseInt(decodeURIComponent(rawParams.get("auth_date") ?? "0"));
    const stale    = authDate > 0 && (Date.now() / 1000 - authDate) > 604800; // 7 days

    if (!isValid || stale) {
      const isDev = Deno.env.get("ENVIRONMENT") !== "production";
      console.warn(`[verify-telegram] isValid=${isValid} stale=${stale} authDate=${authDate}`);
      if (!isDev) {
        return new Response(
          JSON.stringify({ error: !isValid ? "Invalid signature" : "initData expired (>7 days)" }),
          { status: 401, headers: { ...CORS, "Content-Type": "application/json" } }
        );
      }
    }

    // ── Parse Telegram user ───────────────────────────
    const userRaw = rawParams.get("user");
    if (!userRaw) throw new Error("No user data in initData");
    const tgUser = JSON.parse(decodeURIComponent(userRaw)) as {
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
    let authUserId: string | undefined;
    try {
      const { data: created } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { telegram_id: tgUser.id },
      });
      authUserId = created?.user?.id;
    } catch (_) {
      // User already exists — find by email
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
