// Supabase Edge Function: sync-events
// Accepts events/places arrays and upserts into Supabase DB.
// Called by Python parser (src/processor.py) via HTTP POST.
// Requires Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // Require service role key
  const auth = req.headers.get("authorization") ?? "";
  const key  = auth.replace("Bearer ", "").trim();
  if (key !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  try {
    const { events = [], places = [] } = await req.json();
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    let eventsUpserted = 0, placesUpserted = 0;

    // ── Upsert events ─────────────────────────────────
    if (events.length) {
      const rows = events.map((e: Record<string, unknown>) => ({
        id:                 e.id,
        date:               e.date,
        title:              e.title,
        location:           e.location ?? "",
        address:            e.address  ?? "",
        time:               e.time     ?? "",
        tags:               Array.isArray(e.tags) ? e.tags : [],
        short_description:  e.short_description  ?? "",
        full_description:   e.full_description   ?? "",
        description_blocks: Array.isArray(e.description_blocks) ? e.description_blocks : [],
        contacts:           e.contacts   ?? "",
        lat:                e.lat        ?? null,
        lon:                e.lon        ?? null,
        image_url:          e.imageUrl   ?? e.image_url ?? null,
        tg_message_id:      e.tg_message_id ?? null,
        is_active:          true,
        updated_at:         new Date().toISOString(),
      }));

      const { error } = await admin.from("events").upsert(rows, { onConflict: "id" });
      if (error) throw error;
      eventsUpserted = rows.length;
    }

    // ── Upsert places ─────────────────────────────────
    if (places.length) {
      const rows = places.map((p: Record<string, unknown>) => ({
        id:          p.id,
        name:        p.name,
        lat:         p.lat        ?? null,
        lng:         p.lng        ?? null,
        address:     p.address    ?? "",
        description: p.description ?? "",
        time:        p.time       ?? "",
        image_url:   p.imageUrl   ?? p.image_url ?? null,
        keywords:    Array.isArray(p.keywords) ? p.keywords : [],
        is_active:   true,
        updated_at:  new Date().toISOString(),
      }));

      const { error } = await admin.from("places").upsert(rows, { onConflict: "id" });
      if (error) throw error;
      placesUpserted = rows.length;
    }

    return new Response(
      JSON.stringify({ ok: true, events: eventsUpserted, places: placesUpserted }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[sync-events]", err);
    return new Response(
      JSON.stringify({ error: String(err?.message ?? err) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
