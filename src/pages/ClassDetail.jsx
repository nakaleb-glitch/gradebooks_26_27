import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const TERMS = [
  { key: 'midterm_1', label: 'Midterm 1', weeks: 7 },
  { key: 'final_1', label: 'Final 1', weeks: 7 },
  { key: 'midterm_2', label: 'Midterm 2', weeks: 7 },
  { key: 'final_2', label: 'Final 2', weeks: 7 },
]

const WEEK_NUMBERS = Array.from({ length: 7 }, (_, i) => i + 1)

export default function ClassDetail() {
  const { classId } = useParams()
  const navigate = useNavigate()
  const [cls, setCls] = useState(null)
  const [selectedTerm, setSelectedTerm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [hasUnsavedGradebook, setHasUnsavedGradebook] = useState(false)

  useEffect(() => { fetchClass() }, [classId])
  useEffect(() => {
    if (!selectedTerm) setHasUnsavedGradebook(false)
  }, [selectedTerm])

  const fetchClass = async () => {
    const { data } = await supabase
      .from('classes')
      .select('*, users(full_name, email)')
      .eq('id', classId)
      .single()
    setCls(data)
    setLoading(false)
  }

  if (loading) return <Layout><div className="text-center text-gray-400 py-20">Loading...</div></Layout>
  if (!cls) return <Layout><div className="text-center text-gray-400 py-20">Class not found.</div></Layout>

  return (
    <Layout>
      <div className="mb-8">
        <button
          onClick={() => {
            const hasUnsaved = hasUnsavedGradebook || sessionStorage.getItem('gradebook_unsaved_changes') === '1'
            if (hasUnsaved) {
              const leave = window.confirm('You have unsaved gradebook changes. Please click Save before leaving this page. Continue anyway?')
              if (!leave) return
            }
            sessionStorage.setItem('gradebook_unsaved_changes', '0')
            navigate('/dashboard')
          }}
          className="text-sm text-gray-400 hover:text-gray-600 mb-4 flex items-center gap-1"
        >
          ← Back to Dashboard
        </button>
        <h2 className="text-2xl font-bold text-gray-900">{cls.name}</h2>
        <p className="text-gray-500 text-sm mt-1">
          {cls.subject} · {cls.level === 'primary' ? 'Primary' : 'Secondary'} · {cls.programme === 'bilingual' ? 'Bilingual' : 'Integrated'} · 2026–27
        </p>
      </div>

      {!selectedTerm ? (
        <div className="space-y-10">

          {/* Gradebooks Section */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Gradebooks</h3>
            <div className="grid grid-cols-2 gap-4 max-w-lg">
              {TERMS.map(term => (
                <button key={term.key} onClick={() => setSelectedTerm(term.key)}
                  className="bg-white rounded-xl border border-gray-200 p-6 text-left hover:shadow-sm transition-all"
                  style={{ borderTopColor: '#d1232a', borderTopWidth: 3 }}>
                  <div className="text-lg font-semibold text-gray-900">{term.label}</div>
                  <div className="text-sm text-gray-400 mt-1">{term.weeks} weeks · 2026–27</div>
                </button>
              ))}
            </div>
          </div>

          {/* Teacher Resources Section */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Teacher Resources</h3>
            <ResourceCards
              level={cls.level}
              grade={String(cls.name || '').trim().match(/^(\d+)/)?.[1] || null}
              programme={cls.programme}
              subject={cls.subject}
            />
          </div>

        </div>
      ) : (
        <Gradebook
          cls={cls}
          term={selectedTerm}
          termLabel={TERMS.find(t => t.key === selectedTerm)?.label}
          onBack={() => setSelectedTerm(null)}
          onUnsavedChange={setHasUnsavedGradebook}
        />
      )}
    </Layout>
  )
}

// ── Resource Cards ────────────────────────────────────────────────────────────
function ResourceCards({ level, grade, programme, subject }) {
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchResources() }, [level, grade, programme, subject])

  const fetchResources = async () => {
    let query = supabase
      .from('resource_links')
      .select('*')
      .eq('level', level)
      .eq('programme', programme)
      .eq('subject', subject)
      .order('sort_order')

    if (grade) {
      query = query.eq('grade', grade)
    }

    const { data } = await query
    setResources(data || [])
    setLoading(false)
  }

  const TYPE_ICON = { portal: '🌐', drive: '📁', pdf: '📄', other: '🔗' }
  const TYPE_LABEL = { portal: 'Online Portal', drive: 'Google Drive', pdf: 'PDF', other: 'Link' }

  if (loading) return <div className="text-sm text-gray-400">Loading resources...</div>
  if (resources.length === 0) return (
    <div className="text-sm text-gray-400 italic">No resources added yet for this class type.</div>
  )

  return (
    <div className="grid grid-cols-2 gap-4 max-w-2xl sm:grid-cols-3">
      {resources.map(r => {
        const isComingSoon = !r.url
        return isComingSoon ? (
          <div key={r.id}
            className="rounded-xl border border-gray-200 p-5 bg-gray-50 opacity-60 cursor-not-allowed">
            <div className="text-2xl mb-2">{TYPE_ICON[r.resource_type]}</div>
            <div className="font-semibold text-gray-400 text-sm">{r.title}</div>
            {r.description && <div className="text-xs text-gray-400 mt-1">{r.description}</div>}
            <div className="mt-3">
              <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-400 rounded-full">Coming Soon</span>
            </div>
          </div>
        ) : (
          <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer"
            className="rounded-xl border p-5 bg-white hover:shadow-md transition-all block"
            style={{ borderTopColor: '#1f86c7', borderTopWidth: 3 }}>
            <div className="text-2xl mb-2">{TYPE_ICON[r.resource_type]}</div>
            <div className="font-semibold text-gray-900 text-sm">{r.title}</div>
            {r.description && <div className="text-xs text-gray-500 mt-1">{r.description}</div>}
            <div className="mt-3">
              <span className="text-xs px-2 py-0.5 rounded-full font-medium text-white"
                style={{ backgroundColor: '#1f86c7' }}>
                {TYPE_LABEL[r.resource_type]}
              </span>
            </div>
          </a>
        )
      })}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const pct = (score, total) => (total > 0 ? (score / total) * 100 : null)
const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null
const fmt = (n) => n != null ? n.toFixed(1) : '—'
const letterGradeFromPercentage = (score) => {
  if (score == null) return '—'
  if (score >= 90.5) return 'A*'
  if (score >= 79.5) return 'A'
  if (score >= 64.5) return 'B'
  if (score >= 49.5) return 'C'
  if (score >= 34.5) return 'D'
  return 'E'
}

// ── Gradebook Shell ───────────────────────────────────────────────────────────
function Gradebook({ cls, term, termLabel, onBack, onUnsavedChange }) {
  const [activeTab, setActiveTab] = useState('participation')
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [dirtyTabs, setDirtyTabs] = useState({})
  const isESL = cls.subject === 'ESL'
  const isFinal = term === 'final_1' || term === 'final_2'

  useEffect(() => { fetchStudents() }, [cls.id])

  const fetchStudents = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('class_students')
      .select('students(*)')
      .eq('class_id', cls.id)
    const list = data?.map(d => d.students).sort((a, b) => a.name_eng.localeCompare(b.name_eng)) || []
    setStudents(list)
    setLoading(false)
  }

  const TABS = [
    { key: 'participation', label: 'Participation' },
    { key: 'assignments', label: 'Assignments' },
    { key: 'progress_test', label: 'Progress Test' },
    { key: 'summary', label: 'Summary' },
    ...(isFinal ? [{ key: 'comments', label: 'Comments' }] : []),
  ]

  const setTabDirty = (tabKey, isDirty) => {
    setDirtyTabs(prev => ({ ...prev, [tabKey]: isDirty }))
  }

  const hasAnyUnsaved = Object.values(dirtyTabs).some(Boolean)

  useEffect(() => {
    onUnsavedChange?.(hasAnyUnsaved)
  }, [hasAnyUnsaved, onUnsavedChange])

  useEffect(() => {
    sessionStorage.setItem('gradebook_unsaved_changes', hasAnyUnsaved ? '1' : '0')
  }, [hasAnyUnsaved])

  useEffect(() => {
    return () => {
      sessionStorage.setItem('gradebook_unsaved_changes', '0')
    }
  }, [])

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!hasAnyUnsaved) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasAnyUnsaved])

  const handleBackToTerms = () => {
    if (hasAnyUnsaved) {
      const leave = window.confirm('You have unsaved changes. Please click Save before leaving this gradebook. Continue anyway?')
      if (!leave) return
    }
    onBack()
  }

  const handleTabChange = (nextTab) => {
    if (nextTab === activeTab) return
    if (dirtyTabs[activeTab]) {
      const leave = window.confirm('You have unsaved changes in this tab. Please click Save before switching tabs. Continue anyway?')
      if (!leave) return
    }
    setActiveTab(nextTab)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={handleBackToTerms} className="text-sm text-gray-400 hover:text-gray-600">← Terms</button>
          <span className="text-gray-300">|</span>
          <h3 className="text-lg font-semibold text-gray-900">{termLabel}</h3>
        </div>
        <div className="flex items-center gap-3">
          {hasAnyUnsaved && (
            <span className="text-xs px-2 py-1 rounded-full font-medium bg-amber-100 text-amber-700 border border-amber-200">
              Unsaved Changes
            </span>
          )}
          <span className="text-sm text-gray-500">{students.length} students</span>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-20">Loading students...</div>
      ) : students.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          No students enrolled in this class yet.
        </div>
      ) : (
        <>
          <div className="flex gap-1 border-b border-gray-200 mb-6">
            {TABS.map(tab => (
              <button key={tab.key} onClick={() => handleTabChange(tab.key)}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'participation' && <ParticipationTab classId={cls.id} term={term} students={students} onDirtyChange={(value) => setTabDirty('participation', value)} />}
          {activeTab === 'assignments' && <AssignmentsTab classId={cls.id} term={term} students={students} onDirtyChange={(value) => setTabDirty('assignments', value)} />}
          {activeTab === 'progress_test' && <ProgressTestTab classId={cls.id} term={term} students={students} isESL={isESL} onDirtyChange={(value) => setTabDirty('progress_test', value)} />}
          {activeTab === 'summary' && <SummaryTab classId={cls.id} term={term} students={students} isESL={isESL} />}
          {activeTab === 'comments' && isFinal && <CommentsTab classId={cls.id} term={term} students={students} onDirtyChange={(value) => setTabDirty('comments', value)} />}
        </>
      )}
    </div>
  )
}

// ── Participation Tab ─────────────────────────────────────────────────────────
function ParticipationTab({ classId, term, students, onDirtyChange }) {
  const [grades, setGrades] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { fetchGrades() }, [classId, term])
  useEffect(() => { onDirtyChange?.(false) }, [classId, term])

  const fetchGrades = async () => {
    const { data } = await supabase
      .from('participation_grades')
      .select('*')
      .eq('class_id', classId)
      .eq('term', term)
    const map = {}
    data?.forEach(g => { map[`${g.student_id}_${g.week}`] = { score: g.score, comment: g.comment } })
    setGrades(map)
  }

  const setGrade = (studentId, week, field, value) => {
    onDirtyChange?.(true)
    setGrades(prev => ({ ...prev, [`${studentId}_${week}`]: { ...prev[`${studentId}_${week}`], [field]: value } }))
  }

  const saveAll = async () => {
    setSaving(true)
    const rows = []
    WEEK_NUMBERS.forEach(week => {
      students.forEach(student => {
        const key = `${student.id}_${week}`
        const g = grades[key]
        if (g?.score !== undefined && g?.score !== '') {
          rows.push({ class_id: classId, student_id: student.id, term, week, score: parseFloat(g.score), comment: g.comment || null })
        }
      })
    })
    await supabase.from('participation_grades').upsert(rows, { onConflict: 'class_id,student_id,term,week' })
    setSaving(false)
    setSaved(true)
    onDirtyChange?.(false)
    setTimeout(() => setSaved(false), 2000)
  }

  const getAvg = (studentId) => {
    const scores = WEEK_NUMBERS.map(w => grades[`${studentId}_${w}`]?.score).filter(s => s !== undefined && s !== '' && s !== null).map(Number)
    return avg(scores)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">Weekly participation scores out of 10. 7 weeks per term.</p>
        <button onClick={saveAll} disabled={saving}
          className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300">
          {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save'}
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-gray-500 font-medium sticky left-0 bg-gray-50 min-w-48">Student</th>
              {WEEK_NUMBERS.map(w => (
                <th key={w} className="text-center px-2 py-3 text-gray-500 font-medium min-w-28">Week {w}</th>
              ))}
              <th className="text-center px-4 py-3 text-gray-500 font-medium min-w-20">Avg /10</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {students.map(student => (
              <tr key={student.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 sticky left-0 bg-white">
                  <div className="font-medium text-gray-900">{student.name_eng}</div>
                  <div className="text-xs text-gray-400">{student.student_id}</div>
                </td>
                {WEEK_NUMBERS.map(week => {
                  const key = `${student.id}_${week}`
                  return (
                    <td key={week} className="px-2 py-2">
                      <input type="number" min="0" max="10" step="0.5" placeholder="—"
                        value={grades[key]?.score ?? ''}
                        onChange={e => setGrade(student.id, week, 'score', e.target.value)}
                        className="w-14 text-center border border-gray-200 rounded px-1 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-1 block mx-auto"
                      />
                      <input type="text" placeholder="note"
                        value={grades[key]?.comment ?? ''}
                        onChange={e => setGrade(student.id, week, 'comment', e.target.value)}
                        className="w-full border border-gray-200 rounded px-1 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                  )
                })}
                <td className="px-4 py-3 text-center">
                  <span className={`font-semibold ${getAvg(student.id) != null ? 'text-blue-600' : 'text-gray-300'}`}>
                    {fmt(getAvg(student.id))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Assignments Tab ───────────────────────────────────────────────────────────
function AssignmentsTab({ classId, term, students, onDirtyChange }) {
  const [assignments, setAssignments] = useState([])
  const [grades, setGrades] = useState({})
  const [showForm, setShowForm] = useState(false)
  const [newAssignment, setNewAssignment] = useState({ name: '', max_points: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { fetchAssignments() }, [classId, term])
  useEffect(() => { onDirtyChange?.(false) }, [classId, term])

  const fetchAssignments = async () => {
    const { data: aData } = await supabase.from('assignments').select('*').eq('class_id', classId).eq('term', term).order('created_at')
    setAssignments(aData || [])
    if (aData?.length) {
      const { data: gData } = await supabase.from('assignment_grades').select('*').in('assignment_id', aData.map(a => a.id))
      const map = {}
      gData?.forEach(g => { map[`${g.assignment_id}_${g.student_id}`] = { score: g.score, is_absent: g.is_absent } })
      setGrades(map)
    }
  }

  const createAssignment = async () => {
    if (!newAssignment.name || !newAssignment.max_points) return
    const { data } = await supabase.from('assignments').insert({ class_id: classId, term, name: newAssignment.name, max_points: parseFloat(newAssignment.max_points) }).select().single()
    setAssignments(prev => [...prev, data])
    setNewAssignment({ name: '', max_points: '' })
    setShowForm(false)
  }

  const setGrade = (assignmentId, studentId, field, value) => {
    onDirtyChange?.(true)
    setGrades(prev => ({ ...prev, [`${assignmentId}_${studentId}`]: { ...prev[`${assignmentId}_${studentId}`], [field]: value } }))
  }

  const getStudentAvg = (studentId) => {
    const pcts = assignments.map(a => {
      const g = grades[`${a.id}_${studentId}`]
      if (!g || g.is_absent || g.score === '' || g.score == null) return null
      return pct(parseFloat(g.score), a.max_points)
    }).filter(p => p !== null)
    return avg(pcts)
  }

  const saveAll = async () => {
    setSaving(true)
    const rows = []
    assignments.forEach(assignment => {
      students.forEach(student => {
        const key = `${assignment.id}_${student.id}`
        const g = grades[key]
        if (g !== undefined) {
          rows.push({ assignment_id: assignment.id, student_id: student.id, score: g.is_absent ? null : (g.score !== '' ? parseFloat(g.score) : null), is_absent: g.is_absent || false })
        }
      })
    })
    await supabase.from('assignment_grades').upsert(rows, { onConflict: 'assignment_id,student_id' })
    setSaving(false)
    setSaved(true)
    onDirtyChange?.(false)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">Create assignments and enter student scores. Absent students are excluded from averages.</p>
        <div className="flex gap-2">
          <button onClick={() => setShowForm(!showForm)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            + New Assignment
          </button>
          {assignments.length > 0 && (
            <button onClick={saveAll} disabled={saving} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300">
              {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save'}
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex gap-3 items-end">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Assignment Name</label>
            <input type="text" placeholder="e.g. Essay 1" value={newAssignment.name}
              onChange={e => setNewAssignment({ ...newAssignment, name: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Total Points</label>
            <input type="number" placeholder="100" value={newAssignment.max_points}
              onChange={e => setNewAssignment({ ...newAssignment, max_points: e.target.value })}
              className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button onClick={createAssignment} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Create</button>
          <button onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-500 rounded-lg text-sm hover:bg-gray-100">Cancel</button>
        </div>
      )}

      {assignments.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">No assignments yet. Create one to get started.</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-gray-500 font-medium sticky left-0 bg-gray-50 min-w-48">Student</th>
                {assignments.map(a => (
                  <th key={a.id} className="text-center px-3 py-3 text-gray-500 font-medium min-w-32">
                    <div>{a.name}</div>
                    <div className="text-xs font-normal text-gray-400">/ {a.max_points}</div>
                  </th>
                ))}
                <th className="text-center px-4 py-3 text-gray-500 font-medium min-w-24">Avg %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {students.map(student => (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 sticky left-0 bg-white">
                    <div className="font-medium text-gray-900">{student.name_eng}</div>
                    <div className="text-xs text-gray-400">{student.student_id}</div>
                  </td>
                  {assignments.map(assignment => {
                    const key = `${assignment.id}_${student.id}`
                    const g = grades[key] || {}
                    return (
                      <td key={assignment.id} className="px-3 py-2 text-center">
                        {g.is_absent ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className="px-2 py-1 bg-orange-100 text-orange-600 rounded text-xs font-medium">Absent</span>
                            <button onClick={() => setGrade(assignment.id, student.id, 'is_absent', false)} className="text-xs text-gray-400 hover:text-gray-600">undo</button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <input type="number" min="0" max={assignment.max_points} placeholder="—"
                              value={g.score ?? ''}
                              onChange={e => setGrade(assignment.id, student.id, 'score', e.target.value)}
                              className="w-16 text-center border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            <button onClick={() => setGrade(assignment.id, student.id, 'is_absent', true)} className="text-xs text-gray-400 hover:text-orange-500">A (absent)</button>
                          </div>
                        )}
                      </td>
                    )
                  })}
                  <td className="px-4 py-3 text-center">
                    <span className={`font-semibold ${getStudentAvg(student.id) != null ? 'text-blue-600' : 'text-gray-300'}`}>
                      {fmt(getStudentAvg(student.id))}{getStudentAvg(student.id) != null ? '%' : ''}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Progress Test Tab ─────────────────────────────────────────────────────────
function ProgressTestTab({ classId, term, students, isESL, onDirtyChange }) {
  const [grades, setGrades] = useState({})
  const [totals, setTotals] = useState(
    isESL
      ? { rw_total: '', l_total: '', s_total: '' }
      : { total_points: '' }
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { fetchGrades() }, [classId, term])
  useEffect(() => { onDirtyChange?.(false) }, [classId, term, isESL])

  const fetchGrades = async () => {
    const { data } = await supabase.from('progress_test_grades').select('*').eq('class_id', classId).eq('term', term)
    const map = {}
    data?.forEach(g => {
      map[g.student_id] = isESL
        ? { rw: g.reading_writing_score, l: g.listening_score, s: g.speaking_score }
        : { score: g.score }
      if (isESL && data[0]) {
        setTotals({ rw_total: data[0].reading_writing_total || '', l_total: data[0].listening_total || '', s_total: data[0].speaking_total || '' })
      } else if (!isESL && data[0]) {
        setTotals({ total_points: data[0].total_points || '' })
      }
    })
    setGrades(map)
  }

  const setGrade = (studentId, field, value) => {
    onDirtyChange?.(true)
    setGrades(prev => ({ ...prev, [studentId]: { ...prev[studentId], [field]: value } }))
  }

  const getOverall = (studentId) => {
    const g = grades[studentId]
    if (!g) return null
    if (isESL) {
      const rwPct = totals.rw_total && g.rw !== '' && g.rw != null ? pct(parseFloat(g.rw), parseFloat(totals.rw_total)) : null
      const lPct = totals.l_total && g.l !== '' && g.l != null ? pct(parseFloat(g.l), parseFloat(totals.l_total)) : null
      const sPct = totals.s_total && g.s !== '' && g.s != null ? pct(parseFloat(g.s), parseFloat(totals.s_total)) : null
      const valid = [rwPct, lPct, sPct].filter(p => p !== null)
      return valid.length === 3 ? avg(valid) : null
    } else {
      return totals.total_points && g.score !== '' && g.score != null ? pct(parseFloat(g.score), parseFloat(totals.total_points)) : null
    }
  }

  const saveAll = async () => {
    setSaving(true)
    const rows = students.map(student => {
      const g = grades[student.id] || {}
      const overall = getOverall(student.id)
      if (isESL) {
        return {
          class_id: classId, student_id: student.id, term,
          reading_writing_score: g.rw != null && g.rw !== '' ? parseFloat(g.rw) : null,
          reading_writing_total: totals.rw_total ? parseFloat(totals.rw_total) : null,
          listening_score: g.l != null && g.l !== '' ? parseFloat(g.l) : null,
          listening_total: totals.l_total ? parseFloat(totals.l_total) : null,
          speaking_score: g.s != null && g.s !== '' ? parseFloat(g.s) : null,
          speaking_total: totals.s_total ? parseFloat(totals.s_total) : null,
          overall_percentage: overall
        }
      } else {
        return {
          class_id: classId, student_id: student.id, term,
          score: g.score != null && g.score !== '' ? parseFloat(g.score) : null,
          total_points: totals.total_points ? parseFloat(totals.total_points) : null,
          overall_percentage: overall
        }
      }
    })
    await supabase.from('progress_test_grades').upsert(rows, { onConflict: 'class_id,student_id,term' })
    setSaving(false)
    setSaved(true)
    onDirtyChange?.(false)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">
          {isESL ? 'Enter total points for each component, then student scores.' : 'Enter total points for the test, then student scores.'}
        </p>
        <button onClick={saveAll} disabled={saving} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300">
          {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save'}
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex gap-6 items-end">
        {isESL ? (
          <>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Reading & Writing — Total Points</label>
              <input type="number" placeholder="e.g. 50" value={totals.rw_total}
                onChange={e => {
                  onDirtyChange?.(true)
                  setTotals(prev => ({ ...prev, rw_total: e.target.value }))
                }}
                className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Listening — Total Points</label>
              <input type="number" placeholder="e.g. 40" value={totals.l_total}
                onChange={e => {
                  onDirtyChange?.(true)
                  setTotals(prev => ({ ...prev, l_total: e.target.value }))
                }}
                className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Speaking — Total Points</label>
              <input type="number" placeholder="e.g. 10" value={totals.s_total}
                onChange={e => {
                  onDirtyChange?.(true)
                  setTotals(prev => ({ ...prev, s_total: e.target.value }))
                }}
                className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </>
        ) : (
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Total Points</label>
            <input type="number" placeholder="e.g. 100" value={totals.total_points}
              onChange={e => {
                onDirtyChange?.(true)
                setTotals(prev => ({ ...prev, total_points: e.target.value }))
              }}
              className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-gray-500 font-medium sticky left-0 bg-gray-50 min-w-48">Student</th>
              {isESL ? (
                <>
                  <th className="text-center px-3 py-3 text-gray-500 font-medium min-w-36">Reading & Writing {totals.rw_total ? `/ ${totals.rw_total}` : ''}</th>
                  <th className="text-center px-3 py-3 text-gray-500 font-medium min-w-32">Listening {totals.l_total ? `/ ${totals.l_total}` : ''}</th>
                  <th className="text-center px-3 py-3 text-gray-500 font-medium min-w-32">Speaking {totals.s_total ? `/ ${totals.s_total}` : ''}</th>
                </>
              ) : (
                <th className="text-center px-3 py-3 text-gray-500 font-medium min-w-32">Score {totals.total_points ? `/ ${totals.total_points}` : ''}</th>
              )}
              <th className="text-center px-4 py-3 text-gray-500 font-medium min-w-24">Overall %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {students.map(student => {
              const g = grades[student.id] || {}
              const overall = getOverall(student.id)
              return (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 sticky left-0 bg-white">
                    <div className="font-medium text-gray-900">{student.name_eng}</div>
                    <div className="text-xs text-gray-400">{student.student_id}</div>
                  </td>
                  {isESL ? (
                    <>
                      <td className="px-3 py-2 text-center">
                        <input type="number" min="0" max={totals.rw_total || undefined} placeholder="—"
                          value={g.rw ?? ''}
                          onChange={e => setGrade(student.id, 'rw', e.target.value)}
                          className="w-20 text-center border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input type="number" min="0" max={totals.l_total || undefined} placeholder="—"
                          value={g.l ?? ''}
                          onChange={e => setGrade(student.id, 'l', e.target.value)}
                          className="w-20 text-center border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input type="number" min="0" max={totals.s_total || undefined} placeholder="—"
                          value={g.s ?? ''}
                          onChange={e => setGrade(student.id, 's', e.target.value)}
                          className="w-20 text-center border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </td>
                    </>
                  ) : (
                    <td className="px-3 py-2 text-center">
                      <input type="number" min="0" max={totals.total_points || undefined} placeholder="—"
                        value={g.score ?? ''}
                        onChange={e => setGrade(student.id, 'score', e.target.value)}
                        className="w-20 text-center border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </td>
                  )}
                  <td className="px-4 py-3 text-center">
                    <span className={`font-semibold ${overall != null ? 'text-blue-600' : 'text-gray-300'}`}>
                      {fmt(overall)}{overall != null ? '%' : ''}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Summary Tab ───────────────────────────────────────────────────────────────
function SummaryTab({ classId, term, students, isESL }) {
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchAll() }, [classId, term])

  const fetchAll = async () => {
    setLoading(true)
    const [{ data: partData }, { data: assignData }, { data: assignGrades }, { data: ptData }] = await Promise.all([
      supabase.from('participation_grades').select('*').eq('class_id', classId).eq('term', term),
      supabase.from('assignments').select('*').eq('class_id', classId).eq('term', term),
      supabase.from('assignment_grades').select('*'),
      supabase.from('progress_test_grades').select('*').eq('class_id', classId).eq('term', term),
    ])

    const summary = {}
    students.forEach(student => {
      const partScores = partData?.filter(g => g.student_id === student.id && g.score != null).map(g => g.score) || []
      const partAvg = avg(partScores)
      const partPct = partAvg != null ? (partAvg / 10) * 100 : null

      const assignPcts = assignData?.map(a => {
        const g = assignGrades?.find(g => g.assignment_id === a.id && g.student_id === student.id)
        if (!g || g.is_absent || g.score == null) return null
        return pct(g.score, a.max_points)
      }).filter(p => p !== null) || []
      const assignAvg = avg(assignPcts)

      const attainment = partPct != null && assignAvg != null
        ? (partPct * 0.20) + (assignAvg * 0.80)
        : partPct != null ? partPct * 0.20
        : assignAvg != null ? assignAvg * 0.80
        : null

      const pt = ptData?.find(g => g.student_id === student.id)
      const ptOverall = pt?.overall_percentage ?? null

      const total = attainment != null && ptOverall != null
        ? (attainment * 0.75) + (ptOverall * 0.25)
        : null

      summary[student.id] = { partPct, assignAvg, attainment, ptOverall, total }
    })

    setData(summary)
    setLoading(false)
  }

  const scoreColor = (score) => {
    if (score == null) return 'text-gray-300'
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-blue-600'
    if (score >= 40) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">
          Auto-calculated. Attainment = Participation (20%) + Assignments (80%). Total = Attainment (75%) + Progress Test (25%).
        </p>
        <button onClick={fetchAll} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
          ↻ Refresh
        </button>
      </div>
      {loading ? (
        <div className="text-center text-gray-400 py-10">Calculating...</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-gray-500 font-medium sticky left-0 bg-gray-50 min-w-48">Student</th>
                <th className="text-center px-4 py-3 text-gray-500 font-medium">Participation %</th>
                <th className="text-center px-4 py-3 text-gray-500 font-medium">Assignments %</th>
                <th className="text-center px-4 py-3 text-gray-500 font-medium bg-blue-50">Attainment %</th>
                <th className="text-center px-4 py-3 text-gray-500 font-medium">Progress Test %</th>
                <th className="text-center px-4 py-3 text-gray-500 font-medium bg-green-50">Total %</th>
                <th className="text-center px-4 py-3 text-gray-500 font-medium">Letter Grade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {students.map(student => {
                const d = data[student.id] || {}
                return (
                  <tr key={student.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 sticky left-0 bg-white">
                      <div className="font-medium text-gray-900">{student.name_eng}</div>
                      <div className="text-xs text-gray-400">{student.student_id}</div>
                    </td>
                    <td className={`px-4 py-3 text-center font-medium ${scoreColor(d.partPct)}`}>{fmt(d.partPct)}{d.partPct != null ? '%' : ''}</td>
                    <td className={`px-4 py-3 text-center font-medium ${scoreColor(d.assignAvg)}`}>{fmt(d.assignAvg)}{d.assignAvg != null ? '%' : ''}</td>
                    <td className={`px-4 py-3 text-center font-semibold bg-blue-50 ${scoreColor(d.attainment)}`}>{fmt(d.attainment)}{d.attainment != null ? '%' : ''}</td>
                    <td className={`px-4 py-3 text-center font-medium ${scoreColor(d.ptOverall)}`}>{fmt(d.ptOverall)}{d.ptOverall != null ? '%' : ''}</td>
                    <td className={`px-4 py-3 text-center font-bold bg-green-50 ${scoreColor(d.total)}`}>{fmt(d.total)}{d.total != null ? '%' : ''}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-semibold text-gray-800">{letterGradeFromPercentage(d.total)}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Comments Tab ──────────────────────────────────────────────────────────────
function CommentsTab({ classId, term, students, onDirtyChange }) {
  const [comments, setComments] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { fetchComments() }, [classId, term])
  useEffect(() => { onDirtyChange?.(false) }, [classId, term])

  const fetchComments = async () => {
    const { data } = await supabase.from('term_comments').select('*').eq('class_id', classId).eq('term', term)
    const map = {}
    data?.forEach(c => { map[c.student_id] = c.comment })
    setComments(map)
  }

  const saveAll = async () => {
    setSaving(true)
    const rows = students
      .filter(s => comments[s.id] !== undefined && comments[s.id] !== '')
      .map(s => ({ class_id: classId, student_id: s.id, term, comment: comments[s.id] }))
    await supabase.from('term_comments').upsert(rows, { onConflict: 'class_id,student_id,term' })
    setSaving(false)
    setSaved(true)
    onDirtyChange?.(false)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">Write end of term comments for each student.</p>
        <button onClick={saveAll} disabled={saving} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300">
          {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save'}
        </button>
      </div>
      <div className="space-y-4">
        {students.map(student => (
          <div key={student.id} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="mb-2">
              <span className="font-medium text-gray-900">{student.name_eng}</span>
              <span className="text-xs text-gray-400 ml-2">{student.student_id}</span>
            </div>
            <textarea rows={4} placeholder="Write a comment for this student..."
              value={comments[student.id] ?? ''}
              onChange={e => {
                onDirtyChange?.(true)
                setComments(prev => ({ ...prev, [student.id]: e.target.value }))
              }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
        ))}
      </div>
    </div>
  )
}