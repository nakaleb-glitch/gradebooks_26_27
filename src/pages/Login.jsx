import { useAuth } from '../contexts/AuthContext'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const { user, signInWithGoogle, signInWithStaffId } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('teacher')
  const [staffId, setStaffId] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (user) navigate('/dashboard')
  }, [user, navigate])

  const handleStaffLogin = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    const { error: signInError } = await signInWithStaffId(staffId, password)
    if (signInError) {
      setError(signInError.message || 'Could not sign in. Please check credentials.')
    }
    setSubmitting(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#1a1a1a' }}>
      <div className="w-full max-w-md">
        {/* Logos */}
        <div className="flex items-center justify-between mb-8 px-2">
          <img src="/LOGO_ROYAL_SCHOOL_3.png" alt="Royal School" className="h-16 w-auto" />
          <img src="/LOGO_CAMBRIDGE_2.png" alt="Cambridge" className="h-12 w-auto" />
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-2xl">
          {/* Red top bar */}
          <div style={{ background: '#d1232a', height: '6px' }} />

          <div className="p-10 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Cambridge Programme Portal</h1>
            <p className="text-gray-400 text-sm mb-8">
              {mode === 'teacher'
                ? 'Sign in using your Royal Staff ID. You will be prompted to change your password after first logging in.'
                : 'Click the button below to login using your Royal credentials.'}
            </p>

            {mode === 'teacher' ? (
              <form onSubmit={handleStaffLogin} className="space-y-3 text-left">
                <input
                  type="text"
                  placeholder="Staff ID"
                  value={staffId}
                  onChange={e => setStaffId(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {error && (
                  <p className="text-xs text-red-600">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl px-6 py-3 text-white font-medium transition-colors disabled:bg-gray-300"
                  style={{ backgroundColor: '#1f86c7' }}
                >
                  {submitting ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
            ) : (
              <button
                onClick={signInWithGoogle}
                className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-xl px-6 py-3 text-gray-700 font-medium hover:bg-gray-50 transition-colors shadow-sm"
              >
                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                Continue with Google
              </button>
            )}

            <button
              onClick={() => {
                setMode(prev => prev === 'teacher' ? 'admin' : 'teacher')
                setError('')
              }}
              className="mt-4 text-xs text-gray-500 hover:text-gray-700 underline"
            >
              {mode === 'teacher' ? 'Admin Login' : 'Back to Teacher Login'}
            </button>
          </div>

          {/* Blue bottom bar */}
          <div style={{ background: '#1f86c7', height: '4px' }} />
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          Royal School International · Academic Year 2026-2027
        </p>
      </div>
    </div>
  )
}