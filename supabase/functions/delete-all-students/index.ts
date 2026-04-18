import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const isMissingRelationError = (message: string) => {
  const m = String(message || "").toLowerCase();
  return m.includes("does not exist") || m.includes("could not find the table");
};

const chunkArray = <T>(items: T[], chunkSize: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
};

const getErrorMessage = (err: unknown) =>
  err instanceof Error ? err.message : String(err ?? "Unknown error");

const isStudentAuthUserByMarker = (
  authUser: {
    user_metadata?: Record<string, unknown>;
    app_metadata?: Record<string, unknown>;
    email?: string;
  } | null,
) => {
  const metadata = authUser?.user_metadata || {};
  const appMetadata = authUser?.app_metadata || {};
  const email = String(authUser?.email || "").toLowerCase();
  const localPart = email.split("@")[0] || "";

  const hasStudentMetadata = typeof metadata.student_id === "string" &&
    metadata.student_id.trim() !== "";
  const metadataRoleStudent =
    String(metadata.role || "").toLowerCase() === "student" ||
    String(appMetadata.role || "").toLowerCase() === "student";

  // Student IDs in this project are commonly alphanumeric codes like s0001.
  const localLooksLikeStudentId = /^[a-z]\d{3,}$/.test(localPart);

  return hasStudentMetadata || metadataRoleStudent || localLooksLikeStudentId;
};

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
        JSON.stringify({ error: "Only admins can delete all students" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: students, error: studentsError } = await supabaseAdmin
      .from("students")
      .select("id, student_id");

    if (studentsError) {
      return new Response(JSON.stringify({ error: studentsError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const studentIds = (students || []).map((s) => s.id).filter(Boolean);
    const studentCodes = (students || []).map((s) =>
      String(s.student_id || "").trim()
    ).filter(Boolean);

    const summary: Record<string, number> = {};
    const errors: string[] = [];

    const deleteByStudentId = async (table: string, column = "student_id") => {
      if (studentIds.length === 0) return;
      const { error, count } = await supabaseAdmin
        .from(table)
        .delete({ count: "exact" })
        .in(column, studentIds);
      if (error) {
        if (isMissingRelationError(error.message)) return;
        errors.push(`${table}: ${error.message}`);
        return;
      }
      summary[table] = count || 0;
    };

    // Cleanup dependent rows first.
    await deleteByStudentId("class_students");
    await deleteByStudentId("participation_grades");
    await deleteByStudentId("assignment_grades");
    await deleteByStudentId("progress_test_grades");
    await deleteByStudentId("student_attributes");
    await deleteByStudentId("behavior_reports");
    await deleteByStudentId("term_comments");

    // Optional cleanup for password reset requests keyed by student code.
    if (studentCodes.length > 0) {
      const { error: resetError, count: resetCount } = await supabaseAdmin
        .from("password_reset_requests")
        .delete({ count: "exact" })
        .in("staff_id", studentCodes);
      if (resetError && !isMissingRelationError(resetError.message)) {
        errors.push(`password_reset_requests: ${resetError.message}`);
      } else {
        summary.password_reset_requests = resetCount || 0;
      }
    }

    // Capture student-linked user IDs in chunks to avoid huge query strings.
    const authUserIds = new Set<string>();
    const studentIdChunks = chunkArray(studentIds, 100);
    for (const studentChunk of studentIdChunks) {
      const { data: chunkProfiles, error: chunkLookupError } =
        await supabaseAdmin
          .from("users")
          .select("id")
          .in("student_id_ref", studentChunk);
      if (chunkLookupError) {
        if (!isMissingRelationError(chunkLookupError.message)) {
          errors.push(`users lookup: ${chunkLookupError.message}`);
        }
        continue;
      }
      (chunkProfiles || []).forEach((u) => {
        if (u?.id) authUserIds.add(String(u.id));
      });
    }

    // Include any profile rows marked as student even if student_id_ref is null.
    const { data: roleStudents, error: roleStudentsError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("role", "student");
    if (roleStudentsError) {
      if (!isMissingRelationError(roleStudentsError.message)) {
        errors.push(`users lookup by role: ${roleStudentsError.message}`);
      }
    } else {
      (roleStudents || []).forEach((u) => {
        if (u?.id) authUserIds.add(String(u.id));
      });
    }

    // Delete profile rows tied to students (chunked).
    let usersDeleteTotal = 0;
    for (const studentChunk of studentIdChunks) {
      const { error: usersDeleteError, count } = await supabaseAdmin
        .from("users")
        .delete({ count: "exact" })
        .in("student_id_ref", studentChunk);
      if (usersDeleteError) {
        if (!isMissingRelationError(usersDeleteError.message)) {
          errors.push(`users delete by ref: ${usersDeleteError.message}`);
        }
      } else {
        usersDeleteTotal += count || 0;
      }
    }
    const { error: usersDeleteByRoleError, count: usersDeleteByRoleCount } =
      await supabaseAdmin
        .from("users")
        .delete({ count: "exact" })
        .eq("role", "student");
    if (usersDeleteByRoleError) {
      if (!isMissingRelationError(usersDeleteByRoleError.message)) {
        errors.push(`users delete by role: ${usersDeleteByRoleError.message}`);
      }
    } else {
      usersDeleteTotal += usersDeleteByRoleCount || 0;
    }
    summary.users = usersDeleteTotal;

    // Delete students rows.
    const { error: studentsDeleteError, count: studentsDeleteCount } =
      await supabaseAdmin
        .from("students")
        .delete({ count: "exact" })
        .neq("id", "00000000-0000-0000-0000-000000000000");
    if (studentsDeleteError) {
      errors.push(`students delete: ${studentsDeleteError.message}`);
    } else {
      summary.students = studentsDeleteCount || 0;
    }

    // Delete auth accounts last (best effort and reported).
    let authDeleted = 0;
    let authDeletedByFallbackScan = 0;
    let authFallbackMatches = 0;
    const authErrors: string[] = [];
    for (const authUserId of Array.from(authUserIds)) {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(authUserId);
      if (error) authErrors.push(`${authUserId}: ${error.message}`);
      else authDeleted += 1;
    }

    // Fallback for orphaned auth users when linked profile rows are already gone.
    let fallbackPassesRun = 0;
    const authDeletedPerPass: number[] = [];
    if (authUserIds.size === 0) {
      const perPage = 200;
      const maxFallbackPasses = 5;

      for (let pass = 1; pass <= maxFallbackPasses; pass += 1) {
        fallbackPassesRun = pass;
        const candidateIds = new Set<string>();
        let page = 1;

        // First collect all candidates for this pass.
        while (true) {
          const { data, error } = await supabaseAdmin.auth.admin.listUsers({
            page,
            perPage,
          });
          if (error) {
            authErrors.push(`auth listUsers page ${page}: ${error.message}`);
            break;
          }
          const users = data?.users || [];
          if (users.length === 0) break;

          users
            .filter(isStudentAuthUserByMarker)
            .forEach((u) => {
              if (u?.id) candidateIds.add(u.id);
            });

          if (users.length < perPage) break;
          page += 1;
        }

        authFallbackMatches += candidateIds.size;
        if (candidateIds.size === 0) {
          authDeletedPerPass.push(0);
          break;
        }

        // Then delete candidates for this pass.
        let deletedThisPass = 0;
        for (const candidateId of Array.from(candidateIds)) {
          const { error: deleteError } = await supabaseAdmin.auth.admin
            .deleteUser(candidateId);
          if (deleteError) {
            authErrors.push(`${candidateId}: ${deleteError.message}`);
          } else deletedThisPass += 1;
        }
        authDeletedPerPass.push(deletedThisPass);
        authDeletedByFallbackScan += deletedThisPass;

        // Stop if no progress in a pass.
        if (deletedThisPass === 0) break;
      }

      authDeleted += authDeletedByFallbackScan;
    }

    return new Response(
      JSON.stringify({
        success: errors.length === 0 && authErrors.length === 0,
        deleted_counts: summary,
        auth_deleted: authDeleted,
        auth_deleted_by_fallback_scan: authDeletedByFallbackScan,
        auth_fallback_matches: authFallbackMatches,
        fallback_passes_run: fallbackPassesRun,
        auth_deleted_per_pass: authDeletedPerPass,
        auth_errors: authErrors,
        errors,
      }),
      {
        status: errors.length > 0 ? 207 : 200,
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
