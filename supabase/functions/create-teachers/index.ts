import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const capitalizeFirst = (value: string) => {
  const v = (value || '').trim()
  if (!v) return ''
  return v.charAt(0).toUpperCase() + v.slice(1)
}

const normalizeLevel = (value: string) => {
  const v = (value || '').trim().toLowerCase()
  if (v === 'primary') return 'primary'
  if (v === 'secondary') return 'secondary'
  return ''
}

const normalizeSubject = (value: string) => {
  const v = (value || '').trim().toLowerCase()
  if (v === 'esl/gp') return 'ESL/GP'
  if (v === 'mathematics') return 'Mathematics'
  if (v === 'science') return 'Science'
  if (v === 'vn esl') return 'VN ESL'
  return capitalizeFirst(value || '')
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
          persistSession: false
        }
      }
    )

    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Missing auth token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(token)
    if (callerError || !callerData.user) {
      return new Response(
        JSON.stringify({ error: 'Invalid auth token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: callerProfile } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', callerData.user.id)
      .single()

    if (callerProfile?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Only admins can import users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const teachers = body.teachers

    if (!teachers || !Array.isArray(teachers)) {
      return new Response(
        JSON.stringify({ error: 'No teachers array provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const results = []
    const errors = []

    for (let i = 0; i < teachers.length; i++) {
      const teacher = teachers[i]
      const full_name = (teacher.full_name || '').trim()
      const staff_id = capitalizeFirst(teacher.staff_id || '')
      const email = (teacher.email || '').trim().toLowerCase()
      const level = normalizeLevel(teacher.level || '')
      const subject = normalizeSubject(teacher.subject || '')
      const role = (teacher.role || 'teacher').toString().trim().toLowerCase() || 'teacher'

      const missing = []
      if (!full_name) missing.push('full_name')
      if (!staff_id) missing.push('staff_id')
      if (!email) missing.push('email')
      if (!level) missing.push('level')
      if (!subject) missing.push('subject')

      if (missing.length > 0) {
        errors.push({
          row: i + 1,
          email,
          staff_id,
          error: `Missing required field(s): ${missing.join(', ')}`,
        })
        continue
      }

      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: 'royal@123',
        email_confirm: true,
        user_metadata: {
          full_name,
          staff_id,
          force_password_change: true
        }
      })

      if (error) {
        errors.push({ row: i + 1, email, staff_id, error: error.message })
      } else {
        // Use upsert instead of update so it creates the row if it doesn't exist
        const { error: upsertError } = await supabaseAdmin
          .from('users')
          .upsert({
            id: data.user.id,
            email,
            full_name,
            staff_id,
            role: role === 'admin' ? 'admin' : role === 'admin_teacher' ? 'admin_teacher' : 'teacher',
            level,
            subject,
            must_change_password: true
          }, { onConflict: 'id' })

        if (upsertError) {
          errors.push({ row: i + 1, email, staff_id, error: 'Auth created but profile failed: ' + upsertError.message })
        } else {
          results.push({ row: i + 1, email, staff_id, success: true })
        }
      }
    }

    return new Response(
      JSON.stringify({ results, errors }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})