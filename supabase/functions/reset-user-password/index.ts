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
      return new Response(JSON.stringify({ error: 'Only admins can reset passwords' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const userId = body.user_id
    if (!userId) {
      return new Response(JSON.stringify({ error: 'user_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const temporaryPassword = generateTemporaryPassword()
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: temporaryPassword,
      user_metadata: { force_password_change: true, temporary_password_issued_at: new Date().toISOString() },
    })

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { error: profileUpdateError } = await supabaseAdmin
      .from('users')
      .update({ must_change_password: true })
      .eq('id', userId)

    if (profileUpdateError) {
      return new Response(JSON.stringify({ error: profileUpdateError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true, temporary_password: temporaryPassword }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
