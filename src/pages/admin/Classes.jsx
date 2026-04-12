import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { Link, useNavigate } from 'react-router-dom'
import Papa from 'papaparse'

const SUBJECTS = ['ESL', 'Mathematics', 'Science', 'Global Perspectives']
const ACADEMIC_YEAR = '2026-2027'

const levelLabel = (l) => ({
  primary: 'Primary',
  secondary: 'Secondary',
}[l] || l)

const programmeLabel = (p) => p === 'bilingual' ? 'Bilingual' : 'Integrated'
const programmeBadgeStyle = (p) => p === 'bilingual' ? 'bg-purple-100 text-purple-700' : 'bg-teal-100 text-teal-700'

const capitalizeFirstAlpha = (value) => {
  const v = String(value || '').trim()
  const idx = v.search(/[A-Za-z]/)
  if (idx === -1) return v
  return v.slice(0, idx) + v.charAt(idx).toUpperCase() + v.slice(idx + 1)
}

const normalizeLevel = (value) => {
  const v = String(value || '').trim().toLowerCase().replace(/\s+/g, '_')
  if (v === 'primary') return 'primary'
  if (v === 'secondary') return 'secondary'
  return ''
}

const normalizeProgramme = (value) => {
  const v = String(value || '').trim().toLowerCase()
  if (v === 'bilingual') return 'bilingual'
  if (v === 'integrated') return 'integrated'
  return ''
}

const normalizeSubject = (value) => {
  const v = String(value || '').trim().toLowerCase()
  if (v === 'esl') return 'ESL'
  if (v === 'mathematics') return 'Mathematics'
  if (v === 'science') return 'Science'
  if (v === 'global perspectives') return 'Global Perspectives'
  return capitalizeFirstAlpha(value)
}

export default function Classes() {
  const navigate = useNavigate()
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
  const [importing, setImporting] = useState(false)
  const [filters, setFilters] = useState({
    homeroom: 'all',
    grade: 'all',
    level: 'all',
    programme: 'all',
    subject: 'all',
  })
  const classCsvTemplate = [
    'Class Name,Level,Programme,Subject,Teacher Email',
    '2B2 ESL,primary,bilingual,ESL,teacher1@royal.edu.vn',
    '2B2 Mathematics,primary,bilingual,Mathematics,teacher2@royal.edu.vn',
    '7A1 Science,secondary,integrated,Science,teacher3@royal.edu.vn',
  ].join('\n')
  const classCsvTemplateHref = `data:text/csv;charset=utf-8,${encodeURIComponent(classCsvTemplate)}`

  useEffect(() => {
    fetchClasses()
    fetchTeachers()
  }, [])

  const fetchClasses = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('classes')
      .select('*, users!classes_teacher_id_fkey(full_name, email)')
      .order('name')
    
    setClasses(data || [])
    setLoading(false)
  }

  const fetchTeachers = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, full_name, email, level, subject')
      .eq('role', 'teacher')
      .order('full_name')
    setTeachers(data || [])
  }

  // Keep teacher dropdown behavior consistent: only show teachers when BOTH
  // level + subject are chosen (same intent as the create flow).
  //
  // Also tolerate subject naming differences between `classes.subject`
  // and `users.subject` (e.g. some teacher profiles use "ESL/GP").
  const acceptableTeacherSubjects = (classSubject) => {
    if (classSubject === 'ESL' || classSubject === 'Global Perspectives') {
      return ['ESL/GP', 'ESL', 'Global Perspectives']
    }
    return [classSubject]
  }

  const filteredTeachers = (level, subject) => {
    if (!level || !subject) return []
    const subjects = new Set(acceptableTeacherSubjects(subject))
    return teachers.filter(t => t.level === level && subjects.has(t.subject))
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
        academic_year: '2026-2027'
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
      .from('students')
      .select('id')
      .eq('class', homeroom)

    if (studentError) {
      setMessage({ type: 'error', text: 'Class created but could not find students: ' + studentError.message })
      setSaving(false)
      return
    }

    if (matchedStudents.length > 0) {
      const enrolments = matchedStudents.map(s => ({ class_id: newClass.id, student_id: s.id }))
      const { error: enrolError } = await supabase.from('class_students').insert(enrolments)
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
    setEditForm({
      name: cls.name,
      subject: cls.subject,
      level: cls.level,
      programme: cls.programme,
      teacher_id: cls.teacher_id || ''
    })
  }

  const saveEdit = async (classId) => {
    const { error } = await supabase
      .from('classes')
      .update({
        name: editForm.name,
        subject: editForm.subject,
        level: editForm.level,
        programme: editForm.programme,
        teacher_id: editForm.teacher_id || null
      })
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

  const handleClassCSV = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rawRows = results.data || []

          const rows = rawRows
            .map((row) => ({
              name: capitalizeFirstAlpha(row['Class Name'] || row['name']),
              level: normalizeLevel(row['Level'] || row['level']),
              programme: normalizeProgramme(row['Programme'] || row['programme']),
              subject: normalizeSubject(row['Subject'] || row['subject']),
              teacher_email: (row['Teacher Email'] || row['teacher_email'] || '').trim().toLowerCase(),
            }))
            .filter((r) => r.name && r.level && r.programme && r.subject)

          if (rows.length === 0) {
            setMessage({ type: 'error', text: 'No valid rows found. Please check your CSV format.' })
            return
          }

          const [{ data: studentsData }, { data: teachersData }, { data: existingClassesData }] = await Promise.all([
            supabase.from('students').select('id, class'),
            supabase.from('users').select('id, email').eq('role', 'teacher'),
            supabase.from('classes').select('id, name, subject, academic_year').eq('academic_year', '2026-2027'),
          ])

          const studentsByHomeroom = {}
          ;(studentsData || []).forEach((s) => {
            const key = (s.class || '').trim()
            if (!key) return
            if (!studentsByHomeroom[key]) studentsByHomeroom[key] = []
            studentsByHomeroom[key].push(s.id)
          })

          const teachersByEmail = {}
          ;(teachersData || []).forEach((t) => {
            if (t.email) teachersByEmail[t.email.toLowerCase()] = t.id
          })

          const existingByKey = {}
          ;(existingClassesData || []).forEach((c) => {
            const key = `${c.name}__${c.subject}__${c.academic_year}`
            existingByKey[key] = c.id
          })

          let createdCount = 0
          let reusedCount = 0
          let enrolledCount = 0
          let failedCount = 0

          for (const row of rows) {
            const classKey = `${row.name}__${row.subject}__2026-2027`
            let classId = existingByKey[classKey]

            if (!classId) {
              const teacherId = row.teacher_email ? teachersByEmail[row.teacher_email] || null : null
              const { data: newClass, error: classError } = await supabase
                .from('classes')
                .insert({
                  name: row.name,
                  subject: row.subject,
                  level: row.level,
                  programme: row.programme,
                  teacher_id: teacherId,
                  academic_year: '2026-2027',
                })
                .select('id')
                .single()

              if (classError || !newClass?.id) {
                failedCount += 1
                continue
              }

              classId = newClass.id
              existingByKey[classKey] = classId
              createdCount += 1
            } else {
              reusedCount += 1
            }

            const homeroom = row.name.split(' ')[0]
            const studentIds = studentsByHomeroom[homeroom] || []
            if (studentIds.length > 0) {
              const enrollRows = studentIds.map((studentId) => ({ class_id: classId, student_id: studentId }))
              const { error: enrollError } = await supabase
                .from('class_students')
                .upsert(enrollRows, { onConflict: 'class_id,student_id' })
              if (!enrollError) enrolledCount += studentIds.length
            }
          }

          setMessage({
            type: failedCount > 0 ? 'error' : 'success',
            text: `Import complete: ${createdCount} created, ${reusedCount} existing reused, ${enrolledCount} enrolments added${failedCount > 0 ? `, ${failedCount} failed` : ''}.`,
          })
          fetchClasses()
        } finally {
          setImporting(false)
          e.target.value = ''
        }
      },
      error: () => {
        setImporting(false)
        setMessage({ type: 'error', text: 'Could not parse CSV file.' })
        e.target.value = ''
      },
    })
  }

  const getHomeroom = (name) => {
    if (!name) return null
    return String(name).trim().split(/\s+/)[0] || null
  }

  const getGrade = (name) => {
    if (!name) return null
    const match = String(name).trim().match(/^(\d+)/)
    return match ? match[1] : null
  }

  const normalizeProgrammeForSnapshot = (value) => {
    if (!value) return 'unknown'
    const v = String(value).trim().toLowerCase()
    if (v === 'bilingual') return 'bilingual'
    if (v === 'integrated') return 'integrated'
    return 'unknown'
  }

  const levelScoped = classes.filter(c =>
    filters.level === 'all' || c.level === filters.level
  )

  const gradeScoped = levelScoped.filter(c =>
    filters.grade === 'all' || getGrade(c.name) === filters.grade
  )

  const programmeScoped = gradeScoped.filter(c =>
    filters.programme === 'all' || c.programme === filters.programme
  )

  const classScoped = programmeScoped.filter(c =>
    filters.homeroom === 'all' || getHomeroom(c.name) === filters.homeroom
  )

  const gradeOptions = Array.from(
    new Set(levelScoped.map(c => getGrade(c.name)).filter(Boolean))
  ).sort((a, b) => Number(a) - Number(b))

  const programmeOptions = Array.from(
    new Set(gradeScoped.map(c => c.programme).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b))

  const homeroomOptions = Array.from(
    new Set(programmeScoped.map(c => getHomeroom(c.name)).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

  const subjectOptions = Array.from(
    new Set(classScoped.map(c => c.subject).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b))

  const filteredClasses = classes.filter(cls => {
    const homeroom = getHomeroom(cls.name)
    const grade = getGrade(cls.name)
    return (
      (filters.homeroom === 'all' || homeroom === filters.homeroom) &&
      (filters.grade === 'all' || grade === filters.grade) &&
      (filters.level === 'all' || cls.level === filters.level) &&
      (filters.programme === 'all' || cls.programme === filters.programme) &&
      (filters.subject === 'all' || cls.subject === filters.subject)
    )
  })

  const getUniqueClassSnapshot = (rows) => {
    const byHomeroom = new Map()
    rows.forEach(cls => {
      const homeroom = getHomeroom(cls.name)
      if (!homeroom) return
      const grade = getGrade(homeroom) || 'Unknown'
      const programme = normalizeProgrammeForSnapshot(cls.programme)
      const existing = byHomeroom.get(homeroom)
      if (!existing) {
        byHomeroom.set(homeroom, { grade, programme })
        return
      }
      if (existing.programme !== programme) existing.programme = 'unknown'
    })

    const byGrade = {}
    Array.from(byHomeroom.values()).forEach(({ grade, programme }) => {
      if (!byGrade[grade]) byGrade[grade] = { grade, total: 0, bilingual: 0, integrated: 0, unknown: 0 }
      byGrade[grade].total += 1
      if (programme === 'bilingual') byGrade[grade].bilingual += 1
      else if (programme === 'integrated') byGrade[grade].integrated += 1
      else byGrade[grade].unknown += 1
    })

    const rowsByGrade = Object.values(byGrade).sort((a, b) => {
      if (a.grade === 'Unknown') return 1
      if (b.grade === 'Unknown') return -1
      return Number(a.grade) - Number(b.grade)
    })

    const totals = rowsByGrade.reduce((acc, r) => ({
      total: acc.total + r.total,
      bilingual: acc.bilingual + r.bilingual,
      integrated: acc.integrated + r.integrated,
      unknown: acc.unknown + r.unknown,
    }), { total: 0, bilingual: 0, integrated: 0, unknown: 0 })

    return { rowsByGrade, totals }
  }

  const classSnapshot = getUniqueClassSnapshot(filteredClasses)

  return (
    <Layout>
      <button
        onClick={() => navigate('/dashboard')}
        className="text-white px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity mb-4 flex items-center gap-2 text-sm"
        style={{ backgroundColor: '#1f86c7' }}
      >
        ← Go Back
      </button>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Class Management</h2>
          <p className="text-gray-500 text-sm mt-1">View, add, edit or remove classes for school year 2026-2027</p>
        </div>
        <div className="flex items-start gap-3">
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            {showForm ? 'Cancel' : '+ New Class'}
          </button>
          <div className="flex flex-col items-end">
            <label
              className={`cursor-pointer px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                importing ? 'bg-gray-300 text-gray-600' : ''
              }`}
              style={importing ? {} : { backgroundColor: '#ffc612', color: '#1a1a1a' }}
              onMouseOver={e => { if (!importing) e.currentTarget.style.backgroundColor = '#e6b10f' }}
              onMouseOut={e => { if (!importing) e.currentTarget.style.backgroundColor = '#ffc612' }}
            >
              {importing ? 'Importing...' : '+ Import Classes CSV'}
              <input type="file" accept=".csv" className="hidden" onChange={handleClassCSV} disabled={importing} />
            </label>
            <a
              href={classCsvTemplateHref}
              download="classes_import_template.csv"
              className="mt-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
            >
              Download CSV Template
            </a>
          </div>
        </div>
      </div>

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

      {confirmDelete && (
        <div className="mb-6 px-4 py-4 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm font-medium text-red-700 mb-3">
            Are you sure you want to delete <strong>{confirmDelete.name}</strong>? This cannot be undone.
          </p>
          <div className="flex gap-2">
            <button onClick={() => deleteClass(confirmDelete.id)}
              className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
              Yes, delete class
            </button>
            <button onClick={() => setConfirmDelete(null)}
              className="px-4 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">Create New Class</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Class Name</label>
              <input
                type="text"
                placeholder="e.g. 2B2 ESL"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Level</label>
              <select
                value={form.level}
                onChange={e => setForm({ ...form, level: e.target.value, subject: '', teacher_id: '' })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="primary">Primary</option>
                <option value="secondary">Secondary</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Programme</label>
              <select
                value={form.programme}
                onChange={e => setForm({ ...form, programme: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="bilingual">Bilingual</option>
                <option value="integrated">Integrated</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Subject</label>
              <select
                value={form.subject}
                onChange={e => setForm({ ...form, subject: e.target.value, teacher_id: '' })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select subject</option>
                {SUBJECTS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">
                Assign Teacher
                {form.level && form.subject && (
                  <span className="ml-2 text-gray-400 font-normal">
                    ({filteredTeachers(form.level, form.subject).length} available)
                  </span>
                )}
              </label>
              <select
                value={form.teacher_id}
                onChange={e => setForm({ ...form, teacher_id: e.target.value })}
                disabled={!form.level || !form.subject}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
              >
                <option value="">
                  {!form.level || !form.subject ? 'Select level + subject first' : 'Unassigned'}
                </option>
                {filteredTeachers(form.level, form.subject).map(t => (
                  <option key={t.id} value={t.id}>{t.full_name || t.email}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300"
          >
            {saving ? 'Creating...' : 'Create Class'}
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6" style={{ borderTopColor: '#1f86c7', borderTopWidth: 3 }}>
        <h3 className="font-semibold text-gray-900">Classes Snapshot</h3>
        <p className="text-xs text-gray-500 mt-1 mb-4">
          {`School Year ${ACADEMIC_YEAR}`}
        </p>
        {classSnapshot.totals.total === 0 ? (
          <div className="text-sm text-gray-400">No class data for the current selection.</div>
        ) : (
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-4 text-xs mb-4">
              <div className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: '#7c3aed' }} />
                <span className="text-gray-600">Bilingual</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: '#0d9488' }} />
                <span className="text-gray-600">Integrated</span>
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-700 mb-2">
                <span className="font-semibold">Total Classes:</span>{' '}
                <span className="font-semibold">{classSnapshot.totals.total}</span>
              </div>
              <div className="h-6 w-full rounded-full bg-white border border-gray-200 overflow-hidden flex text-[11px] font-semibold text-white">
                <div
                  className="h-full flex items-center justify-center"
                  style={{
                    width: `${(classSnapshot.totals.bilingual / classSnapshot.totals.total) * 100}%`,
                    backgroundColor: '#7c3aed'
                  }}
                >
                  {classSnapshot.totals.bilingual > 0 ? classSnapshot.totals.bilingual : ''}
                </div>
                <div
                  className="h-full flex items-center justify-center"
                  style={{
                    width: `${(classSnapshot.totals.integrated / classSnapshot.totals.total) * 100}%`,
                    backgroundColor: '#0d9488'
                  }}
                >
                  {classSnapshot.totals.integrated > 0 ? classSnapshot.totals.integrated : ''}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Level</label>
            <select
              value={filters.level}
              onChange={e => setFilters(prev => ({ ...prev, level: e.target.value, grade: 'all', programme: 'all', homeroom: 'all', subject: 'all' }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Levels</option>
              <option value="primary">Primary</option>
              <option value="secondary">Secondary</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Grade</label>
            <select
              value={filters.grade}
              onChange={e => setFilters(prev => ({ ...prev, grade: e.target.value, programme: 'all', homeroom: 'all', subject: 'all' }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Grades</option>
              {gradeOptions.map(g => (
                <option key={g} value={g}>Grade {g}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Programme</label>
            <select
              value={filters.programme}
              onChange={e => setFilters(prev => ({ ...prev, programme: e.target.value, homeroom: 'all', subject: 'all' }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Programmes</option>
              {programmeOptions.map(p => (
                <option key={p} value={p}>{programmeLabel(p)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Class</label>
            <select
              value={filters.homeroom}
              onChange={e => setFilters(prev => ({ ...prev, homeroom: e.target.value, subject: 'all' }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Classes</option>
              {homeroomOptions.map(h => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Subject</label>
            <select
              value={filters.subject}
              onChange={e => setFilters(prev => ({ ...prev, subject: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Subjects</option>
              {subjectOptions.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setFilters({ homeroom: 'all', grade: 'all', level: 'all', programme: 'all', subject: 'all' })}
            className="px-3 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: '#d1232a' }}
          >
            Reset
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : classes.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No classes yet. Create one to get started.</div>
        ) : filteredClasses.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No classes match the selected filters.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Class Name</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Level</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Programme</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Subject</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Teacher</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredClasses.map(cls => (
                <tr key={cls.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium text-gray-900">
                    {editingId === cls.id ? (
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-36"
                      />
                    ) : (
                      <Link to={`/class/${cls.id}`} className="text-blue-700 hover:text-blue-900 hover:underline">
                        {cls.name}
                      </Link>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    {editingId === cls.id ? (
                      <select
                        value={editForm.level}
                        onChange={e => setEditForm({ ...editForm, level: e.target.value, subject: '', teacher_id: '' })}
                        className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="primary">Primary</option>
                        <option value="secondary">Secondary</option>
                      </select>
                    ) : (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                        {levelLabel(cls.level)}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    {editingId === cls.id ? (
                      <select
                        value={editForm.programme}
                        onChange={e => setEditForm({ ...editForm, programme: e.target.value })}
                        className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="bilingual">Bilingual</option>
                        <option value="integrated">Integrated</option>
                      </select>
                    ) : (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${programmeBadgeStyle(cls.programme)}`}>
                        {programmeLabel(cls.programme)}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-gray-600">
                    {editingId === cls.id ? (
                      <select
                        value={editForm.subject}
                        onChange={e => setEditForm({ ...editForm, subject: e.target.value, teacher_id: '' })}
                        className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select subject</option>
                        {SUBJECTS.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    ) : cls.subject}
                  </td>
                  <td className="px-6 py-3 text-gray-600">
                    {editingId === cls.id ? (
                      <select
                        value={editForm.teacher_id}
                        onChange={e => setEditForm({ ...editForm, teacher_id: e.target.value })}
                        disabled={!editForm.level || !editForm.subject}
                        className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
                      >
                        <option value="">
                          {!editForm.level || !editForm.subject ? 'Select level + subject first' : 'Unassigned'}
                        </option>
                        {filteredTeachers(editForm.level, editForm.subject).map(t => (
                          <option key={t.id} value={t.id}>{t.full_name || t.email}</option>
                        ))}
                      </select>
                    ) : (
                      cls.users?.full_name || cls.users?.email || <span className="text-gray-400 italic">Unassigned</span>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    {editingId === cls.id ? (
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(cls.id)}
                          className="px-3 py-1 text-white rounded-lg text-xs font-medium"
                          style={{ backgroundColor: '#16a34a' }}>
                          Save
                        </button>
                        <button onClick={() => setEditingId(null)}
                          className="px-3 py-1 border border-gray-300 text-gray-600 rounded-lg text-xs hover:bg-gray-50">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(cls)}
                          className="px-3 py-1 border rounded-lg text-xs font-medium text-white"
                          style={{ backgroundColor: '#1f86c7', borderColor: '#1f86c7' }}>
                          Edit
                        </button>
                        <button onClick={() => setConfirmDelete(cls)}
                          className="px-3 py-1 border border-red-200 text-red-500 rounded-lg text-xs hover:bg-red-50">
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-xs text-gray-500 font-medium mb-2">Class CSV Format — include these column headers:</p>
        <code className="text-xs text-gray-600">Class Name, Level, Programme, Subject, Teacher Email</code>
        <p className="text-xs text-gray-400 mt-2">Teacher Email is optional. If not found, class is created as unassigned.</p>
        <p className="text-xs text-gray-400">Auto-enrolment uses homeroom from the first token of Class Name (e.g. 2B2 in "2B2 ESL").</p>
      </div>
    </Layout>
  )
}