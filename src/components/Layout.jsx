import { useAuth } from '../contexts/AuthContext'
import { useNavigate, Link, useLocation } from 'react-router-dom'

export default function Layout({ children }) {
  const { profile, user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const navItems = [
    { label: 'Dashboard', path: '/dashboard' },
    ...(profile?.role === 'admin' ? [
      { label: 'Students', path: '/admin/students' },
      { label: 'Classes', path: '/admin/classes' },
      { label: 'Users', path: '/admin/users' },
    ] : []),
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-8">
            <h1 className="text-lg font-bold text-gray-900">Gradebook Portal</h1>
            <div className="flex gap-4">
              {navItems.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`text-sm font-medium transition-colors ${
                    location.pathname === item.path
                      ? 'text-blue-600'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{user?.email}</span>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
              profile?.role === 'admin' 
                ? 'bg-purple-100 text-purple-700' 
                : 'bg-blue-100 text-blue-700'
            }`}>
              {profile?.role}
            </span>
            <button
              onClick={handleSignOut}
              className="text-sm text-red-500 hover:text-red-700"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto px-6 py-10">
        {children}
      </main>
    </div>
  )
}