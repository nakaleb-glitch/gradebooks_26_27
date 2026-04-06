import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { teachers } = await req.json()

    const results = []
    const errors = []

    for (const teacher of teachers) {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: teacher.email,
        password: 'royal@123',
        email_confirm: true,
        user_metadata: {
          full_name: teacher.full_name,
          force_password_change: true
        }
      })

      if (error) {
        errors.push({ email: teacher.email, error: error.message })
      } else {
        await supabaseAdmin.from('users').update({
          full_name: teacher.full_name,
          role: 'teacher'
        }).eq('id', data.user.id)

        results.push({ email: teacher.email, success: true })
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