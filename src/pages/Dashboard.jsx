import { useAuth } from '../contexts/AuthContext'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
  const { profile, user } = useAuth()
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (profile) fetchClasses()
  }, [profile])

  const fetchClasses = async () => {
    let query = supabase.from('classes').select('*').order('name')
    if (profile.role !== 'admin') {
      query = query.eq('teacher_id', profile.id)
    }
    const { data } = await query
    setClasses(data || [])
    setLoading(false)
  }

  const levelLabel = (l) => ({
    primary: 'Primary',
    lower_secondary: 'Lower Secondary',
    upper_secondary: 'Upper Secondary',
    high_school: 'High School',
  }[l] || l)

  const programmeLabel = (p) => p === 'bilingual' ? 'Bilingual' : 'Integrated'

  const programmeBadgeStyle = (p) => p === 'bilingual'
    ? 'bg-purple-100 text-purple-700'
    : 'bg-teal-100 text-teal-700'

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

      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        {profile?.role === 'admin' ? 'All Classes' : 'My Classes'}
      </h3>

      {loading ? (
        <div className="text-center text-gray-400 py-10">Loading...</div>
      ) : classes.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          {profile?.role === 'admin'
            ? 'No classes yet. Create one in the Classes section.'
            : 'No classes assigned yet. Contact your administrator.'}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {classes.map(cls => (
            <Link
              key={cls.id}
              to={`/class/${cls.id}`}
              className="bg-white rounded-xl border border-gray-200 p-6 hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <div className="font-semibold text-gray-900 mb-1">{cls.name}</div>
              <div className="text-sm text-gray-500">{cls.subject}</div>
              <div className="mt-3 flex gap-2">
                <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                  {levelLabel(cls.level)}
                </span>
                <span className={`text-xs px-2 py-1 rounded-full ${programmeBadgeStyle(cls.programme)}`}>
                  {programmeLabel(cls.programme)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Layout>
  )
}