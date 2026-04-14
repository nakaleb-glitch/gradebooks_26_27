import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeMode, setActiveMode] = useState(null)

  useEffect(() => {
    // Load saved active mode from localStorage
    if (profile?.role === 'admin_teacher') {
      const saved = localStorage.getItem('active_role_mode')
      if (saved === 'admin' || saved === 'teacher') {
        setActiveMode(saved)
      } else {
        // Default to admin mode for hybrid users
        setActiveMode('admin')
      }
    } else {
      setActiveMode(null)
    }
  }, [profile?.role])

  const toggleRoleMode = () => {
    if (profile?.role !== 'admin_teacher') return
    const newMode = activeMode === 'admin' ? 'teacher' : 'admin'
    setActiveMode(newMode)
    localStorage.setItem('active_role_mode', newMode)
  }

  const fetchProfile = async (userId) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
    if (error) {
      setProfile(null)
      setLoading(false)
      return
    }
    setProfile(data || null)
    setLoading(false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          fetchProfile(session.user.id)
        } else {
          setProfile(null)
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    })
  }

  const signInWithStaffId = async (staffId, password) => {
    const normalized = String(staffId || '').trim()
    if (!normalized || !password) {
      return { error: new Error('Staff ID and password are required.') }
    }

    const { data: userEmail, error: lookupError } = await supabase
      .rpc('get_email_by_staff_id', { p_staff_id: normalized })

    if (lookupError) return { error: new Error('Invalid credentials.') }
    if (!userEmail) return { error: new Error('Invalid credentials.') }

    const { error } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password,
    })
    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const refreshProfile = async () => {
    if (!user?.id) return
    await fetchProfile(user.id)
  }

  // Compute effective role for UI checks
  const effectiveRole = (() => {
    if (profile?.role === 'admin_teacher') {
      return activeMode
    }
    return profile?.role
  })()

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      signInWithGoogle, 
      signInWithStaffId, 
      signOut, 
      refreshProfile,
      activeMode,
      effectiveRole,
      toggleRoleMode
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)