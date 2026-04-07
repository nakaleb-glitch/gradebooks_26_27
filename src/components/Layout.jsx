import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate, Link, useLocation } from 'react-router-dom'

export default function Layout({ children }) {
  const { profile, user, signOut, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [updatingPassword, setUpdatingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [showAdminMenu, setShowAdminMenu] = useState(false)

  const confirmUnsavedGradebookNavigation = () => {
    const hasUnsaved = sessionStorage.getItem('gradebook_unsaved_changes') === '1'
    if (!hasUnsaved) return true
    return window.confirm('You have unsaved gradebook changes. Please click Save before leaving this page. Continue anyway?')
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const menuItems = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Student Management', path: '/admin/students' },
    { label: 'Class Management', path: '/admin/classes' },
    { label: 'Teacher Management', path: '/admin/users' },
    { label: 'Resource Management', path: '/admin/resources' },
  ]
  const navLabelClass = 'text-sm font-medium inline-flex items-center h-6 leading-6 transition-colors'
  const navLabelBaseStyle = {
    fontFamily: 'inherit',
    fontSize: '14px',
    fontWeight: 500,
    lineHeight: '24px',
    letterSpacing: '0',
    borderBottom: '2px solid transparent',
    margin: 0,
    padding: 0,
    verticalAlign: 'middle',
  }

  useEffect(() => {
    setShowAdminMenu(false)
  }, [location.pathname])

  const requiresPasswordChange = !!profile?.must_change_password
  const displayRole = String(profile?.role || '')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPasswordError('')

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.')
      return
    }

    setUpdatingPassword(true)

    const { error: authError } = await supabase.auth.updateUser({
      password: newPassword,
      data: { force_password_change: false },
    })
    if (authError) {
      setPasswordError(authError.message)
      setUpdatingPassword(false)
      return
    }

    const { error: profileError } = await supabase
      .from('users')
      .update({ must_change_password: false })
      .eq('id', user?.id)

    if (profileError) {
      setPasswordError(profileError.message)
      setUpdatingPassword(false)
      return
    }

    setNewPassword('')
    setConfirmPassword('')
    setUpdatingPassword(false)
    await refreshProfile()
  }

  return (
    <div className="min-h-screen" style={{ background: '#f4f6f9' }}>
      {/* Navbar */}
      <nav style={{ background: '#1a1a1a', borderBottom: '3px solid #d1232a' }}>
        <div className="w-full px-3 sm:px-6 py-3 flex justify-between items-center">
          {/* Left — Royal School Logo */}
          <div className="flex items-center gap-8">
            <img
              src="/LOGO_ROYAL_SCHOOL_3.png"
              alt="Royal School International"
              className="h-12 w-auto"
            />
            {/* Nav menu */}
            <div className="flex gap-6 items-center">
              {profile?.role === 'admin' && location.pathname !== '/dashboard' && (
                <div className="relative">
                  <button
                    type="button"
                    className={navLabelClass}
                    style={{
                      ...navLabelBaseStyle,
                      color: '#e5e7eb',
                      background: 'transparent',
                      borderLeft: 'none',
                      borderRight: 'none',
                      borderTop: 'none',
                      appearance: 'none',
                    }}
                    onClick={() => setShowAdminMenu(prev => !prev)}
                    aria-haspopup="menu"
                    aria-expanded={showAdminMenu}
                  >
                    <span className="inline-flex items-center gap-2">
                      <span aria-hidden="true" className="inline-flex flex-col justify-center gap-1">
                        <span className="block w-3.5 h-0.5 rounded-full" style={{ backgroundColor: '#e5e7eb' }} />
                        <span className="block w-3.5 h-0.5 rounded-full" style={{ backgroundColor: '#e5e7eb' }} />
                        <span className="block w-3.5 h-0.5 rounded-full" style={{ backgroundColor: '#e5e7eb' }} />
                      </span>
                      <span>Menu</span>
                    </span>
                  </button>
                  <div
                    className={`absolute left-0 top-full pt-2 z-40 ${showAdminMenu ? 'block' : 'hidden'}`}
                    onMouseLeave={() => setShowAdminMenu(false)}
                  >
                    <div className="w-60 rounded-lg border shadow-lg overflow-hidden" style={{ backgroundColor: '#1a1a1a', borderColor: '#333' }}>
                      {menuItems.map((tool) => (
                        <Link
                          key={tool.path}
                          to={tool.path}
                          className="block px-3 py-2 text-sm transition-colors"
                          style={{
                            color: location.pathname === tool.path ? '#1a1a1a' : '#e5e7eb',
                            backgroundColor: location.pathname === tool.path ? '#ffc612' : 'transparent',
                          }}
                          onMouseOver={e => {
                            if (location.pathname !== tool.path) {
                              e.currentTarget.style.backgroundColor = '#1f86c7'
                              e.currentTarget.style.color = '#ffffff'
                            }
                          }}
                          onMouseOut={e => {
                            if (location.pathname !== tool.path) {
                              e.currentTarget.style.backgroundColor = 'transparent'
                              e.currentTarget.style.color = '#e5e7eb'
                            }
                          }}
                          onClick={e => {
                            if (!confirmUnsavedGradebookNavigation()) {
                              e.preventDefault()
                            }
                          }}
                        >
                          {tool.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right — Cambridge Logo + user info */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="leading-tight text-right">
                <div className="text-xs font-medium text-gray-100">{profile?.full_name || 'User'}</div>
                <div className="text-xs text-gray-400">Staff ID: {profile?.staff_id || '—'}</div>
              </div>
              <span className="text-xs px-2 py-1 rounded-full font-medium"
                style={{
                  background: profile?.role === 'admin' ? '#d1232a' : '#1f86c7',
                  color: '#fff'
                }}>
                {displayRole || 'User'}
              </span>
              <Link
                to="/settings"
                className="text-xs font-medium transition-colors"
                style={{ color: '#e5e7eb' }}
                onMouseOver={e => e.currentTarget.style.color = '#ffc612'}
                onMouseOut={e => e.currentTarget.style.color = '#e5e7eb'}
                onClick={e => {
                  if (!confirmUnsavedGradebookNavigation()) {
                    e.preventDefault()
                  }
                }}
              >
                User Settings
              </Link>
              <button
                onClick={() => {
                  if (!confirmUnsavedGradebookNavigation()) return
                  handleSignOut()
                }}
                className="text-xs font-medium transition-colors"
                style={{ color: '#e5e7eb' }}
                onMouseOver={e => e.currentTarget.style.color = '#d1232a'}
                onMouseOut={e => e.currentTarget.style.color = '#e5e7eb'}
              >
                Sign out
              </button>
            </div>
            <img
              src="/LOGO_CAMBRIDGE_2.png"
              alt="Cambridge Assessment International Education"
              className="h-10 w-auto"
            />
          </div>
        </div>
      </nav>

      <main className="w-full px-3 sm:px-6 py-6 sm:py-10">
        {children}
      </main>

      {requiresPasswordChange && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4">
          <div className="w-full max-w-md bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Change Your Password</h3>
            <p className="text-sm text-gray-500 mb-4">Your account must set a new password before continuing.</p>
            <form onSubmit={handleChangePassword} className="space-y-3">
              <input
                type="password"
                placeholder="New password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {passwordError && <p className="text-xs text-red-600">{passwordError}</p>}
              <button
                type="submit"
                disabled={updatingPassword}
                className="w-full rounded-lg bg-blue-600 text-white py-2 text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300"
              >
                {updatingPassword ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}