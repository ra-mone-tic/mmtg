// Supabase Edge Function: manage-admin
// Allows an admin to add/remove other admins.
// Only existing admins can use this function.

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
    const userToken = auth.replace("Bearer ", "").trim();
    if (!userToken) {
      return new Response(JSON.stringify({ error: "No token" }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, target_user_id } = body; // action: "add" | "remove" | "list"

    if (!action) {
      return new Response(JSON.stringify({ error: "action required" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    if (!["add", "remove", "list"].includes(action)) {
      return new Response(JSON.stringify({ error: "action must be 'add', 'remove', or 'list'" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Verify caller's token and check if they are admin
    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );

    const { data: { user }, error: userErr } = await anon.auth.getUser(userToken);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Use service role to bypass RLS
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Check if caller is an admin (using service role to avoid recursion)
    const { data: callerRow } = await admin
      .from("admin_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!callerRow) {
      return new Response(JSON.stringify({ error: "Only admins can manage roles" }), {
        status: 403, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // ── List all admins with profiles ───────────────
    if (action === "list") {
      const { data: adminRoles, error: listErr } = await admin
        .from("admin_roles")
        .select("user_id, role, created_at");

      if (listErr) throw listErr;

      const adminIds = (adminRoles || []).map(a => a.user_id);
      let adminProfiles = [];
      if (adminIds.length) {
        const { data: profiles } = await admin
          .from("profiles")
          .select("id, first_name, last_name, username, photo_url")
          .in("id", adminIds);
        adminProfiles = profiles || [];
      }

      return new Response(JSON.stringify({
        ok: true,
        admins: adminRoles || [],
        profiles: adminProfiles,
      }), { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    // Verify target user exists in profiles
    const { data: targetProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("id", target_user_id)
      .maybeSingle();

    if (!targetProfile) {
      return new Response(JSON.stringify({ error: "Target user not found" }), {
        status: 404, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    if (action === "add") {
      // Check if already admin
      const { data: existing } = await admin
        .from("admin_roles")
        .select("id")
        .eq("user_id", target_user_id)
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ error: "User is already an admin" }), {
          status: 409, headers: { ...CORS, "Content-Type": "application/json" },
        });
      }

      const { error: insertErr } = await admin
        .from("admin_roles")
        .insert({ user_id: target_user_id, role: "admin" });

      if (insertErr) throw insertErr;

      return new Response(
        JSON.stringify({ ok: true, message: "Admin added" }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    if (action === "remove") {
      // Don't allow removing self
      if (target_user_id === user.id) {
        return new Response(JSON.stringify({ error: "Cannot remove yourself" }), {
          status: 400, headers: { ...CORS, "Content-Type": "application/json" },
        });
      }

      const { error: deleteErr } = await admin
        .from("admin_roles")
        .delete()
        .eq("user_id", target_user_id);

      if (deleteErr) throw deleteErr;

      return new Response(
        JSON.stringify({ ok: true, message: "Admin removed" }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Unexpected" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err?.message ?? err) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});