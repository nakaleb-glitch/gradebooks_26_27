import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import ProfileAvatar from '../../components/ProfileAvatar'
import { useAuth } from '../../contexts/AuthContext'
import Papa from 'papaparse'
import { useNavigate } from 'react-router-dom'

const LEVELS = ['primary', 'secondary']
const SUBJECTS = ['ESL/GP', 'Mathematics', 'Science', 'VN ESL']

const levelLabel = (l) => ({
  primary: 'Primary',
  secondary: 'Secondary',
}[l] || String(l || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()))

export default function Users() {
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [classesByTeacher, setClassesByTeacher] = useState({})
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editForms, setEditForms] = useState({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [confirmReset, setConfirmReset] = useState(null)
  const [resetRequestsByStaffId, setResetRequestsByStaffId] = useState({})
  const [importing, setImporting] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [creatingTeacher, setCreatingTeacher] = useState(false)
  const [createTeacherForm, setCreateTeacherForm] = useState({
    full_name: '',
    staff_id: '',
    email: '',
    role: 'teacher',
    level: '',
    subject: '',
  })
  const [rowEditingId, setRowEditingId] = useState(null)
  const [rowEditForm, setRowEditForm] = useState({
    full_name: '',
    staff_id: '',
    role: 'teacher',
    level: '',
    subject: '',
  })
  const usersCsvTemplate = [
    'Full Name,Staff ID,Email,Role,Level,Subject',
    'Teacher One,T001,teacher1@royal.edu.vn,teacher,primary,ESL/GP',
    'Teacher Two,T002,teacher2@royal.edu.vn,teacher,secondary,Mathematics',
    'Teacher Three,T003,teacher3@royal.edu.vn,admin,secondary,Science',
  ].join('\n')
  const usersCsvTemplateHref = `data:text/csv;charset=utf-8,${encodeURIComponent(usersCsvTemplate)}`

  const getValidAccessToken = async () => {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) return null

    const currentToken = sessionData?.session?.access_token
    if (currentToken) return currentToken

    const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError) return null
    return refreshedData?.session?.access_token || null
  }

  const capitalizeFirstAlpha = (value) => {
    const v = String(value || '').trim()
    const idx = v.search(/[A-Za-z]/)
    if (idx === -1) return v
    return v.slice(0, idx) + v.charAt(idx).toUpperCase() + v.slice(idx + 1)
  }

  const normalizeLevel = (value) => {
    const v = String(value || '').trim().toLowerCase()
    if (v === 'primary') return 'primary'
    if (v === 'secondary') return 'secondary'
    return ''
  }

  const normalizeSubject = (value) => {
    const v = String(value || '').trim().toLowerCase()
    if (v === 'esl/gp') return 'ESL/GP'
    if (v === 'mathematics') return 'Mathematics'
    if (v === 'science') return 'Science'
    if (v === 'vn esl') return 'VN ESL'
    return capitalizeFirstAlpha(value)
  }

  const formatDisplayText = (value) =>
    String(value || '')
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase())

  const formatSubjectDisplay = (value) => {
    const normalized = String(value || '').trim().toLowerCase()
    if (normalized === 'esl/gp' || normalized === 'eslgp') return 'ESL/GP'
    if (normalized === 'mathematics') return 'Mathematics'
    if (normalized === 'science') return 'Science'
    if (normalized === 'vn esl' || normalized === 'vnesl') return 'VN ESL'
    return formatDisplayText(value)
  }

  useEffect(() => { fetchUsers() }, [])

  const fetchUsers = async () => {
    setLoading(true)
    const [{ data: usersData }, { data: classesData }, { data: resetRequestsData }] = await Promise.all([
      supabase.from('users').select('*').in('role', ['teacher', 'admin', 'admin_teacher']).order('full_name'),
      supabase.from('classes').select('id, name, subject, teacher_id').order('name'),
      supabase
        .from('password_reset_requests')
        .select('id, staff_id, status, created_at')
        .eq('status', 'new')
        .order('created_at', { ascending: false }),
    ])

    const classMap = {}
    ;(classesData || []).forEach((cls) => {
      if (!cls.teacher_id) return
      if (!classMap[cls.teacher_id]) classMap[cls.teacher_id] = []
      classMap[cls.teacher_id].push(cls.name)
    })

    Object.keys(classMap).forEach((teacherId) => {
      classMap[teacherId].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    })

    setClassesByTeacher(classMap)
    const requestMap = {}
    ;(resetRequestsData || []).forEach((req) => {
      const key = String(req.staff_id || '').trim().toLowerCase()
      if (!key) return
      requestMap[key] = (requestMap[key] || 0) + 1
    })
    setResetRequestsByStaffId(requestMap)
    const data = usersData
    setUsers(data || [])
    setLoading(false)
  }

  const startEditing = (userList) => {
    const forms = {}
    userList.forEach(u => {
      forms[u.id] = {
        full_name: u.full_name || '',
        staff_id: u.staff_id || '',
        role: u.role || 'teacher',
        level: u.level || '',
        subject: u.subject || '',
      }
    })
    setEditForms(forms)
    setShowCreateForm(false)
    setEditing(true)
  }

  const cancelEditing = () => {
    setEditing(false)
    setEditForms({})
  }

  const startRowEdit = (u) => {
    setRowEditingId(u.id)
    setRowEditForm({
      full_name: u.full_name || '',
      staff_id: u.staff_id || '',
      role: u.role || 'teacher',
      level: u.level || '',
      subject: u.subject || '',
    })
  }

  const cancelRowEdit = () => {
    setRowEditingId(null)
    setRowEditForm({
      full_name: '',
      staff_id: '',
      role: 'teacher',
      level: '',
      subject: '',
    })
  }

  const saveRowEdit = async (userId) => {
    const { error } = await supabase
      .from('users')
      .update({
        full_name: rowEditForm.full_name,
        staff_id: rowEditForm.staff_id || null,
        role: rowEditForm.role,
        level: rowEditForm.level || null,
        subject: rowEditForm.subject || null,
      })
      .eq('id', userId)

    if (error) {
      setMessage({ type: 'error', text: error.message })
      return
    }

    setMessage({ type: 'success', text: 'User updated successfully.' })
    cancelRowEdit()
    fetchUsers()
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
          staff_id: form.staff_id || null,
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

  const createTeacher = async () => {
    const full_name = capitalizeFirstAlpha(createTeacherForm.full_name)
    const staff_id = capitalizeFirstAlpha(createTeacherForm.staff_id)
    const email = String(createTeacherForm.email || '').trim().toLowerCase()
    const role = createTeacherForm.role === 'admin' ? 'admin' : 'teacher'
    const level = normalizeLevel(createTeacherForm.level)
    const subject = normalizeSubject(createTeacherForm.subject)

    const missing = []
    if (!full_name) missing.push('Full Name')
    if (!staff_id) missing.push('Staff ID')
    if (!email) missing.push('Email')

    if (missing.length > 0) {
      setMessage({ type: 'error', text: `Please complete: ${missing.join(', ')}` })
      return
    }

    const token = await getValidAccessToken()
    if (!token) {
      setMessage({ type: 'error', text: 'Your session expired. Please sign out and sign in again as admin.' })
      return
    }

    setCreatingTeacher(true)
    const { data, error } = await supabase.functions.invoke('create-teachers', {
      body: {
        teachers: [{ full_name, staff_id, email, role, level: level || null, subject: subject || null }]
      },
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
    })

    if (error) {
      setMessage({ type: 'error', text: `Unable to create user: ${error.message}` })
      setCreatingTeacher(false)
      return
    }

    const createdCount = data?.results?.length || 0
    const createErrors = data?.errors || []
    if (createdCount === 0 || createErrors.length > 0) {
      setMessage({ type: 'error', text: createErrors[0]?.error || 'Unable to create user.' })
      setCreatingTeacher(false)
      return
    }

    setMessage({ type: 'success', text: `User created successfully. Default password is royal@123.` })
    setCreateTeacherForm({
      full_name: '',
      staff_id: '',
      email: '',
      role: 'teacher',
      level: '',
      subject: '',
    })
    setShowCreateForm(false)
    setCreatingTeacher(false)
    fetchUsers()
  }

  const updateField = (userId, field, value) => {
    setEditForms(prev => ({
      ...prev,
      [userId]: { ...prev[userId], [field]: value }
    }))
  }

  const deleteUser = async (userId) => {
    const token = await getValidAccessToken()
    if (!token) {
      setMessage({ type: 'error', text: 'Your session expired. Please sign out and sign in again as admin.' })
      return
    }

    const { error } = await supabase.functions.invoke('delete-user', {
      body: { user_id: userId },
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
    })

    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'success', text: 'User removed and unassigned from classes.' })
      setConfirmDelete(null)
      fetchUsers()
    }
  }

  const resetUserPassword = async (targetUser) => {
    const token = await getValidAccessToken()
    if (!token) {
      setMessage({ type: 'error', text: 'Your session expired. Please sign out and sign in again as admin.' })
      return
    }

    const { error } = await supabase.functions.invoke('reset-user-password', {
      body: { user_id: targetUser.id },
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
    })

    if (error) {
      setMessage({ type: 'error', text: `Password reset failed for ${targetUser.email}: ${error.message}` })
      return
    }

    setUsers(prev =>
      prev.map(u => (u.id === targetUser.id ? { ...u, must_change_password: true } : u))
    )

    const normalizedStaffId = String(targetUser.staff_id || '').trim().toLowerCase()
    if (normalizedStaffId) {
      await supabase
        .from('password_reset_requests')
        .update({ status: 'resolved', resolved_at: new Date().toISOString() })
        .eq('status', 'new')
        .ilike('staff_id', targetUser.staff_id)
    }

    setMessage({ type: 'success', text: `Password reset for ${targetUser.email}. Default password is royal@123.` })
    setConfirmReset(null)
    fetchUsers()
  }

  const handleCSV = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true)
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data || []
        const teachers = []
        const localErrors = []

        rows.forEach((row, index) => {
          const full_name = capitalizeFirstAlpha(row['Full Name'] || row['full_name'] || '')
          const staff_id = capitalizeFirstAlpha(row['Staff ID'] || row['staff_id'] || '')
          const email = (row['Email'] || row['email'] || '').trim().toLowerCase()
          const roleRaw = (row['Role'] || row['role'] || '').trim().toLowerCase()
          const role = roleRaw === 'admin' ? 'admin' : 'teacher'
          const level = normalizeLevel(row['Level'] || row['level'] || '')
          const subject = normalizeSubject(row['Subject'] || row['subject'] || '')

          const missing = []
          if (!full_name) missing.push('Full Name')
          if (!staff_id) missing.push('Staff ID')
          if (!email) missing.push('Email')
          if (!level) missing.push('Level')
          if (!subject) missing.push('Subject')

          if (missing.length > 0) {
            localErrors.push(`row ${index + 1}: missing ${missing.join(', ')}`)
            return
          }

          teachers.push({ full_name, staff_id, email, role, level, subject })
        })

        const token = await getValidAccessToken()
        if (!token) {
          setMessage({ type: 'error', text: 'Your session expired. Please sign out and sign in again as admin.' })
          setImporting(false)
          e.target.value = ''
          return
        }

        const { data, error } = await supabase.functions.invoke('create-teachers', {
          body: { teachers },
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
        })

        if (error) {
          setMessage({ type: 'error', text: 'Import failed: ' + error.message })
        } else {
          const successCount = data.results?.length || 0
          const remoteErrors = data.errors || []
          const allErrors = [...localErrors, ...remoteErrors.map(e => `row ${e.row || '?'}: ${e.error}`)]
          const errorCount = allErrors.length
          if (errorCount > 0) {
            setMessage({ type: 'error', text: `${successCount} imported, ${errorCount} failed: ${allErrors.join(' | ')}` })
          } else {
            setMessage({ type: 'success', text: `${successCount} users imported successfully with default password royal@123` })
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
      <button
        onClick={() => navigate('/dashboard')}
        className="text-white px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity mb-4 flex items-center gap-2 text-sm"
        style={{ backgroundColor: '#1f86c7' }}
      >
        ← Go Back
      </button>
      {/* Header */}
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Teacher Management</h2>
          <p className="text-gray-500 text-sm mt-1">View, add, edit or remove teacher accounts.</p>
        </div>
        <div className="flex items-start gap-3 flex-wrap justify-end">
          <button
            onClick={() => {
              if (editing) return
              setShowCreateForm(prev => !prev)
            }}
            disabled={editing}
            className="w-32 px-3 py-1.5 rounded-lg text-sm font-medium text-white transition-colors text-center disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#16a34a' }}
            onMouseOver={e => { if (!editing) e.currentTarget.style.backgroundColor = '#15803d' }}
            onMouseOut={e => { if (!editing) e.currentTarget.style.backgroundColor = '#16a34a' }}
          >
            {showCreateForm && !editing ? 'Close Form' : 'New Teacher'}
          </button>
          <button
            onClick={() => {
              if (editing) {
                cancelEditing()
                return
              }
              startEditing(users)
            }}
            className="w-28 px-3 py-1.5 rounded-lg text-sm font-medium text-white transition-colors text-center"
            style={{ backgroundColor: '#1f86c7' }}
            onMouseOver={e => e.currentTarget.style.backgroundColor = '#166a9b'}
            onMouseOut={e => e.currentTarget.style.backgroundColor = '#1f86c7'}
          >
            {editing ? 'Exit Edit' : 'Edit All'}
          </button>
          {!editing && (
            <>
              <div className="flex flex-col items-center">
                <label
                  className={`cursor-pointer w-44 px-4 py-2 rounded-lg text-sm font-medium transition-colors text-center ${
                    importing ? 'bg-gray-300 text-gray-600' : ''
                  }`}
                  style={importing ? {} : { backgroundColor: '#ffc612', color: '#1a1a1a' }}
                  onMouseOver={e => { if (!importing) e.currentTarget.style.backgroundColor = '#e6b10f' }}
                  onMouseOut={e => { if (!importing) e.currentTarget.style.backgroundColor = '#ffc612' }}
                >
                  {importing ? 'Importing...' : '+ Import CSV'}
                  <input type="file" accept=".csv" className="hidden" onChange={handleCSV} disabled={importing} />
                </label>
                <a
                  href={usersCsvTemplateHref}
                  download="users_import_template.csv"
                  className="mt-1 text-xs hover:underline"
                  style={{ color: '#1f86c7' }}
                >
                  Download CSV Template
                </a>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Create Teacher Form */}
      {!editing && showCreateForm && (
        <div className="mb-6 p-4 rounded-xl border border-blue-200 bg-blue-50">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Create Teacher/Admin</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Full Name"
              value={createTeacherForm.full_name}
              onChange={(e) => setCreateTeacherForm(prev => ({ ...prev, full_name: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="Staff ID"
              value={createTeacherForm.staff_id}
              onChange={(e) => setCreateTeacherForm(prev => ({ ...prev, staff_id: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="email"
              placeholder="Email"
              value={createTeacherForm.email}
              onChange={(e) => setCreateTeacherForm(prev => ({ ...prev, email: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
             <select
               value={createTeacherForm.role}
               onChange={(e) => setCreateTeacherForm(prev => ({ ...prev, role: e.target.value }))}
               className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
             >
               <option value="teacher">Teacher</option>
               <option value="admin">Admin</option>
               <option value="admin_teacher">Admin + Teacher</option>
             </select>
            <select
              value={createTeacherForm.level}
              onChange={(e) => setCreateTeacherForm(prev => ({ ...prev, level: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Level (optional)</option>
              {LEVELS.map((l) => (
                <option key={l} value={l}>{levelLabel(l)}</option>
              ))}
            </select>
            <select
              value={createTeacherForm.subject}
              onChange={(e) => setCreateTeacherForm(prev => ({ ...prev, subject: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Subject (optional)</option>
              {SUBJECTS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={createTeacher}
              disabled={creatingTeacher}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-60"
            >
              {creatingTeacher ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </div>
      )}

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

      {/* Confirm Reset Password */}
      {confirmReset && (
        <div className="mb-6 px-4 py-4 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm font-medium text-red-700 mb-3">
            Reset password for <strong>{confirmReset.full_name || confirmReset.email}</strong>? Their password will be set to <strong>royal@123</strong> and they will be required to change it on next login.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => resetUserPassword(confirmReset)}
              className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
            >
              Yes, reset password
            </button>
            <button
              onClick={() => setConfirmReset(null)}
              className="px-4 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className={`bg-white rounded-xl border border-gray-200 overflow-x-auto overflow-y-visible ${editing ? 'mb-24' : ''}`}>
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No users yet.</div>
        ) : (
          <table className="w-full text-sm">
             <thead className="bg-gray-50 border-b border-gray-200">
               <tr>
                 <th className="text-left px-6 py-3 text-gray-500 font-medium w-[52px]"></th>
                 <th className="text-left px-6 py-3 text-gray-500 font-medium">Name</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Staff ID</th>
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
              {users.map(user => {
                const isRowEditing = !editing && rowEditingId === user.id
                const resetRequestCount = resetRequestsByStaffId[String(user.staff_id || '').trim().toLowerCase()] || 0
                return (
                 <tr key={user.id} className={editing ? 'bg-yellow-50' : 'hover:bg-gray-50'}>
                   <td className="px-3 py-3">
                     <ProfileAvatar avatarUrl={user.avatar_url} name={user.full_name} size={36} />
                   </td>
                   <td className="px-3 py-3">
                    {editing ? (
                      <input
                        type="text"
                        value={editForms[user.id]?.full_name || ''}
                        onChange={e => updateField(user.id, 'full_name', e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
                      />
                    ) : isRowEditing ? (
                      <input
                        type="text"
                        value={rowEditForm.full_name}
                        onChange={e => setRowEditForm(prev => ({ ...prev, full_name: e.target.value }))}
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
                      />
                    ) : (
                      <span className="relative inline-block group">
                        <span className="font-medium text-gray-900 cursor-default inline-flex items-center gap-2">
                          <span
                            className={`inline-block w-2 h-2 rounded-full ${user.must_change_password ? 'bg-red-500' : 'bg-green-500'}`}
                            title={user.must_change_password ? 'Pending activation' : 'Activated'}
                          />
                          <span>{user.full_name || <span className="text-gray-400 italic">No name</span>}</span>
                          {resetRequestCount > 0 && (
                            <span
                              className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium"
                              style={{ backgroundColor: '#FDEBEC', color: '#d1232a' }}
                            >
                              Reset Requested
                            </span>
                          )}
                          {user.id === currentUser?.id && (
                            <span className="text-xs text-gray-400">(you)</span>
                          )}
                        </span>
                        <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 z-30 hidden group-hover:block">
                          <div className="w-72 rounded-lg border border-gray-200 bg-white shadow-lg p-3">
                            <div className="text-xs font-semibold text-gray-700 mb-2">Assigned Classes:</div>
                            {(classesByTeacher[user.id] || []).length === 0 ? (
                              <div className="text-xs text-gray-400 italic">No classes assigned.</div>
                            ) : (
                              <div className="max-h-44 overflow-auto space-y-1">
                                {(classesByTeacher[user.id] || []).map((clsName) => (
                                  <div key={clsName} className="text-xs text-gray-600">{clsName}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-gray-600">
                    {editing ? (
                      <input
                        type="text"
                        value={editForms[user.id]?.staff_id || ''}
                        onChange={e => updateField(user.id, 'staff_id', e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-28"
                      />
                    ) : isRowEditing ? (
                      <input
                        type="text"
                        value={rowEditForm.staff_id}
                        onChange={e => setRowEditForm(prev => ({ ...prev, staff_id: e.target.value }))}
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-28"
                      />
                    ) : (
                      user.staff_id || <span className="text-gray-400 italic text-xs">—</span>
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
                        <option value="admin_teacher">Admin + Teacher</option>
                      </select>
                    ) : isRowEditing ? (
                      <select
                        value={rowEditForm.role}
                        onChange={e => setRowEditForm(prev => ({ ...prev, role: e.target.value }))}
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="teacher">Teacher</option>
                        <option value="admin">Admin</option>
                        <option value="admin_teacher">Admin + Teacher</option>
                      </select>
                     ) : (
                       user.role === 'admin_teacher' ? (
                         <div className="flex items-center gap-1">
                           <span className="text-xs px-2 py-1 rounded-full font-medium bg-red-100 text-red-700">
                             Admin
                           </span>
                           <span className="text-xs px-2 py-1 rounded-full font-medium bg-blue-100 text-blue-700">
                             Teacher
                           </span>
                         </div>
                       ) : (
                         <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                           user.role === 'admin' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                         }`}>
                           {formatDisplayText(user.role)}
                         </span>
                       )
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
                    ) : isRowEditing ? (
                      <select
                        value={rowEditForm.level}
                        onChange={e => setRowEditForm(prev => ({ ...prev, level: e.target.value }))}
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
                    ) : isRowEditing ? (
                      <select
                        value={rowEditForm.subject}
                        onChange={e => setRowEditForm(prev => ({ ...prev, subject: e.target.value }))}
                        className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">—</option>
                        {SUBJECTS.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    ) : (
                      user.subject
                        ? <span className="text-gray-700">{formatSubjectDisplay(user.subject)}</span>
                        : <span className="text-gray-400 italic text-xs">—</span>
                    )}
                  </td>
                  {!editing && (
                    <td className="px-6 py-3">
                      {isRowEditing ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveRowEdit(user.id)}
                            className="px-3 py-1 text-white rounded-lg text-xs font-medium"
                            style={{ backgroundColor: '#16a34a' }}
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelRowEdit}
                            className="px-3 py-1 border border-gray-300 text-gray-600 rounded-lg text-xs hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => startRowEdit(user)}
                            className="px-3 py-1 border rounded-lg text-xs font-medium text-white"
                            style={{ backgroundColor: '#1f86c7', borderColor: '#1f86c7' }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setConfirmReset(user)}
                            className={`px-3 py-1 border rounded-lg text-xs ${
                              resetRequestCount > 0
                                ? 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100'
                                : 'border-amber-300 text-amber-700 hover:bg-amber-50'
                            }`}
                          >
                            Reset Password
                          </button>
                          <button
                            onClick={() => setConfirmDelete(user)}
                            disabled={user.id === currentUser?.id}
                            className="px-3 py-1 border border-red-200 text-red-500 rounded-lg text-xs hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              )})}
            </tbody>
          </table>
        )}
      </div>

      {/* CSV format hint */}
      <div className={`mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200 ${editing ? 'mb-24' : ''}`}>
        <p className="text-xs text-gray-500 font-medium mb-2">CSV Format — your file should have these column headers:</p>
        <code className="text-xs text-gray-600">Full Name, Staff ID, Email, Role, Level, Subject</code>
        <p className="text-xs text-gray-400 mt-2">Level: primary · secondary</p>
        <p className="text-xs text-gray-400">Role defaults to teacher when blank. Valid roles: teacher · admin</p>
        <p className="text-xs text-gray-400">Subject: ESL/GP · Mathematics · Science · VN ESL</p>
        <p className="text-xs text-gray-400 mt-1">All imported users are created with default password royal@123 and must change password.</p>
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