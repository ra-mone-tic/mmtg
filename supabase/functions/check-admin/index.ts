// Supabase Edge Function: check-admin
// Checks if the authenticated user has an admin role.
// Uses service role to bypass RLS (avoids infinite recursion).

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
      return new Response(JSON.stringify({ is_admin: false, error: "No token" }), {
        status: 200, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Use anon key client to verify the user's token and get their ID
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );

    const { data: { user }, error: userErr } = await anonClient.auth.getUser(userToken);
    if (userErr || !user) {
      return new Response(JSON.stringify({ is_admin: false, error: "Invalid token" }), {
        status: 200, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Use service role to check admin_roles (bypasses RLS)
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: adminRow } = await admin
      .from("admin_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    return new Response(
      JSON.stringify({ is_admin: !!adminRow, user_id: user.id }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ is_admin: false, error: String(err?.message ?? err) }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});