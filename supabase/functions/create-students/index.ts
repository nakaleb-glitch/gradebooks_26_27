import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const generateTemporaryPassword = () => {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  const token = btoa(String.fromCharCode(...bytes)).replace(/[^A-Za-z0-9]/g, '').slice(0, 12)
  return `Royal!${token}`
}

const makeStudentEmail = (studentId: string) => {
  const base = String(studentId || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  return `${base || 'student'}@royal.edu.vn`
}

const findAuthUserIdByEmail = async (supabaseAdmin: ReturnType<typeof createClient>, email: string) => {
  const target = String(email || '').trim().toLowerCase()
  if (!target) return null

  let page = 1
  const perPage = 500
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    if (error) return null
    const users = data?.users || []
    if (users.length === 0) return null

    const found = users.find((u) => String(u.email || '').trim().toLowerCase() === target)
    if (found?.id) return found.id

    if (users.length < perPage) return null
    page += 1
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing auth token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(token)
    if (callerError || !callerData.user) {
      return new Response(JSON.stringify({ error: 'Invalid auth token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: callerProfile } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', callerData.user.id)
      .single()

    if (callerProfile?.role !== 'admin' && callerProfile?.role !== 'admin_teacher') {
      return new Response(JSON.stringify({ error: 'Only admins can create student accounts' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const students = body.students
    if (!students || !Array.isArray(students)) {
      return new Response(JSON.stringify({ error: 'No students array provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const results = []
    const errors = []

    for (let i = 0; i < students.length; i++) {
      const student = students[i]
      const student_id = String(student.student_id || '').trim()
      const full_name = String(student.full_name || '').trim()
      const level = String(student.level || '').trim() || null
      const student_id_ref = student.student_ref_id || null
      const email = makeStudentEmail(student_id)

      // Always create account, fallback names gracefully
      const finalFullName = full_name || student.name_vn || student_id
      
      if (!student_id || !student_id_ref) {
        errors.push({
          row: i + 1,
          student_id,
          error: 'Missing required field(s): student_id, student_ref_id',
        })
        continue
      }

      let userId: string | null = null
      let profileEmail: string = email
      let temporaryPassword: string | null = null

      const { data: existingProfile } = await supabaseAdmin
        .from('users')
        .select('id, email')
        .ilike('uid', student_id)
        .maybeSingle()

      if (existingProfile?.id) {
        userId = existingProfile.id
        profileEmail = existingProfile.email || email
      } else {
        temporaryPassword = generateTemporaryPassword()
        const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: temporaryPassword,
          email_confirm: true,
        user_metadata: {
          full_name: finalFullName,
          student_id,
          force_password_change: true,
          temporary_password_issued_at: new Date().toISOString(),
        },
        })

        if (createError || !created?.user?.id) {
          // Recover when auth user already exists (e.g. prior partial run where profile upsert failed).
          const recoveredUserId = await findAuthUserIdByEmail(supabaseAdmin, email)
          if (!recoveredUserId) {
            errors.push({ row: i + 1, student_id, error: createError?.message || 'Failed to create auth user' })
            continue
          }
          userId = recoveredUserId
        } else {
          userId = created.user.id
        }
      }

       const { error: upsertError } = await supabaseAdmin
         .from('users')
         .upsert({
           id: userId,
           email: profileEmail,
           full_name: finalFullName,
           uid: student_id.toLowerCase().trim(),
           role: 'student',
           level,
           subject: null,
           student_id_ref,
           must_change_password: true,
         }, { onConflict: 'id' })

       if (upsertError) {
         errors.push({ row: i + 1, student_id, error: 'Profile upsert failed: ' + upsertError.message })
       } else {
         results.push({
           row: i + 1,
           student_id,
           success: true,
           temporary_password: temporaryPassword,
           created_auth: temporaryPassword !== null,
         })
       }
    }

    return new Response(JSON.stringify({ results, errors }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
