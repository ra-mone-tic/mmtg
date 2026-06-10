// Supabase Edge Function: report-bug
// Stores report in DB, forwards to Telegram admin chat.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const auth = req.headers.get("authorization") ?? "";
    const jwt  = auth.replace("Bearer ", "").trim();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey     = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const botToken    = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const adminChatId = Deno.env.get("TELEGRAM_ADMIN_CHAT_ID");

    // User-context client to get current user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: { user } } = await userClient.auth.getUser();

    const { type, target_type, target_id, text } = await req.json();
    if (!text || text.length < 5) throw new Error("Report text too short");

    // ── Store report ──────────────────────────────────
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: report } = await admin.from("reports").insert({
      user_id:     user?.id ?? null,
      type:        type ?? "bug",
      target_type: target_type ?? null,
      target_id:   target_id   ?? null,
      text,
      status: "new",
    }).select().single();

    // ── Forward to Telegram admin chat ────────────────
    if (botToken && adminChatId) {
      let profileInfo = "Анонимно";
      if (user?.id) {
        const { data: p } = await admin
          .from("profiles").select("first_name, username, telegram_id")
          .eq("id", user.id).single();
        if (p) {
          profileInfo = [
            p.username ? `@${p.username}` : p.first_name,
            p.telegram_id ? `(tg:${p.telegram_id})` : "",
          ].join(" ").trim();
        }
      }

      const typeLabels: Record<string, string> = {
        bug: "🐛 Баг", wrong_info: "❌ Неверная инфо",
        spam: "🚫 Спам", other: "💬 Другое",
      };

      const msg = [
        `📢 *Новая жалоба* [#${report?.id?.slice(0,8) ?? "—"}]`,
        `Тип: ${typeLabels[type] ?? type}`,
        target_type && target_id ? `Объект: ${target_type} \`${target_id}\`` : "",
        `От: ${profileInfo}`,
        ``,
        `📝 ${text}`,
      ].filter(Boolean).join("\n");

      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id:    adminChatId,
          text:       msg,
          parse_mode: "Markdown",
        }),
      });
    }

    return new Response(
      JSON.stringify({ ok: true, report_id: report?.id }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[report-bug]", err);
    return new Response(
      JSON.stringify({ error: String(err?.message ?? err) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
