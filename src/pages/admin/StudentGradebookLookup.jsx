import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { useNavigate } from 'react-router-dom'

const TERMS = [
  { key: 'midterm_1', label: 'Midterm 1' },
  { key: 'final_1', label: 'Final 1' },
  { key: 'midterm_2', label: 'Midterm 2' },
  { key: 'final_2', label: 'Final 2' },
]

const fmt = (n) => {
  if (n == null) return '—'
  if (typeof n === 'string') return n
  return n.toFixed(1)
}

const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null

const letterGradeFromPercentage = (score) => {
  if (score == null) return '—'
  if (score >= 90.5) return 'A*'
  if (score >= 79.5) return 'A'
  if (score >= 64.5) return 'B'
  if (score >= 49.5) return 'C'
  if (score >= 34.5) return 'D'
  return 'E'
}

const SUBJECT_ORDER = ['ESL', 'Mathematics', 'Science', 'Global Perspectives']

const sortClassesBySubject = (classes) => {
  return [...classes].sort((a, b) => {
    const subjectA = a.subject || ''
    const subjectB = b.subject || ''
    const indexA = SUBJECT_ORDER.indexOf(subjectA)
    const indexB = SUBJECT_ORDER.indexOf(subjectB)
    
    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB
    }
    if (indexA !== -1) return -1
    if (indexB !== -1) return 1
    return (a.name || '').localeCompare(b.name || '')
  })
}

export default function StudentGradebookLookup() {
  const navigate = useNavigate()
  const [studentId, setStudentId] = useState('')
  const [selectedTerm, setSelectedTerm] = useState('midterm_1')
  const [student, setStudent] = useState(null)
  const [classes, setClasses] = useState([])
  const [subjectGradeCache, setSubjectGradeCache] = useState({})
  const [loading, setLoading] = useState(false)
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedComment, setSelectedComment] = useState(null)
  const attributeNames = ['confident', 'responsible', 'reflective', 'innovative', 'engaged']

  // Helper to find current class
  const currentClass = classes.find(c => c.id === selectedSubject)
  const currentGrades = subjectGradeCache[selectedSubject] || {}

  // Auto-refresh grade data when term changes
  useEffect(() => {
    if (student) {
      handleSearch()
    }
  }, [selectedTerm])

  const handleSearch = async () => {
    if (!studentId.trim()) return
    
    setLoading(true)
    setStudent(null)
    setClasses([])
    setSubjectGradeCache({})
    setSelectedSubject('')

    try {
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('*')
        .ilike('student_id', studentId.trim())
        .maybeSingle()

      if (studentError || !studentData) {
        alert('Student not found')
        setLoading(false)
        return
      }

      setStudent(studentData)

      const { data: enrollments } = await supabase
        .from('class_students')
        .select('class_id, classes(*, users(full_name))')
        .eq('student_id', studentData.id)

      const studentClasses = enrollments?.map(e => e.classes).filter(Boolean) || []
      const sorted = sortClassesBySubject(studentClasses)
      setClasses(sorted)

      if (sorted.length === 0) {
        alert('Student has no enrolled classes')
        setLoading(false)
        return
      }

      const allSubjectPromises = sorted.map(async (subjectClass) => {
        const [
          { data: partData },
          { data: ptData },
          { data: assignData },
          { data: assignGrades },
          { data: attributesData }
        ] = await Promise.all([
          supabase.from('participation_grades').select('term, week, score, comment').eq('class_id', subjectClass.id).eq('term', selectedTerm).eq('student_id', studentData.id),
          supabase.from('progress_test_grades').select('*').eq('class_id', subjectClass.id).eq('term', selectedTerm).eq('student_id', studentData.id).maybeSingle(),
          supabase.from('assignments').select('*').eq('class_id', subjectClass.id).eq('term', selectedTerm).order('created_at'),
          supabase.from('assignment_grades').select('*, comment').eq('student_id', studentData.id),
          supabase.from('student_attributes').select('*').eq('class_id', subjectClass.id).eq('term', selectedTerm).eq('student_id', studentData.id).maybeSingle()
        ])

        // Process assignments
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
          .filter((a) => a.term === selectedTerm)

        // Calculate averages
        const part = partData
          .filter((r) => r.score != null)
          .map((r) => Number(r.score))
        const partPct = part.length ? avg(part) * 10 : null

        const assignPcts = markedAssignments
          .filter((a) => a.term === selectedTerm)
          .map((a) => a.percent)
        const assignAvg = avg(assignPcts)

        const attainment = partPct != null && assignAvg != null
          ? (partPct * 0.20) + (assignAvg * 0.80)
          : partPct != null ? partPct * 0.20
          : assignAvg != null ? assignAvg * 0.80
          : null

        let ptOverall = null
        if (ptData) {
          if (subjectClass.subject === 'ESL') {
            const components = []
            if (ptData.reading_writing_score != null && ptData.reading_writing_total > 0) {
              components.push((ptData.reading_writing_score / ptData.reading_writing_total) * 100)
            }
            if (ptData.listening_score != null && ptData.listening_total > 0) {
              components.push((ptData.listening_score / ptData.listening_total) * 100)
            }
            if (ptData.speaking_score != null && ptData.speaking_total > 0) {
              components.push((ptData.speaking_score / ptData.speaking_total) * 100)
            }
            if (components.length === 3) {
              ptOverall = avg(components)
            }
          } else {
            if (ptData.score != null && ptData.total_points > 0) {
              ptOverall = (ptData.score / ptData.total_points) * 100
            }
          }
        }

        let overall = null
        if (attainment != null && ptOverall != null) {
          overall = (attainment * 0.75) + (ptOverall * 0.25)
        } else if (attainment != null) {
          overall = attainment * 0.75
        } else if (ptOverall != null) {
          overall = ptOverall * 0.25
        }

        return {
          classId: subjectClass.id,
          grades: {
            participationScores: partData || [],
            assignments: markedAssignments,
            progressTest: ptData,
            
            partPct,
            assignAvg,
            attainment,
            progressTestOverall: ptOverall,
            overall,
            letterGrade: letterGradeFromPercentage(overall),
            attributes: attributesData || {}
          }
        }
      })

      const allSubjectResults = await Promise.all(allSubjectPromises)
      
      const cache = {}
      allSubjectResults.forEach(result => {
        cache[result.classId] = result.grades
      })

      setSubjectGradeCache(cache)

      if (sorted.length > 0) {
        setSelectedSubject(sorted[0].id)
      }

    } catch (error) {
      console.error('Search error:', error)
      alert('Error loading student data')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-white px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 text-sm"
            style={{ backgroundColor: '#1f86c7' }}
          >
            ← Go Back
          </button>
        </div>

        <h2 className="text-2xl font-bold text-gray-900">Student Gradebook Lookup</h2>
        <p className="text-gray-500 text-sm mt-1">
          Search by student ID to view all grades across all classes
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Student ID</label>
            <input
              type="text"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="Enter student ID"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Term</label>
            <select
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {TERMS.map(term => (
                <option key={term.key} value={term.key}>{term.label}</option>
              ))}
            </select>
          </div>
          <div>
            <button
              onClick={handleSearch}
              disabled={loading || !studentId.trim()}
              className="w-full text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
              style={{ backgroundColor: '#d1232a' }}
            >
              {loading ? 'Loading...' : 'Search'}
            </button>
          </div>
        </div>
      </div>

      {student && (
        <div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-gray-500">Name</div>
                <div className="font-medium text-gray-900">{student.name_eng} - {student.name_vn}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Student ID</div>
                <div className="font-medium text-gray-900">{student.student_id}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Class</div>
                <div className="font-medium text-gray-900">{student.class}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Enrolled Subjects</div>
                <div className="font-medium text-gray-900">{classes.length} subjects</div>
              </div>
            </div>
          </div>

          {classes.length > 0 && (
            <div>
              <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
                {classes.map(cls => (
                  <button
                    key={cls.id}
                    onClick={() => setSelectedSubject(cls.id)}
                    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                      selectedSubject === cls.id
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {cls.subject || cls.name}
                  </button>
                ))}
              </div>

              {currentClass && currentGrades && (
                <div>
                  <div className="bg-white rounded-xl border border-gray-200 p-5" style={{ borderTopColor: '#1f86c7', borderTopWidth: 3 }}>
                    <h3 className="font-semibold text-gray-900 mb-3">Overall Calculation</h3>
                    <div className="grid grid-cols-[88px_1fr_1fr_1fr] gap-3">
                      {/* Letter Grade */}
                      <div className="rounded-lg border flex items-center justify-center aspect-square" style={
                        currentGrades.letterGrade === 'A*' || currentGrades.letterGrade === 'A' ? { borderColor: '#22c55e', backgroundColor: '#22c55e1A' }
                        : currentGrades.letterGrade === 'B' ? { borderColor: '#3b82f6', backgroundColor: '#3b82f61A' }
                        : currentGrades.letterGrade === 'C' ? { borderColor: '#f59e0b', backgroundColor: '#f59e0b1A' }
                        : { borderColor: '#ef4444', backgroundColor: '#ef44441A' }
                      }>
                        <div className="text-4xl font-bold" style={
                          currentGrades.letterGrade === 'A*' || currentGrades.letterGrade === 'A' ? { color: '#22c55e' }
                          : currentGrades.letterGrade === 'B' ? { color: '#3b82f6' }
                          : currentGrades.letterGrade === 'C' ? { color: '#f59e0b' }
                          : { color: '#ef4444' }
                        }>
                          {currentGrades.letterGrade || '—'}
                        </div>
                      </div>

                      {/* Overall */}
                      <div className="rounded-lg border p-3" style={{ borderColor: '#1f86c7', backgroundColor: '#1f86c71A' }}>
                        <div className="text-gray-500 text-xs mb-2">Overall</div>
                        <div className="font-semibold text-gray-900 text-xl">{fmt(currentGrades.overall)}{currentGrades.overall != null ? '%' : ''}</div>
                        <div className="mt-2 h-2 rounded-full bg-gray-200 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${Math.max(0, Math.min(100, currentGrades.overall || 0))}%`, backgroundColor: '#1f86c7' }}
                          />
                        </div>
                      </div>

                      {/* Attainment */}
                      <div className="rounded-lg border p-3" style={{ borderColor: '#d1232a', backgroundColor: '#d1232a1A' }}>
                        <div className="text-gray-500 text-xs mb-2">Attainment</div>
                        <div className="font-semibold text-gray-900 text-xl">{fmt(currentGrades.attainment)}{currentGrades.attainment != null ? '%' : ''}</div>
                        <div className="mt-2 h-2 rounded-full bg-gray-200 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${Math.max(0, Math.min(100, currentGrades.attainment || 0))}%`, backgroundColor: '#d1232a' }}
                          />
                        </div>
                      </div>

                      {/* Progress Test */}
                      <div className="rounded-lg border p-3" style={{ borderColor: '#ffc612', backgroundColor: '#ffc6121A' }}>
                        <div className="text-gray-500 text-xs mb-2">Progress Test</div>
                        <div className="font-semibold text-gray-900 text-xl">{fmt(currentGrades.progressTestOverall)}{currentGrades.progressTestOverall != null ? '%' : ''}</div>
                        <div className="mt-2 h-2 rounded-full bg-gray-200 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${Math.max(0, Math.min(100, currentGrades.progressTestOverall || 0))}%`, backgroundColor: '#ffc612' }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Full Detail Cards - Exactly matching student view */}
                  <div className="mt-6 grid grid-cols-3 gap-6">
                    {/* Participation */}
                    <div className="bg-white rounded-xl border border-gray-200 p-5" style={{ borderTopColor: '#d1232a', borderTopWidth: 3 }}>
                      <h3 className="font-semibold text-gray-900 mb-3">Participation</h3>
                      {currentGrades.participationScores?.length === 0 ? (
                        <p className="text-sm text-gray-400">No participation scores posted yet.</p>
                      ) : (
                        <div className="space-y-2 text-sm">
                          {currentGrades.participationScores?.map((row) => (
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

                    {/* Marked Assignments */}
                    <div className="bg-white rounded-xl border border-gray-200 p-5" style={{ borderTopColor: '#d1232a', borderTopWidth: 3 }}>
                      <h3 className="font-semibold text-gray-900 mb-3">Marked Assignments</h3>
                      {currentGrades.assignments?.length === 0 ? (
                        <p className="text-sm text-gray-400">No marked assignments yet.</p>
                      ) : (
                        <div className="space-y-2 text-sm">
                          {currentGrades.assignments?.map((row) => (
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

                    {/* Progress Test */}
                    <div className="bg-white rounded-xl border border-gray-200 p-5" style={{ borderTopColor: '#ffc612', borderTopWidth: 3 }}>
                      <h3 className="font-semibold text-gray-900 mb-3">Progress Test</h3>
                      {!currentGrades.progressTest || currentGrades.progressTestOverall == null ? (
                        <p className="text-sm text-gray-400">No progress test score posted yet.</p>
                      ) : currentClass.subject === 'ESL' ? (
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center justify-between border-b border-gray-100 pb-1">
                            <span className="text-gray-600">Reading & Writing</span>
                            <span className="font-medium text-gray-900">
                              {currentGrades.progressTest?.reading_writing_score ?? '—'}
                              {currentGrades.progressTest?.reading_writing_total ? ` / ${currentGrades.progressTest.reading_writing_total}` : ''}
                            </span>
                          </div>
                          <div className="flex items-center justify-between border-b border-gray-100 pb-1">
                            <span className="text-gray-600">Listening</span>
                            <span className="font-medium text-gray-900">
                              {currentGrades.progressTest?.listening_score ?? '—'}
                              {currentGrades.progressTest?.listening_total ? ` / ${currentGrades.progressTest.listening_total}` : ''}
                            </span>
                          </div>
                          <div className="flex items-center justify-between border-b border-gray-100 pb-1">
                            <span className="text-gray-600">Speaking</span>
                            <span className="font-medium text-gray-900">
                              {currentGrades.progressTest?.speaking_score ?? '—'}
                              {currentGrades.progressTest?.speaking_total ? ` / ${currentGrades.progressTest.speaking_total}` : ''}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">Overall</span>
                            <span className="font-medium text-gray-900">{fmt(currentGrades.progressTestOverall)}%</span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">Overall</span>
                            <span className="font-medium text-gray-900">{fmt(currentGrades.progressTestOverall)}%</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Layout>

    {/* Comment Modal */}
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
  )
}
