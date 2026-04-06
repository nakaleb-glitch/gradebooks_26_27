import { useAuth } from '../contexts/AuthContext'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const { user, signInWithGoogle } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) navigate('/dashboard')
  }, [user])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 w-full max-w-md text-center">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Gradebook Portal</h1>
          <p className="text-gray-500 text-sm">Sign in with your school Google account</p>
        </div>
        <button
          onClick={signInWithGoogle}
          className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-lg px-6 py-3 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
        >
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5" />
          Continue with Google
        </button>
      </div>
    </div>
  )
}