import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const getHomeroom = (classValue: unknown) =>
  String(classValue || "").trim().split(/\s+/)[0] || "";

type SyncStudentInput = {
  id?: string;
  class?: string;
  student_id?: string;
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
        JSON.stringify({ error: "Only admins can sync student enrollments" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body = await req.json();
    const students: SyncStudentInput[] = Array.isArray(body?.students)
      ? body.students as SyncStudentInput[]
      : [];
    const academicYear = String(body?.academic_year || "").trim() ||
      "2026-2027";

    if (students.length === 0) {
      return new Response(
        JSON.stringify({ enrolled: 0, missing: 0, missingStudents: [] }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: currentYearClasses, error: classError } = await supabaseAdmin
      .from("classes")
      .select("id, name")
      .eq("academic_year", academicYear);

    if (classError) {
      return new Response(
        JSON.stringify({ error: `Class lookup failed: ${classError.message}` }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const classIds = (currentYearClasses || []).map((c) => c.id);
    const classesByHomeroom: Record<string, string[]> = {};
    (currentYearClasses || []).forEach((cls) => {
      const homeroom = getHomeroom(cls.name).toLowerCase();
      if (!homeroom) return;
      if (!classesByHomeroom[homeroom]) classesByHomeroom[homeroom] = [];
      classesByHomeroom[homeroom].push(cls.id);
    });

    const studentIds = students.map((s) => s?.id).filter(Boolean);
    if (studentIds.length > 0 && classIds.length > 0) {
      const { error: deleteError } = await supabaseAdmin
        .from("class_students")
        .delete()
        .in("student_id", studentIds)
        .in("class_id", classIds);

      if (deleteError) {
        return new Response(
          JSON.stringify({
            error: `Enrollment cleanup failed: ${deleteError.message}`,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    const enrollRows: Array<{ class_id: string; student_id: string }> = [];
    const missingStudents: string[] = [];
    students.forEach((student) => {
      const homeroom = getHomeroom(student?.class).toLowerCase();
      const targetClassIds = classesByHomeroom[homeroom] || [];
      const studentId = student?.id;
      if (!studentId || !homeroom || targetClassIds.length === 0) {
        missingStudents.push(student?.student_id || studentId || "unknown");
        return;
      }
      targetClassIds.forEach((classId) => {
        enrollRows.push({ class_id: classId, student_id: studentId });
      });
    });

    if (enrollRows.length > 0) {
      const { error: enrollError } = await supabaseAdmin
        .from("class_students")
        .upsert(enrollRows, { onConflict: "class_id,student_id" });

      if (enrollError) {
        return new Response(
          JSON.stringify({
            error: `Enrollment upsert failed: ${enrollError.message}`,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    const enrolled = students.length - missingStudents.length;
    return new Response(
      JSON.stringify({
        enrolled,
        missing: missingStudents.length,
        missingStudents,
      }),
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
