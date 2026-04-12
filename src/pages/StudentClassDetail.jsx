import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const TERMS = [
  { key: 'midterm_1', label: 'Midterm 1' },
  { key: 'final_1', label: 'Final 1' },
  { key: 'midterm_2', label: 'Midterm 2' },
  { key: 'final_2', label: 'Final 2' },
]

const letterGradeFromPercentage = (score) => {
  if (score == null) return '—'
  if (score >= 90.5) return 'A*'
  if (score >= 79.5) return 'A'
  if (score >= 64.5) return 'B'
  if (score >= 49.5) return 'C'
  if (score >= 34.5) return 'D'
  return 'E'
}

const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null
const fmt = (n) => n != null ? n.toFixed(1) : '—'

// School official week calendar - imported from Layout.jsx
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

// Flatten all weeks into single array
const ALL_WEEKS = [
  ...PARTICIPATION_WEEK_SCHEDULE.midterm_1,
  ...PARTICIPATION_WEEK_SCHEDULE.final_1,
  ...PARTICIPATION_WEEK_SCHEDULE.midterm_2,
  ...PARTICIPATION_WEEK_SCHEDULE.final_2,
]

// Calculate current week based on date - default to Week 0 for pre launch
const getCurrentWeekIndex = () => {
  // Check for debug override
  const override = sessionStorage.getItem('debug_week_override')
  if (override !== null) {
    const idx = Number(override)
    if (idx >= 0 && idx < ALL_WEEKS.length) return idx
  }

  const today = new Date()
  // Default to Week 0 for all dates before August 2026
  if (today < new Date('2026-08-17')) return 0

  // TODO: Implement actual date mapping
  return 0
}

// Get active term based on current week index
const getCurrentTerm = () => {
  const weekIndex = getCurrentWeekIndex()
  if (weekIndex < 8) return 'midterm_1'
  if (weekIndex < 16) return 'final_1'
  if (weekIndex < 28) return 'midterm_2'
  return 'final_2'
}

export default function StudentClassDetail() {
  const navigate = useNavigate()
  const { classId } = useParams()
  const [searchParams] = useSearchParams()
  const { profile } = useAuth()

  const [cls, setCls] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTerm, setActiveTerm] = useState(searchParams.get('term') || getCurrentTerm())
  const [activeTab, setActiveTab] = useState('gradebooks')
  const [showFormulaHelp, setShowFormulaHelp] = useState(false)
  const [participationRows, setParticipationRows] = useState([])
  const [assignmentRows, setAssignmentRows] = useState([])
  const [progressRows, setProgressRows] = useState([])
  const [accessDenied, setAccessDenied] = useState(false)
  const [classAnnouncements, setClassAnnouncements] = useState([])
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null)
  const [selectedComment, setSelectedComment] = useState(null)

  useEffect(() => {
    fetchData()
  }, [classId, profile?.student_id_ref])

  useEffect(() => {
    const termFromQuery = searchParams.get('term')
    if (termFromQuery && TERMS.some((t) => t.key === termFromQuery)) {
      setActiveTerm(termFromQuery)
    }
  }, [searchParams])

  const fetchData = async () => {
    setLoading(true)
    let resolvedStudentId = profile?.student_id_ref || null
    if (!resolvedStudentId && profile?.staff_id) {
      const { data: studentRow } = await supabase
        .from('students')
        .select('id')
        .ilike('student_id', profile.staff_id)
        .maybeSingle()
      resolvedStudentId = studentRow?.id || null
    }

    if (!resolvedStudentId) {
      setAccessDenied(true)
      setLoading(false)
      return
    }

    const { data: enrolledRow } = await supabase
      .from('class_students')
      .select('class_id')
      .eq('class_id', classId)
      .eq('student_id', resolvedStudentId)
      .maybeSingle()

    if (!enrolledRow) {
      setAccessDenied(true)
      setLoading(false)
      return
    }

    const [{ data: classData }, { data: partData }, { data: ptData }, { data: assignData }, { data: assignGrades }, { data: announcementTargetRows }] = await Promise.all([
      supabase.from('classes').select('*, users(full_name)').eq('id', classId).single(),
      supabase.from('participation_grades').select('term, week, score, comment').eq('class_id', classId).eq('student_id', resolvedStudentId),
      supabase.from('progress_test_grades').select('*').eq('class_id', classId).eq('student_id', resolvedStudentId),
      supabase.from('assignments').select('*').eq('class_id', classId).order('created_at'),
      supabase.from('assignment_grades').select('*, comment').eq('student_id', resolvedStudentId),
      supabase
        .from('teacher_announcement_targets')
        .select('announcement_id, teacher_announcements(id, title, message, created_at)')
        .eq('class_id', classId),
    ])

    const assignmentMap = Object.fromEntries((assignData || []).map((a) => [a.id, a]))
    const markedAssignments = (assignGrades || [])
      .map((g) => {
        const a = assignmentMap[g.assignment_id]
        if (!a) return null
        if (g.score == null || a.max_points == null || Number(a.max_points) <= 0) return null
        return {
          id: `${a.id}_${g.id}`,
          term: a.term,
          name: a.name,
          score: g.score,
          max_points: a.max_points,
          percent: (Number(g.score) / Number(a.max_points)) * 100,
          comment: g.comment,
        }
      })
      .filter(Boolean)

    setCls(classData || null)
    setParticipationRows(partData || [])
    setProgressRows(ptData || [])
    setAssignmentRows(markedAssignments)
    const announcementRows = (announcementTargetRows || [])
      .map((row) => row.teacher_announcements)
      .filter(Boolean)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 8)
    setClassAnnouncements(announcementRows)
    setAccessDenied(false)
    setLoading(false)
  }

  const termData = useMemo(() => {
    const part = participationRows
      .filter((r) => r.term === activeTerm && r.score != null)
      .map((r) => Number(r.score))
    const partPct = part.length ? avg(part) * 10 : null

    const assignPcts = assignmentRows
      .filter((a) => a.term === activeTerm)
      .map((a) => a.percent)
    const assignAvg = avg(assignPcts)

    const attainment = partPct != null && assignAvg != null
      ? (partPct * 0.20) + (assignAvg * 0.80)
      : partPct != null ? partPct * 0.20
      : assignAvg != null ? assignAvg * 0.80
      : null

    const pt = progressRows.find((r) => r.term === activeTerm) || null
    const ptOverall = pt?.overall_percentage ?? null

    const total = ptOverall != null && attainment != null
      ? (attainment * 0.75) + (ptOverall * 0.25)
      : attainment != null ? attainment * 0.75
      : ptOverall != null ? ptOverall * 0.25
      : null

    const letterGrade = letterGradeFromPercentage(total)

        return {
          participation: participationRows
            .filter((r) => r.term === activeTerm && r.score != null)
            .sort((a, b) => Number(a.week) - Number(b.week)),
          assignments: assignmentRows.filter((a) => a.term === activeTerm),
          progress: pt,
          partPct,
          assignAvg,
          ptOverall,
          total,
          letterGrade,
    }
  }, [activeTerm, participationRows, assignmentRows, progressRows])

  if (loading) return <Layout><div className="text-center text-gray-400 py-20">Loading...</div></Layout>

  const attainmentScore =
    termData.partPct != null && termData.assignAvg != null
      ? (termData.partPct * 0.20) + (termData.assignAvg * 0.80)
      : termData.partPct != null
        ? termData.partPct * 0.20
        : termData.assignAvg != null
          ? termData.assignAvg * 0.80
          : null

  if (accessDenied) {
    return (
      <Layout>
        <div className="mb-8">
          <button onClick={() => navigate('/dashboard')} className="text-sm text-white px-3 py-1.5 rounded-lg mb-4 flex items-center gap-1 transition-colors"
            style={{ backgroundColor: '#1f86c7' }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#1a74ad'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#1f86c7'}>
            ← Go Back
          </button>
          <h2 className="text-2xl font-bold text-gray-900">Class Access</h2>
          <p className="text-gray-500 text-sm mt-1">You do not have access to this class.</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="mb-8">
        <button onClick={() => navigate('/dashboard')} className="text-sm text-white px-3 py-1.5 rounded-lg mb-4 flex items-center gap-1 transition-colors"
          style={{ backgroundColor: '#1f86c7' }}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#1a74ad'}
          onMouseLeave={(e) => e.target.style.backgroundColor = '#1f86c7'}>
          ← Go Back
        </button>
        <h2 className="text-2xl font-bold text-gray-900">{cls?.name}</h2>
        <p className="text-gray-500 text-sm mt-1">
          {cls?.level === 'primary' ? 'Primary' : 'Secondary'} - {cls?.programme === 'bilingual' ? 'Bilingual' : 'Integrated'}
        </p>
        <p className="text-gray-500 text-sm mt-1">
          Teacher: {cls?.users?.full_name || 'TBA'}
        </p>
      </div>

      {/* Term Selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="flex flex-wrap gap-2">
          {TERMS.map((term) => (
            <button
              key={term.key}
              onClick={() => setActiveTerm(term.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                activeTerm === term.key ? 'text-white' : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
              }`}
              style={activeTerm === term.key ? { backgroundColor: '#1f86c7' } : {}}
            >
              {term.label}
            </button>
          ))}
        </div>
      </div>

      {/* Page Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('materials')}
          className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'materials'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Learning Materials
        </button>
        <button
          onClick={() => setActiveTab('gradebooks')}
          className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'gradebooks'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Gradebooks
        </button>
        <button
          onClick={() => setActiveTab('announcements')}
          className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'announcements'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Announcements
        </button>
      </div>

      {activeTab === 'gradebooks' && (
        <>

          <div className="bg-white rounded-xl border border-gray-200 p-5" style={{ borderTopColor: '#1f86c7', borderTopWidth: 3 }}>
        <h3 className="font-semibold text-gray-900 mb-3">Overall Calculation</h3>

        <div className="grid grid-cols-[88px_1fr_1fr_1fr] gap-3">
          {/* Letter Grade */}
          <div className="rounded-lg border flex items-center justify-center aspect-square" style={
            termData.letterGrade === 'A*' || termData.letterGrade === 'A' ? { borderColor: '#22c55e', backgroundColor: '#22c55e1A' }
            : termData.letterGrade === 'B' ? { borderColor: '#3b82f6', backgroundColor: '#3b82f61A' }
            : termData.letterGrade === 'C' ? { borderColor: '#f59e0b', backgroundColor: '#f59e0b1A' }
            : { borderColor: '#ef4444', backgroundColor: '#ef44441A' }
          }>
            <div className="text-4xl font-bold" style={
              termData.letterGrade === 'A*' || termData.letterGrade === 'A' ? { color: '#22c55e' }
              : termData.letterGrade === 'B' ? { color: '#3b82f6' }
              : termData.letterGrade === 'C' ? { color: '#f59e0b' }
              : { color: '#ef4444' }
            }>
              {termData.letterGrade || '—'}
            </div>
          </div>

          {/* Overall */}
          <div className="rounded-lg border p-3" style={{ borderColor: '#1f86c7', backgroundColor: '#1f86c71A' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-gray-500 text-xs">Overall</div>
              <button
                type="button"
                onClick={() => setShowFormulaHelp(true)}
                className="inline-flex items-center justify-center w-4 h-4 rounded-full text-xs font-semibold border border-blue-300 text-blue-700 bg-white hover:bg-blue-50"
                aria-label="Show calculation guide"
                title="How is this calculated?"
              >
                ?
              </button>
            </div>
            <div className="font-semibold text-gray-900 text-xl">{fmt(termData.total)}{termData.total != null ? '%' : ''}</div>
            <div className="mt-2 h-2 rounded-full bg-gray-200 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(0, Math.min(100, termData.total || 0))}%`, backgroundColor: '#1f86c7' }}
              />
            </div>
          </div>

          {/* Attainment */}
          <div className="rounded-lg border p-3" style={{ borderColor: '#d1232a', backgroundColor: '#d1232a1A' }}>
            <div className="text-gray-500 text-xs mb-2">Attainment</div>
            <div className="font-semibold text-gray-900 text-xl">{fmt(attainmentScore)}{attainmentScore != null ? '%' : ''}</div>
            <div className="mt-2 h-2 rounded-full bg-gray-200 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(0, Math.min(100, attainmentScore || 0))}%`, backgroundColor: '#d1232a' }}
              />
            </div>
          </div>

          {/* Progress */}
          <div className="rounded-lg border p-3" style={{ borderColor: '#ffc612', backgroundColor: '#ffc6121A' }}>
            <div className="text-gray-500 text-xs mb-2">Progress</div>
            <div className="font-semibold text-gray-900 text-xl">{fmt(termData.ptOverall)}{termData.ptOverall != null ? '%' : ''}</div>
            <div className="mt-2 h-2 rounded-full bg-gray-200 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(0, Math.min(100, termData.ptOverall || 0))}%`, backgroundColor: '#ffc612' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: detail cards, three across */}
      <div className="mt-6 grid grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5" style={{ borderTopColor: '#d1232a', borderTopWidth: 3 }}>
          <h3 className="font-semibold text-gray-900 mb-3">Participation</h3>
          {termData.participation.length === 0 ? (
            <p className="text-sm text-gray-400">No participation scores posted yet.</p>
          ) : (
            <div className="space-y-2 text-sm">
              {termData.participation.map((row) => (
                <div key={`${row.term}_${row.week}`} className="flex items-center justify-between border-b border-gray-100 pb-1 cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1 rounded" onClick={() => row.comment && setSelectedComment(row.comment)}>
                  <span className="text-gray-600 flex items-center gap-2">
                    Week {row.week}
                    {row.comment && <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-blue-500 text-white text-[8px]">💬</span>}
                  </span>
                  <span className="font-medium text-gray-900">{row.score}/10</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5" style={{ borderTopColor: '#d1232a', borderTopWidth: 3 }}>
          <h3 className="font-semibold text-gray-900 mb-3">Marked Assignments</h3>
          {termData.assignments.length === 0 ? (
            <p className="text-sm text-gray-400">No marked assignments yet.</p>
          ) : (
            <div className="space-y-2 text-sm">
              {termData.assignments.map((row) => (
                <div key={row.id} className="border-b border-gray-100 pb-1 cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1 rounded" onClick={() => row.comment && setSelectedComment(row.comment)}>
                  <div className="text-gray-700 flex items-center gap-2">
                    {row.name}
                    {row.comment && <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-blue-500 text-white text-[8px]">💬</span>}
                  </div>
                  <div className="text-xs text-gray-500">
                    {row.score}/{row.max_points} ({fmt(row.percent)}%)
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5" style={{ borderTopColor: '#ffc612', borderTopWidth: 3 }}>
          <h3 className="font-semibold text-gray-900 mb-3">Progress Test</h3>
          {!termData.progress || termData.ptOverall == null ? (
            <p className="text-sm text-gray-400">No progress test score posted yet.</p>
          ) : cls?.subject === 'ESL' ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between border-b border-gray-100 pb-1">
                <span className="text-gray-600">Reading & Writing</span>
                <span className="font-medium text-gray-900">
                  {termData.progress?.reading_writing_score ?? '—'}
                  {termData.progress?.reading_writing_total ? ` / ${termData.progress.reading_writing_total}` : ''}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-gray-100 pb-1">
                <span className="text-gray-600">Listening</span>
                <span className="font-medium text-gray-900">
                  {termData.progress?.listening_score ?? '—'}
                  {termData.progress?.listening_total ? ` / ${termData.progress.listening_total}` : ''}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-gray-100 pb-1">
                <span className="text-gray-600">Speaking</span>
                <span className="font-medium text-gray-900">
                  {termData.progress?.speaking_score ?? '—'}
                  {termData.progress?.speaking_total ? ` / ${termData.progress.speaking_total}` : ''}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Overall</span>
                <span className="font-medium text-gray-900">{fmt(termData.ptOverall)}%</span>
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Overall</span>
                <span className="font-medium text-gray-900">{fmt(termData.ptOverall)}%</span>
              </div>
            </div>
          )}
        </div>
          </div>
        </>
      )}

      {activeTab === 'announcements' && (
        <div className="mt-6 bg-white rounded-xl border border-gray-200 p-5" style={{ borderTopColor: '#22c55e', borderTopWidth: 3 }}>
        <h3 className="font-semibold text-gray-900 mb-3">Class Announcements</h3>
        <div className="space-y-2">
          {classAnnouncements.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
              No class announcements yet.
            </div>
          ) : classAnnouncements.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedAnnouncement(item)}
              className="w-full text-left rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 hover:bg-green-50 transition-colors"
            >
              <div className="text-sm font-medium text-gray-800">{item.title}</div>
              <div className="text-xs text-gray-500 mt-0.5">{new Date(item.created_at).toLocaleDateString('en-GB')}</div>
            </button>
          ))}
         </div>
       </div>
      )}

      {selectedComment && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
          <div className="w-full max-w-md bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="text-base font-semibold text-gray-900">Teacher Comment</h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedComment(null)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close comment"
              >
                ✕
              </button>
            </div>
            <div className="mt-4">
              <div className="text-sm text-gray-800 whitespace-pre-wrap">{selectedComment}</div>
            </div>
          </div>
        </div>
      )}

      {selectedAnnouncement && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
          <div className="w-full max-w-md bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="text-base font-semibold text-gray-900">{selectedAnnouncement.title}</h4>
                <p className="text-xs text-gray-500 mt-1">
                  Teacher Announcement • {new Date(selectedAnnouncement.created_at).toLocaleDateString('en-GB')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAnnouncement(null)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close announcement"
              >
                ✕
              </button>
            </div>
            <div className="mt-4">
              <div className="text-xs font-medium text-gray-500">Message</div>
              <div className="text-sm text-gray-800 whitespace-pre-wrap mt-1">{selectedAnnouncement.message}</div>
            </div>
          </div>
        </div>
      )}

      {showFormulaHelp && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
          <div className="w-full max-w-md bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="text-base font-semibold text-gray-900">How this is calculated</h4>
                <p className="text-xs text-gray-500 mt-1">For the selected term</p>
              </div>
              <button
                type="button"
                onClick={() => setShowFormulaHelp(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close guide"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-2 text-sm text-gray-700">
              <div>1) <strong>Attainment</strong> = (Participation Avg x 20%) + (Assignments Avg x 80%)</div>
              <div>2) <strong>Overall Term Score</strong> = (Attainment x 75%) + (Progress Test x 25%)</div>
              <div className="text-xs text-gray-500 pt-1">
                If one category has no score yet, available scored categories are used.
              </div>
            </div>
          </div>
        </div>
      )}

    </Layout>
  )
}
