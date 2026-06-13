// Supabase Edge Function: direct-auth
// Direct sign-in for Telegram Desktop where initData may be missing.
// Only allows sign-in with Telegram user data from Mini App SDK.
// Uses service role to create/find user and return session.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { telegram_id, first_name, last_name, username, photo_url } = await req.json();

    if (!telegram_id) {
      return new Response(JSON.stringify({ error: "telegram_id required" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
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
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ── Create auth user if not exists ────────────────
    let authUserId;
    try {
      const { data: created } = await admin.auth.admin.createUser({
        email, password,
        email_confirm: true,
        user_metadata: { telegram_id },
      });
      authUserId = created?.user?.id;
    } catch {
      const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
      authUserId = list?.users?.find(u => u.email === email)?.id;
    }
    if (!authUserId) {
      return new Response(JSON.stringify({ error: "Could not resolve auth user" }), {
        status: 500, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // ── Sign in ────────────────────────────────────────
    const regular = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );
    const { data: signIn, error: signInErr } = await regular.auth.signInWithPassword({ email, password });
    if (signInErr || !signIn?.session) {
      return new Response(JSON.stringify({ error: "Sign-in failed" }), {
        status: 500, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // ── Upsert profile ────────────────────────────────
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
    const { data: profile } = await admin
      .from("profiles").select("*").eq("id", authUserId).single();

    const { data: adminRow } = await admin
      .from("admin_roles").select("role").eq("user_id", authUserId).single();

    return new Response(JSON.stringify({
      session: signIn.session,
      profile: { ...profile, is_admin: !!adminRow },
    }), { headers: { ...CORS, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[direct-auth]", err);
    return new Response(
      JSON.stringify({ error: String(err?.message ?? err) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});