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

export default function StudentClassDetail() {
  const navigate = useNavigate()
  const { classId } = useParams()
  const [searchParams] = useSearchParams()
  const { profile } = useAuth()

  const [cls, setCls] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTerm, setActiveTerm] = useState(searchParams.get('term') || 'midterm_1')
  const [showFormulaHelp, setShowFormulaHelp] = useState(false)
  const [participationRows, setParticipationRows] = useState([])
  const [assignmentRows, setAssignmentRows] = useState([])
  const [progressRows, setProgressRows] = useState([])
  const [accessDenied, setAccessDenied] = useState(false)
  const [classAnnouncements, setClassAnnouncements] = useState([])
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null)

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
      supabase.from('participation_grades').select('term, week, score').eq('class_id', classId).eq('student_id', resolvedStudentId),
      supabase.from('progress_test_grades').select('*').eq('class_id', classId).eq('student_id', resolvedStudentId),
      supabase.from('assignments').select('*').eq('class_id', classId).order('created_at'),
      supabase.from('assignment_grades').select('*').eq('student_id', resolvedStudentId),
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
      ? (ptOverall * 0.60) + (attainment * 0.40)
      : ptOverall != null ? ptOverall * 0.60
      : attainment

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
          <button onClick={() => navigate('/dashboard')} className="text-sm text-gray-400 hover:text-gray-600 mb-4 flex items-center gap-1">
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
        <button onClick={() => navigate('/dashboard')} className="text-sm text-gray-400 hover:text-gray-600 mb-4 flex items-center gap-1">
          ← Go Back
        </button>
        <h2 className="text-2xl font-bold text-gray-900">{cls?.name}</h2>
        <p className="text-gray-500 text-sm mt-1">
          {cls?.level === 'primary' ? 'Primary' : 'Secondary'} · {cls?.programme === 'bilingual' ? 'Bilingual' : 'Integrated'} · Teacher: {cls?.users?.full_name || 'TBA'}
        </p>
      </div>

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

      <div className="bg-white rounded-xl border border-gray-200 p-5" style={{ borderTopColor: '#1f86c7', borderTopWidth: 3 }}>
        <h3 className="font-semibold text-gray-900 mb-3">Overall Calculation</h3>

        {/* Row 1: overall bar */}
        <div className="rounded-lg border p-3" style={{ borderColor: '#1f86c7', backgroundColor: '#1f86c71A' }}>
          <div className="flex items-center justify-between">
            <div className="text-gray-500 text-xs">Overall</div>
            <div className="font-semibold text-gray-900 inline-flex items-center gap-2">
              <span>{fmt(termData.total)}{termData.total != null ? '%' : ''}</span>
              <button
                type="button"
                onClick={() => setShowFormulaHelp(true)}
                className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-semibold border border-blue-300 text-blue-700 bg-white hover:bg-blue-50"
                aria-label="Show calculation guide"
                title="How is this calculated?"
              >
                ?
              </button>
            </div>
          </div>
          <div className="mt-2 h-2 rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(0, Math.min(100, termData.total || 0))}%`, backgroundColor: '#1f86c7' }}
            />
          </div>
        </div>

        {/* Row 2: individual attainment/progress bars */}
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border p-3" style={{ borderColor: '#d1232a', backgroundColor: '#d1232a1A' }}>
            <div className="text-gray-500 text-xs">Attainment</div>
            <div className="font-semibold text-gray-900">{fmt(attainmentScore)}{attainmentScore != null ? '%' : ''}</div>
            <div className="mt-2 h-2 rounded-full bg-gray-200 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(0, Math.min(100, attainmentScore || 0))}%`, backgroundColor: '#d1232a' }}
              />
            </div>
          </div>
          <div className="rounded-lg border p-3" style={{ borderColor: '#ffc612', backgroundColor: '#ffc6121A' }}>
            <div className="text-gray-500 text-xs">Progress</div>
            <div className="font-semibold text-gray-900">{fmt(termData.ptOverall)}{termData.ptOverall != null ? '%' : ''}</div>
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
                <div key={`${row.term}_${row.week}`} className="flex items-center justify-between border-b border-gray-100 pb-1">
                  <span className="text-gray-600">Week {row.week}</span>
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
                <div key={row.id} className="border-b border-gray-100 pb-1">
                  <div className="text-gray-700">{row.name}</div>
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
              <div>2) <strong>Overall Term Score</strong> = (Progress Test x 60%) + (Attainment x 40%)</div>
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
