// Supabase Edge Function: verify-telegram
// Verifies Telegram WebApp initData, creates/finds user, returns session

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function computeHmac(dataCheckStr: string, botToken: string): Promise<string> {
  const enc = new TextEncoder();
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
  return Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  console.log("[verify-telegram] handler started");

  try {
    const { initData } = await req.json();
    if (!initData) throw new Error("initData required");

    const botTokenRaw = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botTokenRaw) throw new Error("TELEGRAM_BOT_TOKEN not set");
    const botToken = botTokenRaw.trim(); // убираем невидимые символы по краям

    console.log("[verify-telegram] token raw_len:", botTokenRaw.length, "trimmed_len:", botToken.length);
    console.log("[verify-telegram] token first10:", JSON.stringify(botToken.slice(0, 10)));
    console.log("[verify-telegram] token last5:", JSON.stringify(botToken.slice(-5)));

    // ── Telegram initData verification ─────────────────────────────────────────
    // Telegram Bot API requires:
    //   1. Sort all key=value pairs alphabetically by key (except "hash")
    //   2. Join with \n into data_check_string
    //   3. Compute HMAC-SHA256(data_check_string, secret_key)
    //      where secret_key = HMAC-SHA256("WebAppData", botToken)
    //   4. Compare computed hash with the "hash" parameter
    //
    // IMPORTANT: All parameters EXCEPT "hash" must be included.
    // Previously "signature" was excluded, causing hash mismatch.

    const pairs = initData.split("&").filter(Boolean);
    const paramMap = new Map<string, string>();
    let hash: string | null = null;

    for (const pair of pairs) {
      const eq = pair.indexOf("=");
      if (eq === -1) continue;
      const k = pair.slice(0, eq);
      const v = pair.slice(eq + 1);
      if (k === "hash") {
        hash = v;
      } else {
        paramMap.set(k, v);
      }
    }

    if (!hash) throw new Error("No hash in initData");

    const dataCheckStr = [...paramMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    const computed = await computeHmac(dataCheckStr, botToken);

    console.log("[verify-telegram] expected hash:", hash);
    console.log("[verify-telegram] computed hash: ", computed, "match:", computed === hash);
    console.log("[verify-telegram] dataCheckStr:", dataCheckStr);

    const isValid = computed === hash;

    const authDateRaw = paramMap.get("auth_date");
    const authDate = authDateRaw ? parseInt(decodeURIComponent(authDateRaw), 10) : 0;
    const stale    = authDate > 0 && (Date.now() / 1000 - authDate) > 604800;

    console.log("[verify-telegram] isValid:", isValid, "stale:", stale);

    if (!isValid || stale) {
      return new Response(
        JSON.stringify({ error: !isValid ? "Invalid signature" : "initData expired (>7 days)" }),
        { status: 401, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // ── Parse Telegram user ───────────────────────────────────────────────────
    const userStrRaw = paramMap.get("user");
    if (!userStrRaw) throw new Error("No user data in initData");
    const userStr = decodeURIComponent(userStrRaw);
    const tgUser = JSON.parse(userStr) as {
      id: number; username?: string; first_name?: string; last_name?: string; photo_url?: string;
    };

    // ── Supabase admin client ─────────────────────────────────────────────────
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const enc = new TextEncoder();

    const pwKey = await crypto.subtle.importKey(
      "raw", enc.encode(botToken),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const pwBuf  = await crypto.subtle.sign("HMAC", pwKey, enc.encode(`meow_tg_${tgUser.id}`));
    const password = Array.from(new Uint8Array(pwBuf))
      .map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
    const email = `tg_${tgUser.id}@meow.app`;

    // ── Create auth user if not exists ────────────────────────────────────────
    let authUserId: string | undefined;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { telegram_id: tgUser.id },
    });
    if (created?.user?.id) {
      authUserId = created.user.id;
    } else {
      console.warn("[verify-telegram] createUser lookup fallback:", createErr?.message);
      const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
      authUserId = list?.users?.find(u => u.email === email)?.id;
    }
    if (!authUserId) throw new Error("Could not resolve auth user");

    // ── Sign in to get session ────────────────────────────────────────────────
    const regular = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );
    const { data: signIn, error: signInErr } = await regular.auth.signInWithPassword({ email, password });
    if (signInErr || !signIn?.session) throw signInErr ?? new Error("Sign-in failed");

    // ── Upsert profile ────────────────────────────────────────────────────────
    await admin.from("profiles").upsert({
      id:          authUserId,
      telegram_id: tgUser.id,
      username:    tgUser.username   ?? null,
      first_name:  tgUser.first_name ?? "",
      last_name:   tgUser.last_name  ?? null,
      photo_url:   tgUser.photo_url  ?? null,
      updated_at:  new Date().toISOString(),
    }, { onConflict: "id" });

    const { data: profile } = await admin
      .from("profiles").select("*").eq("id", authUserId).single();

    const { data: adminRow } = await admin
      .from("admin_roles").select("role").eq("user_id", authUserId).single();

    console.log("[verify-telegram] success, userId:", authUserId);

    return new Response(JSON.stringify({
      session: signIn.session,
      profile: { ...profile, is_admin: !!adminRow },
    }), { headers: { ...CORS, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[verify-telegram] ERROR:", String(err?.message ?? err));
    return new Response(
      JSON.stringify({ error: String(err?.message ?? err) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
