import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'

const SUBJECTS = {
  primary: ['ESL', 'GP', 'Mathematics', 'Science', 'Global Perspectives'],
  secondary: ['ESL', 'GP', 'Mathematics', 'Science', 'Global Perspectives'],
}

const getEligibleTeachers = (teachers, classSubject, classLevel) => {
  if (!classSubject || !classLevel) return teachers
  return teachers.filter(t => {
    if (t.level !== classLevel) return false
    const s = t.subject
    if (classSubject === 'ESL') return s === 'ESL/GP'
    if (classSubject === 'GP') return s === 'ESL/GP'
    if (classSubject === 'Mathematics') return s === 'Maths' || s === 'Science'
    if (classSubject === 'Science') return s === 'Science' || s === 'Maths'
    return true
  })
}

export default function Classes() {
  const [classes, setClasses] = useState([])
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name: '', subject: '', level: 'primary', programme: 'bilingual', teacher_id: ''
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [confirmDelete, setConfirmDelete] = useState(null)

  useEffect(() => {
    fetchClasses()
    fetchTeachers()
  }, [])

  const fetchClasses = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('classes')
      .select('*, users(full_name, email)')
      .order('name')
    setClasses(data || [])
    setLoading(false)
  }

  const fetchTeachers = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, full_name, email, level, subject')
      .order('full_name')
    setTeachers(data || [])
  }

  const handleSubmit = async () => {
    if (!form.name || !form.subject || !form.level || !form.programme) return
    setSaving(true)

    const { data: newClass, error: classError } = await supabase
      .from('classes')
      .insert({
        name: form.name,
        subject: form.subject,
        level: form.level,
        programme: form.programme,
        teacher_id: form.teacher_id || null,
        academic_year: '2026-27'
      })
      .select()
      .single()

    if (classError) {
      setMessage({ type: 'error', text: classError.message })
      setSaving(false)
      return
    }

    const homeroom = form.name.split(' ')[0]
    const { data: matchedStudents, error: studentError } = await supabase
      .from('students').select('id').eq('class', homeroom)

    if (studentError) {
      setMessage({ type: 'error', text: 'Class created but could not find students: ' + studentError.message })
      setSaving(false)
      return
    }

    if (matchedStudents.length > 0) {
      const { error: enrolError } = await supabase
        .from('class_students')
        .insert(matchedStudents.map(s => ({ class_id: newClass.id, student_id: s.id })))
      if (enrolError) {
        setMessage({ type: 'error', text: 'Class created but enrolment failed: ' + enrolError.message })
        setSaving(false)
        return
      }
      setMessage({ type: 'success', text: `Class created and ${matchedStudents.length} students enrolled automatically.` })
    } else {
      setMessage({ type: 'success', text: 'Class created. No students found for homeroom ' + homeroom + '.' })
    }

    setForm({ name: '', subject: '', level: 'primary', programme: 'bilingual', teacher_id: '' })
    setShowForm(false)
    fetchClasses()
    setSaving(false)
  }

  const startEdit = (cls) => {
    setEditingId(cls.id)
    setEditForm({ name: cls.name, subject: cls.subject, level: cls.level, programme: cls.programme, teacher_id: cls.teacher_id || '' })
  }

  const saveEdit = async (classId) => {
    const { error } = await supabase
      .from('classes')
      .update({ name: editForm.name, subject: editForm.subject, level: editForm.level, programme: editForm.programme, teacher_id: editForm.teacher_id || null })
      .eq('id', classId)
    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'success', text: 'Class updated successfully.' })
      setEditingId(null)
      fetchClasses()
    }
  }

  const deleteClass = async (classId) => {
    const { error } = await supabase.from('classes').delete().eq('id', classId)
    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'success', text: 'Class deleted.' })
      setConfirmDelete(null)
      fetchClasses()
    }
  }

  const levelLabel = (l) => l === 'primary' ? 'Primary' : 'Secondary'
  const programmeLabel = (p) => p === 'bilingual' ? 'Bilingual' : 'Integrated'
  const programmeBadgeStyle = (p) => p === 'bilingual' ? 'bg-purple-100 text-purple-700' : 'bg-teal-100 text-teal-700'

  const filteredTeachers = getEligibleTeachers(teachers, form.subject, form.level)
  const editFilteredTeachers = getEligibleTeachers(teachers, editForm.subject, editForm.level)

  return (
    <Layout>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Classes</h2>
          <p className="text-gray-500 text-sm mt-1">{classes.length} classes · 2026–27</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          {showForm ? 'Cancel' : '+ New Class'}
        </button>
      </div>

      {message && (
        <div className={`mb-6 px-4 py-3 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-4 opacity-50 hover:opacity-100">✕</button>
        </div>
      )}

      {confirmDelete && (
        <div className="mb-6 px-4 py-4 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm font-medium text-red-700 mb-3">Are you sure you want to delete <strong>{confirmDelete.name}</strong>?</p>
          <div className="flex gap-2">
            <button onClick={() => deleteClass(confirmDelete.id)} className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">Yes, delete</button>
            <button onClick={() => setConfirmDelete(null)} className="px-4 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">Create New Class</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Class Name</label>
              <input type="text" placeholder="e.g. 2B2 ESL" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Level</label>
              <select value={form.level} onChange={e => setForm({ ...form, level: e.target.value, subject: '', teacher_id: '' })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="primary">Primary</option>
                <option value="secondary">Secondary</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Programme</label>
              <select value={form.programme} onChange={e => setForm({ ...form, programme: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="bilingual">Bilingual</option>
                <option value="integrated">Integrated</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Subject</label>
              <select value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value, teacher_id: '' })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select subject</option>
                {SUBJECTS[form.level].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">
                Assign Teacher {form.subject && `(${filteredTeachers.length} eligible)`}
              </label>
              <select value={form.teacher_id} onChange={e => setForm({ ...form, teacher_id: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Unassigned</option>
                {filteredTeachers.map(t => <option key={t.id} value={t.id}>{t.full_name || t.email}</option>)}
              </select>
            </div>
          </div>
          <button onClick={handleSubmit} disabled={saving}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300">
            {saving ? 'Creating...' : 'Create Class'}
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : classes.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No classes yet. Create one to get started.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Class Name</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Level</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Programme</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Subject</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Teacher</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {classes.map(cls => (
                <tr key={cls.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {editingId === cls.id ? (
                      <input type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                        className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-32" />
                    ) : cls.name}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === cls.id ? (
                      <select value={editForm.level} onChange={e => setEditForm({ ...editForm, level: e.target.value, teacher_id: '' })}
                        className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="primary">Primary</option>
                        <option value="secondary">Secondary</option>
                      </select>
                    ) : (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">{levelLabel(cls.level)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === cls.id ? (
                      <select value={editForm.programme} onChange={e => setEditForm({ ...editForm, programme: e.target.value })}
                        className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="bilingual">Bilingual</option>
                        <option value="integrated">Integrated</option>
                      </select>
                    ) : (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${programmeBadgeStyle(cls.programme)}`}>{programmeLabel(cls.programme)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{cls.subject}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {editingId === cls.id ? (
                      <select value={editForm.teacher_id} onChange={e => setEditForm({ ...editForm, teacher_id: e.target.value })}
                        className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Unassigned</option>
                        {editFilteredTeachers.map(t => <option key={t.id} value={t.id}>{t.full_name || t.email}</option>)}
                      </select>
                    ) : (
                      cls.users?.full_name || cls.users?.email || <span className="text-gray-400 italic">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === cls.id ? (
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(cls.id)} className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">Save</button>
                        <button onClick={() => setEditingId(null)} className="px-3 py-1 border border-gray-300 text-gray-600 rounded-lg text-xs hover:bg-gray-50">Cancel</button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(cls)} className="px-3 py-1 border border-gray-300 text-gray-600 rounded-lg text-xs hover:bg-gray-50">Edit</button>
                        <button onClick={() => setConfirmDelete(cls)} className="px-3 py-1 border border-red-200 text-red-500 rounded-lg text-xs hover:bg-red-50">Delete</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  )
}