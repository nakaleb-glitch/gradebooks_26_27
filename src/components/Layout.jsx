import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate, Link, useLocation } from 'react-router-dom'

// School official week calendar
const PARTICIPATION_WEEK_SCHEDULE = {
  midterm_1: [
    { week: 0, label: 'Orientation', range: 'Aug. 17 - Aug. 21' },
    { week: 1, label: 'Week 1', range: 'Aug. 24 - Aug. 28' },
    { week: 2, label: 'Week 2', range: 'Aug. 31 - Sep. 5' },
    { week: 3, label: 'Week 3', range: 'Sep. 7 - Sep. 11' },
    { week: 4, label: 'Week 4', range: 'Sep. 14 - Sep. 18' },
    { week: 5, label: 'Week 5', range: 'Sep. 21 - Sep. 25' },
    { week: 6, label: 'Week 6', range: 'Sep. 28 - Oct. 2' },
    { week: 7, label: 'Week 7', range: 'Oct. 5 - Oct. 9', isNoScore: true, noScoreReason: 'Exam Week' },
  ],
  final_1: [
    { week: 8, label: 'Week 8', range: 'Oct. 12 - Oct. 16' },
    { week: 9, label: 'Week 9', range: 'Oct. 19 - Oct. 23' },
    { week: 10, label: 'Week 10', range: 'Oct. 26 - Oct. 31' },
    { week: 11, label: 'Week 11', range: 'Nov. 2 - Nov. 6' },
    { week: 12, label: 'Week 12', range: 'Nov. 9 - Nov. 13' },
    { week: 13, label: 'Week 13', range: 'Nov. 16 - Nov. 20' },
    { week: 14, label: 'Week 14', range: 'Nov. 23 - Nov. 27' },
    { week: 15, label: 'Week 15', range: 'Nov. 30 - Dec. 4', isNoScore: true, noScoreReason: 'Exam Week' },
  ],
  midterm_2: [
    { week: 16, label: 'Week 16', range: 'Dec. 7 - Dec. 11' },
    { week: 17, label: 'Week 17', range: 'Dec. 14 - Dec. 18' },
    { week: 18, label: 'Week 18', range: 'Dec. 21 - Dec. 25', isNoScore: true, noScoreReason: 'Christmas Break' },
    { week: 19, label: 'Week 19', range: 'Dec. 28 - Jan. 1', isNoScore: true, noScoreReason: 'Christmas Break' },
    { week: 20, label: 'Week 20', range: 'Jan. 4 - Jan. 8' },
    { week: 21, label: 'Week 21', range: 'Jan. 11 - Jan. 15' },
    { week: 22, label: 'Week 22', range: 'Jan. 18 - Jan. 22' },
    { week: 23, label: 'Week 23', range: 'Jan. 25 - Jan. 29' },
    { week: 24, label: 'Week 24', range: 'Feb. 1 - Feb. 5', isNoScore: true, noScoreReason: 'Tet Holiday Break' },
    { week: 25, label: 'Week 25', range: 'Feb. 8 - Feb. 12', isNoScore: true, noScoreReason: 'Tet Holiday Break' },
    { week: 26, label: 'Week 26', range: 'Feb. 15 - Feb. 19' },
    { week: 27, label: 'Week 27', range: 'Feb. 22 - Feb. 26', isNoScore: true, noScoreReason: 'Exam Week' },
  ],
  final_2: [
    { week: 28, label: 'Week 28', range: 'Mar. 1 - Mar. 5' },
    { week: 29, label: 'Week 29', range: 'Mar. 8 - Mar. 12' },
    { week: 30, label: 'Week 30', range: 'Mar. 15 - Mar. 19' },
    { week: 31, label: 'Week 31', range: 'Mar. 22 - Mar. 26' },
    { week: 32, label: 'Week 32', range: 'Mar. 29 - Apr. 2' },
    { week: 33, label: 'Week 33', range: 'Apr. 5 - Apr. 9' },
    { week: 34, label: 'Week 34', range: 'Apr. 12 - Apr. 16' },
    { week: 35, label: 'Week 35', range: 'Apr. 19 - Apr. 23', isNoScore: true, noScoreReason: 'Final Exam Week' },
    { week: 36, label: 'Week 36', range: 'Apr. 26 - Apr. 30', isNoScore: true, noScoreReason: 'Final Exam Week' },
    { week: 37, label: 'Week 37', range: 'May 3 - May 7', isNoScore: true, noScoreReason: 'Post Exam Week' },
    { week: 38, label: 'Week 38', range: 'May 10 - May 14', isNoScore: true, noScoreReason: 'Post Exam Week' },
    { week: 39, label: 'Week 39', range: 'May 17 - May 21', isNoScore: true, noScoreReason: 'Post Exam Week' },
  ],
}

// Flatten all weeks into single array
const ALL_WEEKS = [
  ...PARTICIPATION_WEEK_SCHEDULE.midterm_1,
  ...PARTICIPATION_WEEK_SCHEDULE.final_1,
  ...PARTICIPATION_WEEK_SCHEDULE.midterm_2,
  ...PARTICIPATION_WEEK_SCHEDULE.final_2,
]

// Calculate current week based on date - default to Week 0 for pre launch
const getCurrentWeekIndex = () => {
  // Check for debug override
  const override = sessionStorage.getItem('debug_week_override')
  if (override !== null) {
    const idx = Number(override)
    if (idx >= 0 && idx < ALL_WEEKS.length) return idx
  }

  const today = new Date()
  // Default to Week 0 for all dates before August 2026
  if (today < new Date('2026-08-17')) return 0

  // TODO: Implement actual date mapping
  return 0
}

export default function Layout({ children }) {
  const { profile, user, signOut, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [updatingPassword, setUpdatingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [showAdminMenu, setShowAdminMenu] = useState(false)
  const [theme, setTheme] = useState('light')
  const [navNameEng, setNavNameEng] = useState('')
  const [navNameVn, setNavNameVn] = useState('')

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
      { label: 'Gradebook Management', path: '/admin/gradebooks' },
      { label: 'Weekly Plan Management', path: '/weekly-plans' },
      { label: 'Teacher Management', path: '/admin/users' },
      { label: 'Resource Management', path: '/admin/resources' },
      { label: 'Event & Admin Deadline Management', path: '/admin/events-deadlines' },
      { label: 'Behavior Management', path: '/admin/behavior-management' },
       { label: 'Library, ICT & Science Lab Booking Management', path: '/admin/resource-bookings' },
       { label: 'Teacher Schedule Management', path: '/admin/teacher-schedules' },
      { label: 'Student Gradebook Lookup', path: '/admin/student-gradebook-lookup' },
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

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme_preference')
    const preferredDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    const initialTheme = savedTheme === 'light' || savedTheme === 'dark'
      ? savedTheme
      : (preferredDark ? 'dark' : 'light')
    setTheme(initialTheme)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme_preference', theme)
  }, [theme])

  useEffect(() => {
    const resolveNavbarName = async () => {
      const fallback = String(profile?.full_name || user?.email || 'User').trim()
      setNavNameEng(fallback)
      setNavNameVn('')

      if (profile?.role !== 'student') return

      let query = null
      if (profile?.student_id_ref) {
        query = supabase
          .from('students')
          .select('name_eng, name_vn')
          .eq('id', profile.student_id_ref)
          .maybeSingle()
      } else if (profile?.staff_id) {
        query = supabase
          .from('students')
          .select('name_eng, name_vn')
          .ilike('student_id', profile.staff_id)
          .maybeSingle()
      }

      if (!query) return
      const { data } = await query
      if (data?.name_eng) setNavNameEng(data.name_eng)
      if (data?.name_vn) setNavNameVn(data.name_vn)
    }

    resolveNavbarName()
  }, [profile?.id, profile?.role, profile?.student_id_ref, profile?.staff_id, profile?.full_name, user?.email])

  const requiresPasswordChange = !!profile?.must_change_password
  const displayRole = String(profile?.role || '')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
  const idLabel = profile?.role === 'student' ? 'Student ID' : 'Staff ID'
  const avatarUrl = user?.user_metadata?.avatar_url || null
  const avatarFallback = String(navNameEng || profile?.full_name || user?.email || 'U').trim().charAt(0).toUpperCase()

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

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--app-bg)', color: 'var(--text-primary)' }}>
      {/* Navbar */}
      <nav style={{ background: 'var(--nav-bg)', borderBottom: '3px solid #d1232a' }}>
        <div className="w-full px-3 sm:px-6 py-3 flex justify-between items-center">
          {/* Left — Royal School Logo */}
          <div className="flex items-center gap-8">
            <img
              src="/LOGO_ROYAL_SCHOOL_3.png"
              alt="Royal School International"
              className="h-12 w-auto"
            />
            <div className="flex flex-col">
              <div className="text-xl font-bold text-white tracking-tight">Cambridge Programme Portal</div>
              <div className="text-xs text-gray-400">Royal School • Phu Lam Campus</div>
            </div>
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
                    <div className="w-60 rounded-lg border shadow-lg overflow-hidden" style={{ backgroundColor: 'var(--nav-bg)', borderColor: 'var(--menu-border)' }}>
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

            {/* Global Academic Status Indicator */}
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-300">Academic Year:</span>
                  <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ backgroundColor: '#1f86c7', color: '#ffffff' }}>
                    2026 - 2027
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-300">Current Week:</span>
                  <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ backgroundColor: '#ffc612', color: '#1a1a1a' }}>
                    {ALL_WEEKS[getCurrentWeekIndex()]?.label || 'Week 0'}
                  </span>
                </div>
              </div>
              {sessionStorage.getItem('debug_week_override') !== null && (
                <span className="text-xs font-semibold italic text-amber-400">
                  Admin date override in progress.
                </span>
              )}
            </div>
          </div>

          {/* Right — Cambridge Logo + user info */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Profile"
                  className="w-8 h-8 rounded-full object-cover border border-gray-600"
                />
              ) : (
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold" style={{ backgroundColor: '#1f86c7' }}>
                  {avatarFallback}
                </div>
              )}
              <div className="leading-tight text-right">
                <div className="text-xs font-medium text-gray-100">
                  <span>{navNameEng || 'User'}</span>
                  {navNameVn ? (
                    <>
                      <span className="text-gray-400 px-1">-</span>
                      <span className="text-blue-300">{navNameVn}</span>
                    </>
                  ) : null}
                </div>
                <div className="text-xs text-gray-400">{idLabel}: {profile?.staff_id || '—'}</div>
              </div>
              <span className="text-xs px-2 py-1 rounded-full font-medium"
                style={{
                  background: profile?.role === 'admin' ? '#d1232a' : '#1f86c7',
                  color: '#fff'
                }}>
                {displayRole || 'User'}
              </span>
              <div className="flex flex-col items-start gap-1">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="w-20 text-[10px] text-center font-semibold px-2 py-1 rounded-md transition-colors"
                  style={{
                    color: '#ffffff',
                    backgroundColor: '#1f86c7',
                  }}
                  onMouseOver={e => { e.currentTarget.style.backgroundColor = '#166a9d' }}
                  onMouseOut={e => { e.currentTarget.style.backgroundColor = '#1f86c7' }}
                >
                  {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                </button>
                <Link
                  to="/settings"
                  className="w-20 text-[10px] text-center font-semibold px-2 py-1 rounded-md transition-colors"
                  style={{ color: '#1a1a1a', backgroundColor: '#ffc612' }}
                  onMouseOver={e => {
                    e.currentTarget.style.backgroundColor = '#e0ae10'
                    e.currentTarget.style.color = '#111827'
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.backgroundColor = '#ffc612'
                    e.currentTarget.style.color = '#1a1a1a'
                  }}
                  onClick={e => {
                    if (!confirmUnsavedGradebookNavigation()) {
                      e.preventDefault()
                    }
                  }}
                >
                  Settings
                </Link>
                <button
                  onClick={() => {
                    if (!confirmUnsavedGradebookNavigation()) return
                    handleSignOut()
                  }}
                  className="w-20 text-[10px] text-center font-semibold px-2 py-1 rounded-md transition-colors"
                  style={{ color: '#ffffff', backgroundColor: '#d1232a' }}
                  onMouseOver={e => { e.currentTarget.style.backgroundColor = '#a81b22' }}
                  onMouseOut={e => { e.currentTarget.style.backgroundColor = '#d1232a' }}
                >
                  Sign Out
                </button>
              </div>
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