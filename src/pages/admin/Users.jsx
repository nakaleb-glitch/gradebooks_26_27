import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { useAuth } from '../../contexts/AuthContext'
import Papa from 'papaparse'

const LEVELS = ['primary', 'lower_secondary', 'igcse', 'ielts']
const SUBJECTS = ['ESL', 'Mathematics', 'Science', 'Global Perspectives']

const levelLabel = (l) => ({
  primary: 'Primary',
  lower_secondary: 'Lower Sec',
  igcse: 'IGCSE',
  ielts: 'IELTS',
}[l] || l)

export default function Users() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editForms, setEditForms] = useState({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [importing, setImporting] = useState(false)

  useEffect(() => { fetchUsers() }, [])

  const fetchUsers = async () => {
    setLoading(true)
    const { data } = await supabase.from('users').select('*').order('full_name')
    setUsers(data || [])
    setLoading(false)
  }

  const startEditing = (userList) => {
    const forms = {}
    userList.forEach(u => {
      forms[u.id] = {
        full_name: u.full_name || '',
        role: u.role || 'teacher',
        level: u.level || '',
        subject: u.subject || '',
      }
    })
    setEditForms(forms)
    setEditing(true)
  }

  const cancelEditing = () => {
    setEditing(false)
    setEditForms({})
  }

  const saveAll = async () => {
    setSaving(true)
    const errors = []
    for (const user of users) {
      const form = editForms[user.id]
      const { error } = await supabase
        .from('users')
        .update({
          full_name: form.full_name,
          role: form.role,
          level: form.level || null,
          subject: form.subject || null,
        })
        .eq('id', user.id)
      if (error) errors.push(form.full_name || user.id)
    }

    if (errors.length > 0) {
      setMessage({ type: 'error', text: `Failed to save: ${errors.join(', ')}` })
    } else {
      setMessage({ type: 'success', text: 'All users saved successfully.' })
    }
    setSaving(false)
    setEditing(false)
    setEditForms({})
    fetchUsers()
  }

  const updateField = (userId, field, value) => {
    setEditForms(prev => ({
      ...prev,
      [userId]: { ...prev[userId], [field]: value }
    }))
  }

  const deleteUser = async (userId) => {
    const { error } = await supabase.from('users').delete().eq('id', userId)
    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'success', text: 'User removed.' })
      setConfirmDelete(null)
      fetchUsers()
    }
  }

  const handleCSV = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true)
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const teachers = results.data.map(row => ({
          full_name: row['Full Name'] || row['full_name'],
          email: row['Email'] || row['email'],
          level: row['Level'] || row['level'] || null,
          subject: row['Subject'] || row['subject'] || null,
        }))

        const { data: { session } } = await supabase.auth.getSession()
        const { data, error } = await supabase.functions.invoke('create-teachers', {
          body: { teachers },
          headers: { Authorization: `Bearer ${session.access_token}` }
        })

        if (error) {
          setMessage({ type: 'error', text: 'Import failed: ' + error.message })
        } else {
          const successCount = data.results?.length || 0
          const errorCount = data.errors?.length || 0
          if (errorCount > 0) {
            const errorList = data.errors.map(e => e.email + ': ' + e.error).join(', ')
            setMessage({ type: 'error', text: `${successCount} imported, ${errorCount} failed: ${errorList}` })
          } else {
            setMessage({ type: 'success', text: `${successCount} teachers imported successfully with default password royal@123` })
          }
          fetchUsers()
        }
        setImporting(false)
        e.target.value = ''
      }
    })
  }

  return (
    <Layout>
      {/* Header */}
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Users</h2>
          <p className="text-gray-500 text-sm mt-1">{users.length} users in the system</p>
        </div>
        <div className="flex gap-3">
          {!editing ? (
            <>
              <button
                onClick={() => startEditing(users)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                ✏️ Edit All
              </button>
              <label className={`cursor-pointer px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
                importing ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
              }`}>
                {importing ? 'Importing...' : '+ Import Teachers CSV'}
                <input type="file" accept=".csv" className="hidden" onChange={handleCSV} disabled={importing} />
              </label>
            </>
          ) : (
            <button
              onClick={cancelEditing}
              className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-6 px-4 py-3 rounded-lg text-sm font-medium ${
          message.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-4 opacity-50 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Confirm Delete */}
      {confirmDelete && (
        <div className="mb-6 px-4 py-4 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm font-medium text-red-700 mb-3">
            Are you sure you want to remove <strong>{confirmDelete.full_name || confirmDelete.email}</strong>? This cannot be undone.
          </p>
          <div className="flex gap-2">
            <button onClick={() => deleteUser(confirmDelete.id)}
              className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
              Yes, remove user
            </button>
            <button onClick={() => setConfirmDelete(null)}
              className="px-4 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden ${editing ? 'mb-24' : ''}`}>
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No users yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Name</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Email</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Role</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Level</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Subject</th>
                {!editing && (
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map(user => (
                <tr key={user.id} className={editing ? 'bg-yellow-50' : 'hover:bg-gray-50'}>
                  <td className="px-6 py-3">
                    {editing ? (
                      <input
                        type="text"
                        value={editForms[user.id]?.full_name || ''}
                        onChange={e => updateField(user.id, 'full_name', e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
                      />
                    ) : (
                      <span className="font-medium text-gray-900">
                        {user.full_name || <span className="text-gray-400 italic">No name</span>}
                        {user.id === currentUser?.id && (
                          <span className="ml-2 text-xs text-gray-400">(you)</span>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-gray-600">{user.email}</td>
                  <td className="px-6 py-3">
                    {editing ? (
                      <select
                        value={editForms[user.id]?.role || 'teacher'}
                        onChange={e => updateField(user.id, 'role', e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="teacher">Teacher</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        user.role === 'admin' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {user.role}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    {editing ? (
                      <select
                        value={editForms[user.id]?.level || ''}
                        onChange={e => updateField(user.id, 'level', e.target.value)}
                        className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">—</option>
                        {LEVELS.map(l => (
                          <option key={l} value={l}>{levelLabel(l)}</option>
                        ))}
                      </select>
                    ) : (
                      user.level
                        ? <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">{levelLabel(user.level)}</span>
                        : <span className="text-gray-400 italic text-xs">—</span>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    {editing ? (
                      <select
                        value={editForms[user.id]?.subject || ''}
                        onChange={e => updateField(user.id, 'subject', e.target.value)}
                        className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">—</option>
                        {SUBJECTS.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    ) : (
                      user.subject
                        ? <span className="text-gray-700">{user.subject}</span>
                        : <span className="text-gray-400 italic text-xs">—</span>
                    )}
                  </td>
                  {!editing && (
                    <td className="px-6 py-3">
                      <button
                        onClick={() => setConfirmDelete(user)}
                        disabled={user.id === currentUser?.id}
                        className="px-3 py-1 border border-red-200 text-red-500 rounded-lg text-xs hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* CSV format hint */}
      <div className={`mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200 ${editing ? 'mb-24' : ''}`}>
        <p className="text-xs text-gray-500 font-medium mb-2">CSV Format — your file should have these column headers:</p>
        <code className="text-xs text-gray-600">Full Name, Email, Level, Subject</code>
        <p className="text-xs text-gray-400 mt-2">Level: primary · lower_secondary · igcse · ielts</p>
        <p className="text-xs text-gray-400">Subject: ESL · Mathematics · Science · Global Perspectives</p>
        <p className="text-xs text-gray-400 mt-1">All teachers will be created with the default password: royal@123</p>
      </div>

      {/* Sticky save bar */}
      {editing && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg px-6 py-4 flex justify-between items-center">
          <p className="text-sm text-gray-500">Editing all users — changes are not yet saved.</p>
          <button
            onClick={saveAll}
            disabled={saving}
            className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:bg-gray-300"
          >
            {saving ? 'Saving...' : '✓ Save All Changes'}
          </button>
        </div>
      )}
    </Layout>
  )
}