import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function Dashboard() {
  const { profile, user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
        <h1 className="text-lg font-bold text-gray-900">Gradebook Portal</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{user?.email}</span>
          <button onClick={handleSignOut} className="text-sm text-red-500 hover:text-red-700">
            Sign out
          </button>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Welcome, {profile?.full_name || user?.email}
        </h2>
        <p className="text-gray-500 mb-8">
          {profile?.role === 'admin' ? 'Administrator' : 'Teacher'} · 2026–27
        </p>
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          No classes assigned yet.
        </div>
      </main>
    </div>
  )
}