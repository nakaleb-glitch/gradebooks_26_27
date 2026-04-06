import { useAuth } from '../contexts/AuthContext'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'

export default function Dashboard() {
  const { profile, user } = useAuth()

  return (
    <Layout>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        Welcome, {profile?.full_name || user?.email}
      </h2>
      <p className="text-gray-500 mb-8">
        {profile?.role === 'admin' ? 'Administrator' : 'Teacher'} · 2026–27
      </p>

      {profile?.role === 'admin' && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Link to="/admin/students" className="bg-white rounded-xl border border-gray-200 p-6 hover:border-blue-300 transition-colors">
            <div className="text-2xl mb-2">👥</div>
            <div className="font-semibold text-gray-900">Students</div>
            <div className="text-sm text-gray-500 mt-1">Import and manage students</div>
          </Link>
          <Link to="/admin/classes" className="bg-white rounded-xl border border-gray-200 p-6 hover:border-blue-300 transition-colors">
            <div className="text-2xl mb-2">🏫</div>
            <div className="font-semibold text-gray-900">Classes</div>
            <div className="text-sm text-gray-500 mt-1">Create and assign classes</div>
          </Link>
          <Link to="/admin/users" className="bg-white rounded-xl border border-gray-200 p-6 hover:border-blue-300 transition-colors">
            <div className="text-2xl mb-2">👤</div>
            <div className="font-semibold text-gray-900">Users</div>
            <div className="text-sm text-gray-500 mt-1">Manage teacher accounts</div>
          </Link>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
        {profile?.role === 'admin' 
          ? 'Select a section above to get started.'
          : 'No classes assigned yet. Contact your administrator.'}
      </div>
    </Layout>
  )
}