import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import ProfileAvatar from '../../components/ProfileAvatar'
import Papa from 'papaparse'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export default function Students() {
  const ACADEMIC_YEAR = '2026-2027'
  const navigate = useNavigate()
  const { effectiveRole } = useAuth()
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingRow, setSavingRow] = useState(false)
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState(null)
  const [messageDetailOpen, setMessageDetailOpen] = useState(false)
  const [confirmReset, setConfirmReset] = useState(null)
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deletingAll, setDeletingAll] = useState(false)
  const [classesMeta, setClassesMeta] = useState([])
  const [rowEditingId, setRowEditingId] = useState(null)
  const [rowEditForm, setRowEditForm] = useState({
    name_eng: '',
    name_vn: '',
    class: '',
    level: 'primary',
    programme: 'bilingual',
  })
  const [studentUsersById, setStudentUsersById] = useState({})
  const [resetRequestsByStudentId, setResetRequestsByStudentId] = useState({})
  const [filters, setFilters] = useState({
    level: 'all',
    grade: 'all',
    programme: 'all',
    homeroom: 'all',
  })
  const [newStudent, setNewStudent] = useState({
    student_id: '',
    name_vn: '',
    name_eng: '',
    class: '',
    level: 'primary',
    programme: 'bilingual',
  })
  const studentsCsvTemplate = [
    'Student ID,Name (VN),Name (ENG),Class,Level,Programme',
    'S0001,Nguyen Van A,Alex Nguyen,2B2,primary,bilingual',
    'S0002,Tran Thi B,Bella Tran,7A1,lower_secondary,integrated',
  ].join('\n')
  const studentsCsvTemplateHref = `data:text/csv;charset=utf-8,${encodeURIComponent(studentsCsvTemplate)}`
  const isAdmin = effectiveRole === 'admin'

  const getValidAccessToken = async () => {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) return null

    const currentToken = sessionData?.session?.access_token
    if (currentToken) return currentToken

    const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError) return null
    return refreshedData?.session?.access_token || null
  }

  const chunkArray = (arr, size) => {
    const chunks = []
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size))
    }
    return chunks
  }

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  const invokeCreateStudentsWithRetry = async (payloadChunk, token, attempt = 1) => {
    const { data, error } = await supabase.functions.invoke('create-students', {
      body: { students: payloadChunk },
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
    })

    if (!error) return { data, error: null }
    if (attempt >= 3) return { data: null, error }

    await wait(250 * attempt)
    return invokeCreateStudentsWithRetry(payloadChunk, token, attempt + 1)
  }

  const syncStudentLogins = async (studentRows) => {
    if (!Array.isArray(studentRows) || studentRows.length === 0) {
      return { synced: 0, failed: 0, errors: [], temporaryPasswords: [] }
    }

    const token = await getValidAccessToken()
    if (!token) {
      return { synced: 0, failed: studentRows.length, errors: ['Session expired. Please sign in again as admin.'], temporaryPasswords: [] }
    }

    const payload = studentRows.map((s) => ({
      student_ref_id: s.id,
      student_id: s.student_id,
      full_name: s.name_eng,
      level: s.level,
    }))

    const chunks = chunkArray(payload, 100)
    let synced = 0
    let failed = 0
    const errors = []
    let offset = 0

    for (const chunk of chunks) {
      const { data, error } = await invokeCreateStudentsWithRetry(chunk, token)
      if (error) {
        failed += chunk.length
        errors.push(`rows ${offset + 1}-${offset + chunk.length}: ${error.message}`)
      } else {
        synced += (data?.results || []).length
        failed += (data?.errors || []).length
        ;(data?.errors || []).forEach((e) => {
          const localRow = Number(e.row || 0)
          const absoluteRow = localRow > 0 ? offset + localRow : '?'
          errors.push(`row ${absoluteRow}: ${e.error}`)
        })
      }
      offset += chunk.length
    }

    return { synced, failed, errors }
  }

  const getHomeroom = (classValue) => String(classValue || '').trim().split(/\s+/)[0] || ''

  const syncStudentEnrollments = async (studentRows) => {
    if (!Array.isArray(studentRows) || studentRows.length === 0) {
      return { enrolled: 0, missing: 0, missingStudents: [] }
    }

    const { data: currentYearClasses, error: classError } = await supabase
      .from('classes')
      .select('id, name')
      .eq('academic_year', ACADEMIC_YEAR)

    if (classError) {
      return { enrolled: 0, missing: studentRows.length, missingStudents: [`Class lookup failed: ${classError.message}`] }
    }

    const classIds = (currentYearClasses || []).map((c) => c.id)
    const classesByHomeroom = {}
    ;(currentYearClasses || []).forEach((cls) => {
      const homeroom = getHomeroom(cls.name).toLowerCase()
      if (!homeroom) return
      if (!classesByHomeroom[homeroom]) classesByHomeroom[homeroom] = []
      classesByHomeroom[homeroom].push(cls.id)
    })

    const studentIds = studentRows.map((s) => s.id).filter(Boolean)
     if (studentIds.length > 0 && classIds.length > 0) {
       await supabase
         .from('class_students')
         .delete()
         .in('student_id', studentIds)
         .in('class_id', classIds)
     }

     const enrollRows = []
    const missingStudents = []
    studentRows.forEach((student) => {
      const homeroom = getHomeroom(student.class).toLowerCase()
      const targetClassIds = classesByHomeroom[homeroom] || []
      if (!homeroom || targetClassIds.length === 0) {
        missingStudents.push(student.student_id || student.id)
        return
      }
      targetClassIds.forEach((classId) => {
        enrollRows.push({ class_id: classId, student_id: student.id })
      })
    })

    if (enrollRows.length > 0) {
      const { error: enrollError } = await supabase
        .from('class_students')
        .upsert(enrollRows, { onConflict: 'class_id,student_id' })

      if (enrollError) {
        return { enrolled: 0, missing: studentRows.length, missingStudents: [`Enrollment upsert failed: ${enrollError.message}`] }
      }
    }

    const enrolledStudents = studentRows.length - missingStudents.length
    return { enrolled: enrolledStudents, missing: missingStudents.length, missingStudents }
  }

  const capitalizeFirstAlpha = (value) => {
    const v = String(value || '').trim()
    const idx = v.search(/[A-Za-z]/)
    if (idx === -1) return v
    return v.slice(0, idx) + v.charAt(idx).toUpperCase() + v.slice(idx + 1)
  }

  const normalizeLevelValue = (value) => {
    const raw = String(value || '').trim().toLowerCase().replace(/\s+/g, '_')
    if (!raw) return ''
    if (raw === 'secondary') return 'lower_secondary'
    if (raw === 'lowersecondary') return 'lower_secondary'
    if (raw === 'uppersecondary') return 'upper_secondary'
    if (raw === 'highschool') return 'high_school'
    return raw
  }

  const normalizeProgrammeValue = (value) => {
    const raw = String(value || '').trim().toLowerCase()
    if (raw === 'bilingual' || raw === 'integrated') return raw
    return raw
  }

  const titleCaseWords = (value) =>
    String(value || '')
      .replace(/_/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')

  useEffect(() => {
    fetchStudents()
  }, [])

  const fetchStudents = async () => {
    setLoading(true)
    const [{ data: studentRows }, { data: userRows }, { data: resetRows }, { data: classRows }] = await Promise.all([
      supabase
        .from('students')
        .select('id, student_id, name_eng, name_vn, class, level, programme, avatar_url')
        .order('name_eng'),
      supabase
        .from('users')
        .select('id, staff_id, student_id_ref, must_change_password, role')
        .eq('role', 'student'),
      supabase
        .from('password_reset_requests')
        .select('staff_id')
        .eq('status', 'new'),
      supabase
        .from('classes')
        .select('name, level, programme')
        .order('name'),
    ])

    const userMap = {}
    ;(userRows || []).forEach((u) => {
      const byRef = String(u.student_id_ref || '').trim()
      const byId = String(u.staff_id || '').trim().toLowerCase()
      if (byRef) userMap[`ref:${byRef}`] = u
      if (byId) userMap[`sid:${byId}`] = u
    })

    const resetMap = {}
    ;(resetRows || []).forEach((r) => {
      const key = String(r.staff_id || '').trim().toLowerCase()
      if (!key) return
      resetMap[key] = (resetMap[key] || 0) + 1
    })

    setStudents(studentRows || [])
    setClassesMeta(classRows || [])
    setStudentUsersById(userMap)
    setResetRequestsByStudentId(resetMap)
    setLoading(false)
  }

  const handleCSV = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true)
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data.map(row => ({
          student_id: capitalizeFirstAlpha(row['Student ID'] || row['student_id']),
          name_vn: capitalizeFirstAlpha(row['Name (VN)'] || row['name_vn']),
          name_eng: capitalizeFirstAlpha(row['Name (ENG)'] || row['name_eng']),
          class: capitalizeFirstAlpha(row['Class'] || row['class']),
          level: normalizeLevelValue(row['Level'] || row['level']),
          programme: normalizeProgrammeValue(row['Programme'] || row['programme']),
        }))

        const { data: upsertedRows, error } = await supabase
          .from('students')
          .upsert(rows, { onConflict: 'student_id' })
          .select('id, student_id, name_eng, class, level')

        if (error) {
          setMessage({ type: 'error', text: 'Import failed: ' + error.message })
        } else {
          const enrollmentResult = await syncStudentEnrollments(upsertedRows || [])
          const syncResult = await syncStudentLogins(upsertedRows || [])
          const summary = `${rows.length} students imported. Enrolled: ${enrollmentResult.enrolled}, Missing class match: ${enrollmentResult.missing}. Student logins: ${syncResult.synced} synced, ${syncResult.failed} failed.`
          const detailParts = []
          if (enrollmentResult.missingStudents.length > 0) {
            detailParts.push(`No class match for: ${enrollmentResult.missingStudents.join(', ')}`)
          }
          if (syncResult.errors.length > 0) {
            detailParts.push(syncResult.errors.join(' | '))
          }
          setMessage({
            type: syncResult.failed > 0 || enrollmentResult.missing > 0 ? 'error' : 'success',
            text: summary,
            detail: detailParts.length > 0 ? detailParts.join(' | ') : null,
          })
          fetchStudents()
        }
        setImporting(false)
        e.target.value = ''
      }
    })
  }

  const createStudent = async () => {
    if (!newStudent.student_id || !newStudent.name_eng || !newStudent.class || !newStudent.level || !newStudent.programme) {
      setMessage({ type: 'error', text: 'Please complete Student ID, English Name, Class, Level, and Programme.' })
      return
    }

    setSaving(true)
    const { data: upsertedRows, error } = await supabase
      .from('students')
      .upsert(
        [{
          student_id: newStudent.student_id.trim(),
          name_vn: newStudent.name_vn.trim() || null,
          name_eng: newStudent.name_eng.trim(),
          class: newStudent.class.trim(),
          level: newStudent.level,
          programme: newStudent.programme,
        }],
        { onConflict: 'student_id' }
      )
      .select('id, student_id, name_eng, class, level')

    if (error) {
      setMessage({ type: 'error', text: error.message })
      setSaving(false)
      return
    }

    const enrollmentResult = await syncStudentEnrollments(upsertedRows || [])
    const syncResult = await syncStudentLogins(upsertedRows || [])
    if (syncResult.failed > 0) {
      setMessage({
        type: 'error',
        text: `Student saved, but login sync failed (${syncResult.failed}).`,
        detail: syncResult.errors.join(' | '),
      })
    } else if (enrollmentResult.missing > 0) {
      setMessage({
        type: 'error',
        text: 'Student saved and login created, but no class match was found for enrollment.',
        detail: `No class match for: ${enrollmentResult.missingStudents.join(', ')}`,
      })
    } else {
      setMessage({ type: 'success', text: 'Student saved successfully and login account is ready (default password: royal@123).' })
    }
    setNewStudent({
      student_id: '',
      name_vn: '',
      name_eng: '',
      class: '',
      level: 'primary',
      programme: 'bilingual',
    })
    setShowForm(false)
    setSaving(false)
    fetchStudents()
  }

  const getStudentUser = (student) => {
    const byRef = studentUsersById[`ref:${String(student.id || '').trim()}`]
    if (byRef) return byRef
    const byStudentId = studentUsersById[`sid:${String(student.student_id || '').trim().toLowerCase()}`]
    return byStudentId || null
  }

  const resetStudentPassword = async (student) => {
    const targetUser = getStudentUser(student)
    if (!targetUser?.id) {
      setMessage({ type: 'error', text: 'No student login account found for this student.' })
      return
    }

    const token = await getValidAccessToken()
    if (!token) {
      setMessage({ type: 'error', text: 'Your session expired. Please sign out and sign in again as admin.' })
      return
    }

    const { data, error } = await supabase.functions.invoke('reset-user-password', {
      body: { user_id: targetUser.id },
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
    })

    if (error) {
      setMessage({ type: 'error', text: `Password reset failed for ${student.student_id}: ${error.message}` })
      return
    }

    await supabase
      .from('password_reset_requests')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('status', 'new')
      .ilike('staff_id', student.student_id)

    setMessage({ type: 'success', text: `Password reset for ${student.student_id}. Default password is royal@123.` })
    setConfirmReset(null)
    fetchStudents()
  }

  const deleteAllStudents = async () => {
    if (deleteConfirmText !== 'DELETE ALL STUDENTS') return
    const token = await getValidAccessToken()
    if (!token) {
      setMessage({ type: 'error', text: 'Your session expired. Please sign out and sign in again as admin.' })
      return
    }

    setDeletingAll(true)
    const { data, error } = await supabase.functions.invoke('delete-all-students', {
      body: {},
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
    })

    if (error) {
      setMessage({ type: 'error', text: `Delete all students failed: ${error.message}` })
      setDeletingAll(false)
      return
    }

    const deletedCounts = data?.deleted_counts || {}
    const deletedSummary = Object.entries(deletedCounts)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ')
    const authDeleted = data?.auth_deleted || 0
    const issueDetails = [
      ...(data?.errors || []),
      ...(data?.auth_errors || []),
    ]

    setMessage({
      type: issueDetails.length > 0 ? 'error' : 'success',
      text: issueDetails.length > 0
        ? `Student wipe completed with warnings. Auth deleted: ${authDeleted}.`
        : `All students deleted successfully. Auth deleted: ${authDeleted}.`,
      detail: `Deleted counts: ${deletedSummary || 'none'}` + (issueDetails.length > 0 ? ` | Issues: ${issueDetails.join(' | ')}` : ''),
    })

    setDeletingAll(false)
    setConfirmDeleteAll(false)
    setDeleteConfirmText('')
    setImportCredentials([])
    setConfirmReset(null)
    setMessageDetailOpen(false)
    fetchStudents()
  }

  const inferClassFields = (classValue) => {
    const homeroom = String(classValue || '').trim().split(/\s+/)[0] || ''
    if (!homeroom) return null

    const matches = classesMeta.filter((cls) => {
      const clsHomeroom = String(cls.name || '').trim().split(/\s+/)[0] || ''
      return clsHomeroom.toLowerCase() === homeroom.toLowerCase()
    })

    if (matches.length === 0) return null

    const programmes = Array.from(new Set(matches.map(m => m.programme).filter(Boolean)))
    const levels = Array.from(new Set(matches.map(m => m.level).filter(Boolean)))

    return {
      programme: programmes.length === 1 ? programmes[0] : null,
      level: levels.length === 1 ? levels[0] : null,
    }
  }

  const startRowEdit = (student) => {
    setRowEditingId(student.id)
    setRowEditForm({
      name_eng: student.name_eng || '',
      name_vn: student.name_vn || '',
      class: student.class || '',
      level: student.level || 'primary',
      programme: student.programme || 'bilingual',
    })
  }

  const cancelRowEdit = () => {
    setRowEditingId(null)
    setRowEditForm({
      name_eng: '',
      name_vn: '',
      class: '',
      level: 'primary',
      programme: 'bilingual',
    })
  }

  const updateRowEditField = (field, value) => {
    if (field !== 'class') {
      setRowEditForm((prev) => ({ ...prev, [field]: value }))
      return
    }

    const inferred = inferClassFields(value)
    setRowEditForm((prev) => ({
      ...prev,
      class: value,
      programme: inferred?.programme || prev.programme,
      level: inferred?.level || prev.level,
    }))
  }

  const saveRowEdit = async (studentId) => {
    if (!rowEditForm.name_eng?.trim() || !rowEditForm.class?.trim()) {
      setMessage({ type: 'error', text: 'English Name and Class are required.' })
      return
    }

    setSavingRow(true)
    const { error } = await supabase
      .from('students')
      .update({
        name_eng: rowEditForm.name_eng.trim(),
        name_vn: rowEditForm.name_vn.trim() || null,
        class: rowEditForm.class.trim(),
        level: rowEditForm.level,
        programme: rowEditForm.programme,
      })
      .eq('id', studentId)

    if (error) {
      setMessage({ type: 'error', text: `Could not save student: ${error.message}` })
      setSavingRow(false)
      return
    }

    setMessage({ type: 'success', text: 'Student updated successfully.' })
    setSavingRow(false)
    await syncStudentEnrollments([{ id: studentId, class: rowEditForm.class, student_id: students.find(s => s.id === studentId)?.student_id || studentId }])
    cancelRowEdit()
    fetchStudents()
  }

  const levelLabel = (l) => ({
    primary: 'Primary',
    lower_secondary: 'Lower Secondary',
    upper_secondary: 'Upper Secondary',
    high_school: 'High School',
  }[l] || titleCaseWords(l))

  const programmeBadgeStyle = (p) => p === 'bilingual'
    ? 'bg-purple-100 text-purple-700'
    : 'bg-teal-100 text-teal-700'

  const getGrade = (classValue) => {
    if (!classValue) return null
    const match = String(classValue).trim().match(/^(\d+)/)
    return match ? match[1] : null
  }

  const levelScoped = students.filter(s =>
    filters.level === 'all' || s.level === filters.level
  )

  const gradeScoped = levelScoped.filter(s =>
    filters.grade === 'all' || getGrade(s.class) === filters.grade
  )

  const programmeScoped = gradeScoped.filter(s =>
    filters.programme === 'all' || s.programme === filters.programme
  )

  const filteredBySelectors = programmeScoped.filter(s =>
    filters.homeroom === 'all' || s.class === filters.homeroom
  )

  const gradeOptions = Array.from(
    new Set(levelScoped.map(s => getGrade(s.class)).filter(Boolean))
  ).sort((a, b) => Number(a) - Number(b))

  const programmeOptions = Array.from(
    new Set(gradeScoped.map(s => s.programme).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b))

  const homeroomOptions = Array.from(
    new Set(programmeScoped.map(s => s.class).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

  const studentSnapshot = filteredBySelectors.reduce((acc, s) => {
    acc.total += 1
    if (s.programme === 'bilingual') acc.bilingual += 1
    else if (s.programme === 'integrated') acc.integrated += 1
    return acc
  }, { total: 0, bilingual: 0, integrated: 0 })

  const filtered = filteredBySelectors.filter(s =>
    s.name_eng?.toLowerCase().includes(search.toLowerCase()) ||
    s.name_vn?.toLowerCase().includes(search.toLowerCase()) ||
    s.student_id?.toLowerCase().includes(search.toLowerCase()) ||
    s.class?.toLowerCase().includes(search.toLowerCase())
  )

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
          <h2 className="text-2xl font-bold text-gray-900">Student Management</h2>
          <p className="text-gray-500 text-sm mt-1">Add, edit or remove student accounts.</p>
        </div>
        <div className="flex items-start gap-3">
          <button
            onClick={() => setShowForm(!showForm)}
            className="w-44 px-4 py-2 text-white rounded-lg text-sm font-medium text-center"
            style={{ backgroundColor: '#1f86c7' }}
            onMouseOver={e => e.currentTarget.style.backgroundColor = '#166a9b'}
            onMouseOut={e => e.currentTarget.style.backgroundColor = '#1f86c7'}
          >
            {showForm ? 'Cancel' : 'New Student'}
          </button>
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
              href={studentsCsvTemplateHref}
              download="students_import_template.csv"
              className="mt-1 text-xs hover:underline"
              style={{ color: '#1f86c7' }}
            >
              Download CSV Template
            </a>
          </div>
          {isAdmin && (
            <button
              onClick={() => {
                setConfirmDeleteAll(true)
                setDeleteConfirmText('')
              }}
              className="w-44 px-4 py-2 text-white rounded-lg text-sm font-medium text-center"
              style={{ backgroundColor: '#d1232a' }}
            >
              Delete All Students
            </button>
          )}
        </div>
      </div>

      {message && (
        <div className={`mb-6 px-4 py-3 rounded-lg text-sm font-medium ${
          message.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          <span>{message.text}</span>
          {message.detail && (
            <button
              onClick={() => setMessageDetailOpen(true)}
              className="ml-3 underline underline-offset-2"
            >
              Click for more
            </button>
          )}
          <button
            onClick={() => {
              setMessage(null)
            }}
            className="ml-4 opacity-50 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {messageDetailOpen && message?.detail && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
          <div className="w-full max-w-2xl bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-base font-semibold text-gray-900">Detailed Status</h4>
              <button
                type="button"
                onClick={() => setMessageDetailOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="text-sm text-gray-700 whitespace-pre-wrap break-words max-h-[50vh] overflow-auto">
              {message.detail}
            </div>
          </div>
        </div>
      )}

      {confirmReset && (
        <div className="mb-6 px-4 py-4 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm font-medium text-red-700 mb-3">
            Reset password for <strong>{confirmReset.name_eng || confirmReset.student_id}</strong>? A one-time temporary password will be generated and they will be required to change it on next login.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => resetStudentPassword(confirmReset)}
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

      {confirmDeleteAll && (
        <div className="mb-6 px-4 py-4 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm font-semibold text-red-700 mb-2">
            This will permanently delete all students, related student records, and linked auth accounts.
          </p>
          <p className="text-xs text-red-700 mb-3">
            Type <strong>DELETE ALL STUDENTS</strong> to confirm.
          </p>
          <input
            type="text"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            className="w-full max-w-md border border-red-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            placeholder="DELETE ALL STUDENTS"
          />
          <div className="mt-3 flex gap-2">
            <button
              onClick={deleteAllStudents}
              disabled={deletingAll || deleteConfirmText !== 'DELETE ALL STUDENTS'}
              className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-60"
            >
              {deletingAll ? 'Deleting...' : 'Confirm Delete All'}
            </button>
            <button
              onClick={() => {
                setConfirmDeleteAll(false)
                setDeleteConfirmText('')
              }}
              disabled={deletingAll}
              className="px-4 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">Add New Student</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Student ID</label>
              <input
                type="text"
                value={newStudent.student_id}
                onChange={e => setNewStudent({ ...newStudent, student_id: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Class</label>
              <input
                type="text"
                value={newStudent.class}
                onChange={e => setNewStudent({ ...newStudent, class: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">English Name</label>
              <input
                type="text"
                value={newStudent.name_eng}
                onChange={e => setNewStudent({ ...newStudent, name_eng: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Vietnamese Name (optional)</label>
              <input
                type="text"
                value={newStudent.name_vn}
                onChange={e => setNewStudent({ ...newStudent, name_vn: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Level</label>
              <select
                value={newStudent.level}
                onChange={e => setNewStudent({ ...newStudent, level: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="primary">primary</option>
                <option value="lower_secondary">lower_secondary</option>
                <option value="upper_secondary">upper_secondary</option>
                <option value="high_school">high_school</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Programme</label>
              <select
                value={newStudent.programme}
                onChange={e => setNewStudent({ ...newStudent, programme: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="bilingual">bilingual</option>
                <option value="integrated">integrated</option>
              </select>
            </div>
          </div>
          <button
            onClick={createStudent}
            disabled={saving}
            className="mt-4 px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:bg-gray-300"
          >
            {saving ? 'Saving...' : 'Save Student'}
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6" style={{ borderTopColor: '#1f86c7', borderTopWidth: 3 }}>
        <h3 className="font-semibold text-gray-900">Students Snapshot</h3>
        <p className="text-xs text-gray-500 mt-1 mb-4">Current filtered student totals by programme.</p>
        {studentSnapshot.total === 0 ? (
          <div className="text-sm text-gray-400">No student data for the current selection.</div>
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
                <span className="font-semibold">Total Students:</span>{' '}
                <span className="font-semibold">{studentSnapshot.total}</span>
              </div>
              <div className="h-6 w-full rounded-full bg-white border border-gray-200 overflow-hidden flex text-[11px] font-semibold text-white">
                <div
                  className="h-full flex items-center justify-center"
                  style={{
                    width: `${(studentSnapshot.bilingual / studentSnapshot.total) * 100}%`,
                    backgroundColor: '#7c3aed'
                  }}
                >
                  {studentSnapshot.bilingual > 0 ? studentSnapshot.bilingual : ''}
                </div>
                <div
                  className="h-full flex items-center justify-center"
                  style={{
                    width: `${(studentSnapshot.integrated / studentSnapshot.total) * 100}%`,
                    backgroundColor: '#0d9488'
                  }}
                >
                  {studentSnapshot.integrated > 0 ? studentSnapshot.integrated : ''}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Level</label>
            <select
              value={filters.level}
              onChange={e => setFilters(prev => ({ ...prev, level: e.target.value, grade: 'all', programme: 'all', homeroom: 'all' }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Levels</option>
              {Array.from(new Set(students.map(s => s.level).filter(Boolean))).map(level => (
                <option key={level} value={level}>{levelLabel(level)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Grade</label>
            <select
              value={filters.grade}
              onChange={e => setFilters(prev => ({ ...prev, grade: e.target.value, programme: 'all', homeroom: 'all' }))}
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
              onChange={e => setFilters(prev => ({ ...prev, programme: e.target.value, homeroom: 'all' }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Programmes</option>
              {programmeOptions.map(programme => (
                <option key={programme} value={programme}>{titleCaseWords(programme)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Class</label>
            <select
              value={filters.homeroom}
              onChange={e => setFilters(prev => ({ ...prev, homeroom: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Classes</option>
              {homeroomOptions.map(className => (
                <option key={className} value={className}>{className}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setFilters({ level: 'all', grade: 'all', programme: 'all', homeroom: 'all' })}
            className="px-3 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: '#d1232a' }}
          >
            Reset
          </button>
        </div>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name, ID or class..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-sm border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            {students.length === 0
              ? 'No students yet. Import a CSV to get started.'
              : 'No students match your search.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-gray-500 font-medium"></th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Student ID</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">English Name</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Vietnamese Name</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Class</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Level</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Programme</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(student => {
                const linkedUser = getStudentUser(student)
                const mustChangePassword = !!linkedUser?.must_change_password
                const resetRequested = (resetRequestsByStudentId[String(student.student_id || '').trim().toLowerCase()] || 0) > 0
                const isRowEditing = rowEditingId === student.id
                return (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <ProfileAvatar 
                      avatarUrl={student.avatar_url}
                      name={student.name_eng} 
                      size={36} 
                    />
                  </td>
                  <td className="px-6 py-3 text-gray-600">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${
                          !linkedUser ? 'bg-gray-300' : mustChangePassword ? 'bg-red-500' : 'bg-green-500'
                        }`}
                        title={
                          !linkedUser
                            ? 'Login not created yet'
                            : mustChangePassword
                              ? 'Pending activation'
                              : 'Activated'
                        }
                      />
                      <span>{student.student_id}</span>
                    </span>
                  </td>
                  <td className="px-6 py-3 font-medium text-gray-900">
                    <span className="inline-flex items-center gap-2">
                      {isRowEditing ? (
                        <input
                          type="text"
                          value={rowEditForm.name_eng}
                          onChange={e => updateRowEditField('name_eng', e.target.value)}
                          className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
                        />
                      ) : (
                        <span>{student.name_eng}</span>
                      )}
                      {resetRequested && (
                        <span
                          className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium"
                          style={{ backgroundColor: '#FDEBEC', color: '#d1232a' }}
                        >
                          Reset Requested
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-gray-600">
                    {isRowEditing ? (
                      <input
                        type="text"
                        value={rowEditForm.name_vn}
                        onChange={e => updateRowEditField('name_vn', e.target.value)}
                        className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
                      />
                    ) : (
                      student.name_vn
                    )}
                  </td>
                  <td className="px-6 py-3 text-gray-600">
                    {isRowEditing ? (
                      <input
                        type="text"
                        value={rowEditForm.class}
                        onChange={e => updateRowEditField('class', e.target.value)}
                        className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-24"
                      />
                    ) : (
                      student.class
                    )}
                  </td>
                  <td className="px-6 py-3">
                    {isRowEditing ? (
                      <select
                        value={rowEditForm.level}
                        onChange={e => updateRowEditField('level', e.target.value)}
                        className="border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="primary">Primary</option>
                        <option value="lower_secondary">Lower Secondary</option>
                        <option value="upper_secondary">Upper Secondary</option>
                        <option value="high_school">High School</option>
                      </select>
                    ) : (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                        {levelLabel(student.level)}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    {isRowEditing ? (
                      <select
                        value={rowEditForm.programme}
                        onChange={e => updateRowEditField('programme', e.target.value)}
                        className="border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="bilingual">Bilingual</option>
                        <option value="integrated">Integrated</option>
                      </select>
                    ) : (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${programmeBadgeStyle(student.programme)}`}>
                        {titleCaseWords(student.programme)}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    {isRowEditing ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveRowEdit(student.id)}
                          disabled={savingRow}
                          className="px-3 py-1 text-white rounded-lg text-xs font-medium bg-green-600 hover:bg-green-700 disabled:bg-gray-300"
                        >
                          {savingRow ? 'Saving...' : 'Save'}
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
                          onClick={() => startRowEdit(student)}
                          className="px-3 py-1 border rounded-lg text-xs font-medium text-white"
                          style={{ backgroundColor: '#1f86c7', borderColor: '#1f86c7' }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setConfirmReset(student)}
                          disabled={!linkedUser}
                          className={`px-3 py-1 border rounded-lg text-xs ${
                            resetRequested
                              ? 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100'
                              : 'border-amber-300 text-amber-700 hover:bg-amber-50'
                          } disabled:opacity-40 disabled:cursor-not-allowed`}
                        >
                          Reset Password
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-xs text-gray-500 font-medium mb-2">CSV Format — your file should have these column headers:</p>
        <code className="text-xs text-gray-600">Student ID, Name (VN), Name (ENG), Class, Level, Programme</code>
        <p className="text-xs text-gray-400 mt-2">Level: primary · lower_secondary · upper_secondary · high_school</p>
        <p className="text-xs text-gray-400">Programme: bilingual · integrated</p>
      </div>
    </Layout>
  )
}