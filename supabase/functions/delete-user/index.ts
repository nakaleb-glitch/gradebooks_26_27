import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const getErrorMessage = (err: unknown) =>
  err instanceof Error ? err.message : String(err ?? "Unknown error");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing auth token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerData, error: callerError } = await supabaseAdmin.auth
      .getUser(token);
    if (callerError || !callerData.user) {
      return new Response(JSON.stringify({ error: "Invalid auth token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerProfile } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("id", callerData.user.id)
      .single();

    if (
      callerProfile?.role !== "admin" && callerProfile?.role !== "admin_teacher"
    ) {
      return new Response(
        JSON.stringify({ error: "Only admins can delete users" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body = await req.json();
    const userId = body.user_id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "user_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (userId === callerData.user.id) {
      return new Response(
        JSON.stringify({ error: "You cannot delete your own account" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { error: authDeleteError } = await supabaseAdmin.auth.admin
      .deleteUser(userId);
    if (authDeleteError) {
      return new Response(JSON.stringify({ error: authDeleteError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanupErrors: string[] = [];

    const { error: classUnassignError } = await supabaseAdmin
      .from("classes")
      .update({ teacher_id: null })
      .eq("teacher_id", userId);
    if (classUnassignError) {
      cleanupErrors.push(`class cleanup failed: ${classUnassignError.message}`);
    }

    const { error: profileDeleteError } = await supabaseAdmin
      .from("users")
      .delete()
      .eq("id", userId);
    if (profileDeleteError) {
      cleanupErrors.push(
        `profile cleanup failed: ${profileDeleteError.message}`,
      );
    }

    if (cleanupErrors.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Auth user deleted but data cleanup is incomplete.",
          needs_manual_cleanup: true,
          details: cleanupErrors,
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({ success: true, cleanup_complete: true }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: getErrorMessage(err) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
