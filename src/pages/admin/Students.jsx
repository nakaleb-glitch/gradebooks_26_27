import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import Papa from 'papaparse'

export default function Students() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState(null)
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
    const { data } = await supabase
      .from('students')
      .select('*')
      .order('name_eng')
    setStudents(data || [])
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

        const { error } = await supabase
          .from('students')
          .upsert(rows, { onConflict: 'student_id' })

        if (error) {
          setMessage({ type: 'error', text: 'Import failed: ' + error.message })
        } else {
          setMessage({ type: 'success', text: `${rows.length} students imported successfully.` })
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
    const { error } = await supabase
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

    if (error) {
      setMessage({ type: 'error', text: error.message })
      setSaving(false)
      return
    }

    setMessage({ type: 'success', text: 'Student saved successfully.' })
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
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Student ID</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">English Name</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Vietnamese Name</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Class</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Level</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Programme</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(student => (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-gray-600">{student.student_id}</td>
                  <td className="px-6 py-3 font-medium text-gray-900">{student.name_eng}</td>
                  <td className="px-6 py-3 text-gray-600">{student.name_vn}</td>
                  <td className="px-6 py-3 text-gray-600">{student.class}</td>
                  <td className="px-6 py-3">
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                      {levelLabel(student.level)}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${programmeBadgeStyle(student.programme)}`}>
                      {titleCaseWords(student.programme)}
                    </span>
                  </td>
                </tr>
              ))}
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