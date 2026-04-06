import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        upsertUser(session.user).then(() => navigate('/dashboard'))
      } else {
        navigate('/login')
      }
    })
  }, [])

  const upsertUser = async (user) => {
    const { data: existing } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    await supabase.from('users').upsert({
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name,
      role: existing?.role || 'teacher'
    }, { onConflict: 'id' })
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-500">Signing you in...</p>
    </div>
  )
}