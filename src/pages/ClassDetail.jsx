import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const TERMS = [
  { key: 'midterm_1', label: 'Midterm 1', weeks: 8 },
  { key: 'final_1', label: 'Final 1', weeks: 8 },
  { key: 'midterm_2', label: 'Midterm 2', weeks: 12 },
  { key: 'final_2', label: 'Final 2', weeks: 12 },
]

const PARTICIPATION_WEEK_SCHEDULE = {
  midterm_1: [
    { week: 0, label: 'Orientation', range: 'Aug. 17 - Aug. 21' },
    { week: 1, label: 'Week 1', range: 'Aug. 24 - Aug. 28' },
    { week: 2, label: 'Week 2', range: 'Aug. 31 - Sep. 5' },
    { week: 3, label: 'Week 3', range: 'Sep. 7 - Sep. 11' },
    { week: 4, label: 'Week 4', range: 'Sep. 14 - Sep. 18' },
    { week: 5, label: 'Week 5', range: 'Sep. 21 - Sep. 25' },
    { week: 6, label: 'Week 6', range: 'Sep. 28 - Oct. 2' },
    { week: 7, label: 'Week 7', range: 'Oct. 5 - Oct. 9', isNoScore: true, noScoreReason: 'Exam Week' },
  ],
  final_1: [
    { week: 8, label: 'Week 8', range: 'Oct. 12 - Oct. 16' },
    { week: 9, label: 'Week 9', range: 'Oct. 19 - Oct. 23' },
    { week: 10, label: 'Week 10', range: 'Oct. 26 - Oct. 31' },
    { week: 11, label: 'Week 11', range: 'Nov. 2 - Nov. 6' },
    { week: 12, label: 'Week 12', range: 'Nov. 9 - Nov. 13' },
    { week: 13, label: 'Week 13', range: 'Nov. 16 - Nov. 20' },
    { week: 14, label: 'Week 14', range: 'Nov. 23 - Nov. 27' },
    { week: 15, label: 'Week 15', range: 'Nov. 30 - Dec. 4', isNoScore: true, noScoreReason: 'Exam Week' },
  ],
  midterm_2: [
    { week: 16, label: 'Week 16', range: 'Dec. 7 - Dec. 11' },
    { week: 17, label: 'Week 17', range: 'Dec. 14 - Dec. 18' },
    { week: 18, label: 'Week 18', range: 'Dec. 21 - Dec. 25', isNoScore: true, noScoreReason: 'Christmas Break' },
    { week: 19, label: 'Week 19', range: 'Dec. 28 - Jan. 1', isNoScore: true, noScoreReason: 'Christmas Break' },
    { week: 20, label: 'Week 20', range: 'Jan. 4 - Jan. 8' },
    { week: 21, label: 'Week 21', range: 'Jan. 11 - Jan. 15' },
    { week: 22, label: 'Week 22', range: 'Jan. 18 - Jan. 22' },
    { week: 23, label: 'Week 23', range: 'Jan. 25 - Jan. 29' },
    { week: 24, label: 'Week 24', range: 'Feb. 1 - Feb. 5', isNoScore: true, noScoreReason: 'Tet Holiday Break' },
    { week: 25, label: 'Week 25', range: 'Feb. 8 - Feb. 12', isNoScore: true, noScoreReason: 'Tet Holiday Break' },
    { week: 26, label: 'Week 26', range: 'Feb. 15 - Feb. 19' },
    { week: 27, label: 'Week 27', range: 'Feb. 22 - Feb. 26', isNoScore: true, noScoreReason: 'Exam Week' },
  ],
  final_2: [
    { week: 28, label: 'Week 28', range: 'Mar. 1 - Mar. 5' },
    { week: 29, label: 'Week 29', range: 'Mar. 8 - Mar. 12' },
    { week: 30, label: 'Week 30', range: 'Mar. 15 - Mar. 19' },
    { week: 31, label: 'Week 31', range: 'Mar. 22 - Mar. 26' },
    { week: 32, label: 'Week 32', range: 'Mar. 29 - Apr. 2' },
    { week: 33, label: 'Week 33', range: 'Apr. 5 - Apr. 9' },
    { week: 34, label: 'Week 34', range: 'Apr. 12 - Apr. 16' },
    { week: 35, label: 'Week 35', range: 'Apr. 19 - Apr. 23', isNoScore: true, noScoreReason: 'Final Exam Week' },
    { week: 36, label: 'Week 36', range: 'Apr. 26 - Apr. 30', isNoScore: true, noScoreReason: 'Final Exam Week' },
    { week: 37, label: 'Week 37', range: 'May 3 - May 7', isNoScore: true, noScoreReason: 'Post Exam Week' },
    { week: 38, label: 'Week 38', range: 'May 10 - May 14', isNoScore: true, noScoreReason: 'Post Exam Week' },
    { week: 39, label: 'Week 39', range: 'May 17 - May 21', isNoScore: true, noScoreReason: 'Post Exam Week' },
  ],
}

const getTermDateSummary = (termKey) => {
  const weeks = PARTICIPATION_WEEK_SCHEDULE[termKey] || []
  if (weeks.length === 0) return null

  const firstRange = weeks[0]?.range || ''
  const lastRange = weeks[weeks.length - 1]?.range || ''

  const firstDate = firstRange.split('-')[0]?.trim() || ''
  const lastDate = lastRange.split('-')[1]?.trim() || ''
  if (!firstDate || !lastDate || firstDate === 'Date TBD' || lastDate === 'Date TBD') return null

  return `${firstDate} - ${lastDate}`
}

export default function ClassDetail() {
  const { classId } = useParams()
  const navigate = useNavigate()
  const [cls, setCls] = useState(null)
  const [selectedTerm, setSelectedTerm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [hasUnsavedGradebook, setHasUnsavedGradebook] = useState(false)
  const [studentRoster, setStudentRoster] = useState([])

  useEffect(() => { fetchClass() }, [classId])
  useEffect(() => { fetchStudentRoster() }, [classId])
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

  const fetchStudentRoster = async () => {
    const { data } = await supabase
      .from('class_students')
      .select('students(*)')
      .eq('class_id', classId)

    const list = (data || [])
      .map(row => row.students)
      .filter(Boolean)
      .sort((a, b) => (a.name_eng || '').localeCompare(b.name_eng || '', undefined, { numeric: true }))

    setStudentRoster(list)
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
          ← Go Back
        </button>
        <h2 className="text-2xl font-bold text-gray-900">{cls.name}</h2>
        <p className="text-gray-500 text-sm mt-1">
          {cls.level === 'primary' ? 'Primary' : 'Secondary'} · {cls.programme === 'bilingual' ? 'Bilingual' : 'Integrated'} · 2026-2027
        </p>
      </div>

      {!selectedTerm ? (
        <div className="space-y-10">

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Student List */}
            <div className="lg:col-span-5 bg-white rounded-xl border border-gray-200 overflow-hidden" style={{ borderTopColor: '#1f86c7', borderTopWidth: 3 }}>
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Student List</h3>
                <span className="text-xs text-gray-500">{studentRoster.length} students</span>
              </div>
              {studentRoster.length === 0 ? (
                <div className="p-6 text-sm text-gray-400">No students enrolled in this class yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-4 py-3 text-gray-500 font-medium">Student ID</th>
                        <th className="text-left px-4 py-3 text-gray-500 font-medium">Student Name (ENG)</th>
                        <th className="text-left px-4 py-3 text-gray-500 font-medium">Student Name (VN)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {studentRoster.map(student => (
                        <tr key={student.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-600">{student.student_id || '—'}</td>
                          <td className="px-4 py-3 font-medium text-gray-900">{student.name_eng || '—'}</td>
                          <td className="px-4 py-3 text-gray-600">{student.name_vn || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="lg:col-span-7 space-y-4">
              {/* Gradebooks Section */}
              <div className="bg-white rounded-xl border border-gray-200 p-4" style={{ borderTopColor: '#d1232a', borderTopWidth: 3 }}>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Gradebooks</h3>
                <div className="grid grid-cols-2 gap-4">
                  {TERMS.map(term => (
                    <button key={term.key} onClick={() => setSelectedTerm(term.key)}
                      className="bg-white rounded-xl border border-gray-200 p-6 text-left hover:shadow-sm transition-all"
                      style={{ borderTopColor: '#9ca3af', borderTopWidth: 3 }}>
                      <div className="text-lg font-semibold text-gray-900">{term.label}</div>
                      <div className="text-sm text-gray-400 mt-1">
                        {term.weeks} weeks
                        {getTermDateSummary(term.key) ? ` · ${getTermDateSummary(term.key)}` : ''}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Teacher Resources Section */}
              <div className="bg-white rounded-xl border border-gray-200 p-4" style={{ borderTopColor: '#ffc612', borderTopWidth: 3 }}>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Teacher Resources</h3>
                <ResourceCards
                  level={cls.level}
                  grade={String(cls.name || '').trim().match(/^(\d+)/)?.[1] || null}
                  programme={cls.programme}
                  subject={cls.subject}
                />
              </div>
            </div>
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
    { key: 'student_attributes', label: 'Student Attributes' },
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
        <h3 className="text-lg font-semibold text-gray-900">{termLabel}</h3>
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
          {activeTab === 'student_attributes' && <StudentAttributesTab classId={cls.id} term={term} students={students} onDirtyChange={(value) => setTabDirty('student_attributes', value)} />}
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
  const [openCommentKey, setOpenCommentKey] = useState(null)
  const [draftComment, setDraftComment] = useState('')

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

  const openCommentEditor = (key) => {
    setOpenCommentKey(key)
    setDraftComment(grades[key]?.comment ?? '')
  }

  const saveComment = (studentId, week) => {
    setGrade(studentId, week, 'comment', draftComment)
    setOpenCommentKey(null)
    setDraftComment('')
  }

  const saveAll = async () => {
    setSaving(true)
    const rows = []
    weekSchedule.forEach(({ week, isNoScore }) => {
      if (isNoScore) return
      students.forEach(student => {
        const key = `${student.id}_${week}`
        const g = grades[key]
        const hasTouchedScore = g?.score !== undefined
        const hasTouchedComment = g?.comment !== undefined
        if (!hasTouchedScore && !hasTouchedComment) return

        const parsedScore = g?.score === '' || g?.score == null ? null : parseFloat(g.score)
        rows.push({
          class_id: classId,
          student_id: student.id,
          term,
          week,
          score: Number.isNaN(parsedScore) ? null : parsedScore,
          comment: g?.comment || null,
        })
      })
    })
    await supabase.from('participation_grades').upsert(rows, { onConflict: 'class_id,student_id,term,week' })
    setSaving(false)
    setSaved(true)
    onDirtyChange?.(false)
    setTimeout(() => setSaved(false), 2000)
  }

  const getAvg = (studentId) => {
    const scores = weekSchedule
      .filter(w => !w.isNoScore)
      .map(w => grades[`${studentId}_${w.week}`]?.score)
      .filter(s => s !== undefined && s !== '' && s !== null)
      .map(Number)
    return avg(scores)
  }

  const weekSchedule = PARTICIPATION_WEEK_SCHEDULE[term] || Array.from({ length: 7 }, (_, idx) => ({
    week: idx + 1,
    label: `Week ${idx + 1}`,
    range: 'Date TBD',
  }))

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">Weekly participation scores out of 10.</p>
        <button onClick={saveAll} disabled={saving}
          className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300">
          {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save'}
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-gray-500 font-medium sticky left-0 bg-gray-50 min-w-48">Student</th>
              {weekSchedule.map((weekItem) => (
                <th key={weekItem.week} className="text-center px-2 py-3 text-gray-500 font-medium min-w-28">
                  <div>{weekItem.label}</div>
                  <div className="text-[10px] text-gray-400 font-normal mt-0.5">{weekItem.range}</div>
                  {weekItem.isNoScore && (
                    <div className="text-[10px] text-rose-600 font-semibold mt-0.5">No Score</div>
                  )}
                </th>
              ))}
              <th className="text-center px-4 py-3 text-gray-500 font-medium min-w-20">Avg /10</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {students.map(student => (
              <tr key={student.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 sticky left-0 bg-white">
                  <div className="font-medium text-gray-900">{student.name_eng || '—'}</div>
                  <div className="text-sm text-gray-500">{student.name_vn || '—'}</div>
                  <div className="text-xs text-gray-400">{student.student_id || '—'}</div>
                </td>
                {weekSchedule.map((weekItem) => {
                  const key = `${student.id}_${weekItem.week}`
                  const isNoScoreWeek = !!weekItem.isNoScore
                  return (
                    <td key={weekItem.week} className="px-2 py-2">
                      {isNoScoreWeek ? (
                        <div className="flex items-center justify-center h-[52px]">
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded text-[10px] font-semibold">
                            {weekItem.noScoreReason || 'No Score Week'}
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <input type="number" min="0" max="10" step="0.5" placeholder="—"
                            value={grades[key]?.score ?? ''}
                            onChange={e => setGrade(student.id, weekItem.week, 'score', e.target.value)}
                            className="w-14 text-center border border-gray-200 rounded px-1 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-1 block mx-auto"
                          />
                          {openCommentKey === key ? (
                            <div className="space-y-1">
                              <input
                                type="text"
                                placeholder="Type comment"
                                value={draftComment}
                                onChange={e => setDraftComment(e.target.value)}
                                className="w-full border border-gray-200 bg-gray-50 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => saveComment(student.id, weekItem.week)}
                                  className="text-[10px] px-2 py-0.5 rounded bg-green-600 text-white hover:bg-green-700"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenCommentKey(null)
                                    setDraftComment('')
                                  }}
                                  className="text-[10px] text-gray-400 hover:text-gray-600"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openCommentEditor(key)}
                              className={`block mx-auto text-[10px] px-1.5 py-0.5 rounded border ${
                                grades[key]?.comment
                                  ? 'border-blue-200 bg-blue-50 text-blue-600'
                                  : 'border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              {grades[key]?.comment ? 'Edit Comment' : 'Add Comment'}
                            </button>
                          )}
                        </div>
                      )}
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
  const [openCommentKey, setOpenCommentKey] = useState(null)
  const [draftComment, setDraftComment] = useState('')
  const [deletingAssignmentId, setDeletingAssignmentId] = useState(null)
  const [confirmDeleteAssignment, setConfirmDeleteAssignment] = useState(null)

  useEffect(() => { fetchAssignments() }, [classId, term])
  useEffect(() => { onDirtyChange?.(false) }, [classId, term])

  const fetchAssignments = async () => {
    const { data: aData } = await supabase.from('assignments').select('*').eq('class_id', classId).eq('term', term).order('created_at')
    setAssignments(aData || [])
    if (aData?.length) {
      const { data: gData } = await supabase.from('assignment_grades').select('*').in('assignment_id', aData.map(a => a.id))
      const map = {}
      gData?.forEach(g => { map[`${g.assignment_id}_${g.student_id}`] = { score: g.score, is_absent: g.is_absent, comment: g.comment } })
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

  const deleteAssignment = async (assignment) => {
    setDeletingAssignmentId(assignment.id)
    await supabase.from('assignment_grades').delete().eq('assignment_id', assignment.id)
    await supabase.from('assignments').delete().eq('id', assignment.id)

    setAssignments(prev => prev.filter(a => a.id !== assignment.id))
    setGrades(prev => {
      const next = { ...prev }
      students.forEach(student => {
        delete next[`${assignment.id}_${student.id}`]
      })
      return next
    })
    setConfirmDeleteAssignment(null)
    setDeletingAssignmentId(null)
  }

  const setGrade = (assignmentId, studentId, field, value) => {
    onDirtyChange?.(true)
    setGrades(prev => ({ ...prev, [`${assignmentId}_${studentId}`]: { ...prev[`${assignmentId}_${studentId}`], [field]: value } }))
  }

  const openCommentEditor = (key) => {
    setOpenCommentKey(key)
    setDraftComment(grades[key]?.comment ?? '')
  }

  const saveComment = (assignmentId, studentId) => {
    setGrade(assignmentId, studentId, 'comment', draftComment)
    setOpenCommentKey(null)
    setDraftComment('')
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
          rows.push({
            assignment_id: assignment.id,
            student_id: student.id,
            score: g.is_absent ? null : (g.score !== '' ? parseFloat(g.score) : null),
            is_absent: g.is_absent || false,
            comment: g.comment ? g.comment.trim() : null,
          })
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
            <button onClick={saveAll} disabled={saving} className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300">
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

      {confirmDeleteAssignment && (
        <div className="mb-4 px-4 py-4 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm font-medium text-red-700 mb-3">
            Delete <strong>{confirmDeleteAssignment.name}</strong>? This will remove all student scores for this assignment.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => deleteAssignment(confirmDeleteAssignment)}
              disabled={deletingAssignmentId === confirmDeleteAssignment.id}
              className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:bg-gray-300"
            >
              {deletingAssignmentId === confirmDeleteAssignment.id ? 'Deleting...' : 'Yes, delete assignment'}
            </button>
            <button
              onClick={() => setConfirmDeleteAssignment(null)}
              disabled={deletingAssignmentId === confirmDeleteAssignment.id}
              className="px-4 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
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
                    <div className="flex items-center justify-center gap-2">
                      <span>{a.name}</span>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteAssignment(a)}
                        disabled={deletingAssignmentId === a.id}
                        className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-red-200 text-red-500 text-xs leading-none hover:bg-red-50 disabled:opacity-50"
                        title={`Delete ${a.name}`}
                        aria-label={`Delete ${a.name}`}
                      >
                        {deletingAssignmentId === a.id ? '…' : '×'}
                      </button>
                    </div>
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
                    <div className="font-medium text-gray-900">{student.name_eng || '—'}</div>
                    <div className="text-sm text-gray-500">{student.name_vn || '—'}</div>
                    <div className="text-xs text-gray-400">{student.student_id || '—'}</div>
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
                            {openCommentKey === key ? (
                              <div className="w-full space-y-1">
                                <input
                                  type="text"
                                  placeholder="Type comment"
                                  value={draftComment}
                                  onChange={e => setDraftComment(e.target.value)}
                                  className="w-full border border-gray-200 bg-gray-50 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => saveComment(assignment.id, student.id)}
                                    className="text-[10px] px-2 py-0.5 rounded bg-green-600 text-white hover:bg-green-700"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenCommentKey(null)
                                      setDraftComment('')
                                    }}
                                    className="text-[10px] text-gray-400 hover:text-gray-600"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openCommentEditor(key)}
                                className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                  g.comment
                                    ? 'border-blue-200 bg-blue-50 text-blue-600'
                                    : 'border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                                }`}
                              >
                                {g.comment ? 'Edit Comment' : 'Add Comment'}
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <input type="number" min="0" max={assignment.max_points} placeholder="—"
                              value={g.score ?? ''}
                              onChange={e => setGrade(assignment.id, student.id, 'score', e.target.value)}
                              className="w-16 text-center border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            <button onClick={() => setGrade(assignment.id, student.id, 'is_absent', true)} className="text-xs text-gray-400 hover:text-orange-500">A (absent)</button>
                            {openCommentKey === key ? (
                              <div className="w-full space-y-1">
                                <input
                                  type="text"
                                  placeholder="Type comment"
                                  value={draftComment}
                                  onChange={e => setDraftComment(e.target.value)}
                                  className="w-full border border-gray-200 bg-gray-50 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => saveComment(assignment.id, student.id)}
                                    className="text-[10px] px-2 py-0.5 rounded bg-green-600 text-white hover:bg-green-700"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenCommentKey(null)
                                      setDraftComment('')
                                    }}
                                    className="text-[10px] text-gray-400 hover:text-gray-600"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openCommentEditor(key)}
                                className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                  g.comment
                                    ? 'border-blue-200 bg-blue-50 text-blue-600'
                                    : 'border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                                }`}
                              >
                                {g.comment ? 'Edit Comment' : 'Add Comment'}
                              </button>
                            )}
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
  const [openCommentStudentId, setOpenCommentStudentId] = useState(null)
  const [draftComment, setDraftComment] = useState('')

  useEffect(() => { fetchGrades() }, [classId, term])
  useEffect(() => { onDirtyChange?.(false) }, [classId, term, isESL])

  const fetchGrades = async () => {
    const { data } = await supabase.from('progress_test_grades').select('*').eq('class_id', classId).eq('term', term)
    const map = {}
    data?.forEach(g => {
      map[g.student_id] = isESL
        ? { rw: g.reading_writing_score, l: g.listening_score, s: g.speaking_score, comment: g.comment }
        : { score: g.score, comment: g.comment }
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

  const openCommentEditor = (studentId) => {
    setOpenCommentStudentId(studentId)
    setDraftComment(grades[studentId]?.comment ?? '')
  }

  const saveComment = (studentId) => {
    setGrade(studentId, 'comment', draftComment)
    setOpenCommentStudentId(null)
    setDraftComment('')
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
          overall_percentage: overall,
          comment: g.comment ? g.comment.trim() : null,
        }
      } else {
        return {
          class_id: classId, student_id: student.id, term,
          score: g.score != null && g.score !== '' ? parseFloat(g.score) : null,
          total_points: totals.total_points ? parseFloat(totals.total_points) : null,
          overall_percentage: overall,
          comment: g.comment ? g.comment.trim() : null,
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
        <button onClick={saveAll} disabled={saving} className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300">
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
                    <div className="font-medium text-gray-900">{student.name_eng || '—'}</div>
                    <div className="text-sm text-gray-500">{student.name_vn || '—'}</div>
                    <div className="text-xs text-gray-400">{student.student_id || '—'}</div>
                  </td>
                  {isESL ? (
                    <>
                      <td className="px-3 py-2 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <input type="number" min="0" max={totals.rw_total || undefined} placeholder="—"
                            value={g.rw ?? ''}
                            onChange={e => setGrade(student.id, 'rw', e.target.value)}
                            className="w-20 text-center border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          {openCommentStudentId === student.id ? (
                            <div className="w-full space-y-1">
                              <input
                                type="text"
                                placeholder="Type comment"
                                value={draftComment}
                                onChange={e => setDraftComment(e.target.value)}
                                className="w-full border border-gray-200 bg-gray-50 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => saveComment(student.id)}
                                  className="text-[10px] px-2 py-0.5 rounded bg-green-600 text-white hover:bg-green-700"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenCommentStudentId(null)
                                    setDraftComment('')
                                  }}
                                  className="text-[10px] text-gray-400 hover:text-gray-600"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openCommentEditor(student.id)}
                              className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                g.comment
                                  ? 'border-blue-200 bg-blue-50 text-blue-600'
                                  : 'border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              {g.comment ? 'Edit Comment' : 'Add Comment'}
                            </button>
                          )}
                        </div>
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
                      <div className="flex flex-col items-center gap-1">
                        <input type="number" min="0" max={totals.total_points || undefined} placeholder="—"
                          value={g.score ?? ''}
                          onChange={e => setGrade(student.id, 'score', e.target.value)}
                          className="w-20 text-center border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        {openCommentStudentId === student.id ? (
                          <div className="w-full space-y-1">
                            <input
                              type="text"
                              placeholder="Type comment"
                              value={draftComment}
                              onChange={e => setDraftComment(e.target.value)}
                              className="w-full border border-gray-200 bg-gray-50 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => saveComment(student.id)}
                                className="text-[10px] px-2 py-0.5 rounded bg-green-600 text-white hover:bg-green-700"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenCommentStudentId(null)
                                  setDraftComment('')
                                }}
                                className="text-[10px] text-gray-400 hover:text-gray-600"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openCommentEditor(student.id)}
                            className={`text-[10px] px-1.5 py-0.5 rounded border ${
                              g.comment
                                ? 'border-blue-200 bg-blue-50 text-blue-600'
                                : 'border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            {g.comment ? 'Edit Comment' : 'Add Comment'}
                          </button>
                        )}
                      </div>
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

// ── Student Attributes Tab ────────────────────────────────────────────────────
function StudentAttributesTab({ classId, term, students, onDirtyChange }) {
  const [attributes, setAttributes] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const ATTRIBUTE_FIELDS = [
    { key: 'confident', label: 'Confident' },
    { key: 'responsible', label: 'Responsible' },
    { key: 'reflective', label: 'Reflective' },
    { key: 'innovative', label: 'Innovative' },
    { key: 'engaged', label: 'Engaged' },
  ]

  const OPTIONS = [
    { value: '', label: '—' },
    { value: 'G', label: 'G - Good' },
    { value: 'S', label: 'S - Satisfactory' },
    { value: 'N', label: 'N - Needs Improvement' },
  ]

  useEffect(() => { fetchAttributes() }, [classId, term])
  useEffect(() => { onDirtyChange?.(false) }, [classId, term])

  const fetchAttributes = async () => {
    const { data } = await supabase
      .from('student_attributes')
      .select('*')
      .eq('class_id', classId)
      .eq('term', term)

    const map = {}
    data?.forEach((row) => {
      map[row.student_id] = {
        confident: row.confident || '',
        responsible: row.responsible || '',
        reflective: row.reflective || '',
        innovative: row.innovative || '',
        engaged: row.engaged || '',
      }
    })
    setAttributes(map)
  }

  const setAttribute = (studentId, field, value) => {
    onDirtyChange?.(true)
    setAttributes(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value },
    }))
  }

  const saveAll = async () => {
    setSaving(true)
    const rows = students.map((student) => {
      const values = attributes[student.id] || {}
      return {
        class_id: classId,
        student_id: student.id,
        term,
        confident: values.confident || null,
        responsible: values.responsible || null,
        reflective: values.reflective || null,
        innovative: values.innovative || null,
        engaged: values.engaged || null,
      }
    })

    await supabase
      .from('student_attributes')
      .upsert(rows, { onConflict: 'class_id,student_id,term' })

    setSaving(false)
    setSaved(true)
    onDirtyChange?.(false)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">Set G/S/N for each student attribute criterion.</p>
        <button
          onClick={saveAll}
          disabled={saving}
          className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300"
        >
          {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save'}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-gray-500 font-medium sticky left-0 bg-gray-50 min-w-48">Student</th>
              {ATTRIBUTE_FIELDS.map(field => (
                <th key={field.key} className="text-center px-3 py-3 text-gray-500 font-medium min-w-44 border-l border-gray-100">
                  {field.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {students.map((student) => {
              const row = attributes[student.id] || {}
              return (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 sticky left-0 bg-white">
                    <div className="font-medium text-gray-900">{student.name_eng || '—'}</div>
                    <div className="text-sm text-gray-500">{student.name_vn || '—'}</div>
                    <div className="text-xs text-gray-400">{student.student_id || '—'}</div>
                  </td>
                  {ATTRIBUTE_FIELDS.map(field => (
                    <td key={field.key} className="px-3 py-2 text-center border-l border-gray-100">
                      <select
                        value={row[field.key] ?? ''}
                        onChange={e => setAttribute(student.id, field.key, e.target.value)}
                        className="w-40 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        {OPTIONS.map(option => (
                          <option key={`${field.key}_${option.value || 'empty'}`} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  ))}
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
                      <div className="font-medium text-gray-900">{student.name_eng || '—'}</div>
                      <div className="text-sm text-gray-500">{student.name_vn || '—'}</div>
                      <div className="text-xs text-gray-400">{student.student_id || '—'}</div>
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
        <button onClick={saveAll} disabled={saving} className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300">
          {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save'}
        </button>
      </div>
      <div className="space-y-4">
        {students.map(student => (
          <div key={student.id} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="mb-2">
              <div className="font-medium text-gray-900">{student.name_eng || '—'}</div>
              <div className="text-sm text-gray-500">{student.name_vn || '—'}</div>
              <div className="text-xs text-gray-400">{student.student_id || '—'}</div>
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