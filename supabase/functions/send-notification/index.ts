// Supabase Edge Function: send-notification
// Sends a Telegram bot message AND writes a notification record.
// Called by backend logic (triggers can use pg_net, or call directly from app).

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const {
      user_id,       // Supabase UUID of recipient
      type,          // notification type
      title,
      body,
      data = {},
    } = await req.json();

    if (!user_id || !type) throw new Error("user_id and type required");

    const botToken    = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── Insert notification record ────────────────────
    const { data: notif, error: notifErr } = await admin
      .from("notifications")
      .insert({ user_id, type, title, body, data, read: false })
      .select().single();
    if (notifErr) throw notifErr;

    let sentViaBot = false;

    // ── Send Telegram message if bot token set ────────
    if (botToken) {
      const { data: profile } = await admin
        .from("profiles")
        .select("telegram_id")
        .eq("id", user_id)
        .single();

      if (profile?.telegram_id) {
        const text = [
          title ? `*${title}*` : "",
          body ?? "",
        ].filter(Boolean).join("\n");

        const tgRes = await fetch(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id:    profile.telegram_id,
              text,
              parse_mode: "Markdown",
            }),
          }
        );
        sentViaBot = (await tgRes.json()).ok === true;

        if (sentViaBot) {
          await admin.from("notifications")
            .update({ sent_via_bot: true })
            .eq("id", notif.id);
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, notification_id: notif.id, sent_via_bot: sentViaBot }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[send-notification]", err);
    return new Response(
      JSON.stringify({ error: String(err?.message ?? err) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
