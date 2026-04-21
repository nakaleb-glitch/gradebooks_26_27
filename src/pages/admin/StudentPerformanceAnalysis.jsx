import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout'
import { supabase } from '../../lib/supabase'

const fmt = (n) => {
  if (n == null) return '—'
  return Number(n).toFixed(1)
}

const avg = (values) => {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

const getGradeFromClassName = (className) => {
  const match = String(className || '').match(/\d+/)
  return match ? match[0] : null
}

const getProgressTestPercentage = (row) => {
  if (row?.overall_percentage != null) return Number(row.overall_percentage)

  if (row?.score != null && Number(row?.total_points) > 0) {
    return (Number(row.score) / Number(row.total_points)) * 100
  }

  const eslParts = []
  if (row?.reading_writing_score != null && Number(row?.reading_writing_total) > 0) {
    eslParts.push((Number(row.reading_writing_score) / Number(row.reading_writing_total)) * 100)
  }
  if (row?.listening_score != null && Number(row?.listening_total) > 0) {
    eslParts.push((Number(row.listening_score) / Number(row.listening_total)) * 100)
  }
  if (row?.speaking_score != null && Number(row?.speaking_total) > 0) {
    eslParts.push((Number(row.speaking_score) / Number(row.speaking_total)) * 100)
  }

  if (eslParts.length === 3) return avg(eslParts)
  return null
}

const buildStudentMetricMap = (studentIds, progressRows, classSubjectMap) => {
  const subjectBucketsByStudent = {}

  studentIds.forEach((studentId) => {
    subjectBucketsByStudent[studentId] = {}
  })

  progressRows.forEach((row) => {
    const pct = getProgressTestPercentage(row)
    if (pct == null) return

    const subject = classSubjectMap[row.class_id] || 'Unknown Subject'
    if (!subjectBucketsByStudent[row.student_id]) {
      subjectBucketsByStudent[row.student_id] = {}
    }
    if (!subjectBucketsByStudent[row.student_id][subject]) {
      subjectBucketsByStudent[row.student_id][subject] = []
    }
    subjectBucketsByStudent[row.student_id][subject].push(pct)
  })

  const metricMap = {}
  Object.entries(subjectBucketsByStudent).forEach(([studentId, subjectBuckets]) => {
    const subjectAverages = Object.entries(subjectBuckets).map(([subject, values]) => ({
      subject,
      average: avg(values),
      termCount: values.length,
    })).filter((row) => row.average != null)

    const overallAverageOfAverages = avg(subjectAverages.map((row) => row.average))

    metricMap[studentId] = {
      subjectAverages,
      overallAverageOfAverages,
    }
  })

  return metricMap
}

const buildRankingRows = (students, metricMap) => {
  const rows = students
    .map((student) => ({
      ...student,
      overallAverageOfAverages: metricMap[student.id]?.overallAverageOfAverages ?? null,
    }))
    .filter((row) => row.overallAverageOfAverages != null)
    .sort((a, b) => b.overallAverageOfAverages - a.overallAverageOfAverages)

  let lastScore = null
  let lastRank = 0
  rows.forEach((row, index) => {
    if (lastScore == null || row.overallAverageOfAverages !== lastScore) {
      lastRank = index + 1
      lastScore = row.overallAverageOfAverages
    }
    row.rank = lastRank
  })

  return rows
}

export default function StudentPerformanceAnalysis() {
  const navigate = useNavigate()
  const [studentIdInput, setStudentIdInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const handleSearch = async () => {
    const trimmedStudentId = studentIdInput.trim()
    if (!trimmedStudentId) return

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const { data: targetStudent, error: studentError } = await supabase
        .from('students')
        .select('id, student_id, name_eng, name_vn, class, programme')
        .ilike('student_id', trimmedStudentId)
        .maybeSingle()

      if (studentError || !targetStudent) {
        setError('Student not found.')
        setLoading(false)
        return
      }

      const targetGrade = getGradeFromClassName(targetStudent.class)
      if (!targetStudent.programme || !targetGrade) {
        setError('Student is missing programme or grade information.')
        setLoading(false)
        return
      }

      const { data: programmeStudents, error: programmeError } = await supabase
        .from('students')
        .select('id, student_id, name_eng, name_vn, class, programme')
        .eq('programme', targetStudent.programme)

      if (programmeError || !programmeStudents?.length) {
        setError('Unable to load programme students.')
        setLoading(false)
        return
      }

      const cohortStudents = programmeStudents.filter(
        (student) => getGradeFromClassName(student.class) === targetGrade
      )

      if (!cohortStudents.length) {
        setError('No students found in the same grade and programme.')
        setLoading(false)
        return
      }

      const programmeStudentIds = programmeStudents.map((student) => student.id)
      const cohortStudentIds = cohortStudents.map((student) => student.id)

      const { data: programmeEnrollments, error: enrollmentError } = await supabase
        .from('class_students')
        .select('student_id, class_id')
        .in('student_id', programmeStudentIds)

      if (enrollmentError || !programmeEnrollments) {
        setError('Unable to load student enrollments.')
        setLoading(false)
        return
      }

      const classIds = [...new Set(programmeEnrollments.map((row) => row.class_id))]
      if (!classIds.length) {
        setError('No classes found for the selected programme.')
        setLoading(false)
        return
      }

      const [{ data: classes, error: classError }, { data: programmeProgressRows, error: progressError }] = await Promise.all([
        supabase
          .from('classes')
          .select('id, subject, name')
          .in('id', classIds),
        supabase
          .from('progress_test_grades')
          .select('student_id, class_id, term, overall_percentage, score, total_points, reading_writing_score, reading_writing_total, listening_score, listening_total, speaking_score, speaking_total')
          .in('student_id', programmeStudentIds)
          .in('class_id', classIds),
      ])

      if (classError || !classes) {
        setError('Unable to load class metadata.')
        setLoading(false)
        return
      }
      if (progressError || !programmeProgressRows) {
        setError('Unable to load progress test data.')
        setLoading(false)
        return
      }

      const classSubjectMap = {}
      classes.forEach((cls) => {
        classSubjectMap[cls.id] = cls.subject || cls.name || 'Unknown Subject'
      })

      const cohortProgressRows = programmeProgressRows.filter((row) => cohortStudentIds.includes(row.student_id))

      const cohortMetricMap = buildStudentMetricMap(cohortStudentIds, cohortProgressRows, classSubjectMap)
      const programmeMetricMap = buildStudentMetricMap(programmeStudentIds, programmeProgressRows, classSubjectMap)

      const cohortRankingRows = buildRankingRows(cohortStudents, cohortMetricMap)
      const targetRanking = cohortRankingRows.find((row) => row.id === targetStudent.id)
      const targetMetrics = cohortMetricMap[targetStudent.id]

      if (!targetRanking || !targetMetrics?.subjectAverages?.length) {
        setError('No progress test data found for this student in the selected cohort.')
        setLoading(false)
        return
      }

      const cohortOverallValues = cohortRankingRows.map((row) => row.overallAverageOfAverages)
      const programmeOverallValues = Object.values(programmeMetricMap)
        .map((row) => row.overallAverageOfAverages)
        .filter((value) => value != null)

      const cohortAverage = avg(cohortOverallValues)
      const programmeBenchmarkAverage = avg(programmeOverallValues)
      const topRows = cohortRankingRows.slice(0, 10)

      setResult({
        targetStudent,
        targetGrade,
        targetMetrics,
        targetRanking,
        cohortSize: cohortRankingRows.length,
        cohortAverage,
        programmeBenchmarkAverage,
        topRows,
      })
    } catch (e) {
      console.error(e)
      setError('Failed to analyze student performance.')
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
        <h2 className="text-2xl font-bold text-gray-900">Student Performance Analysis</h2>
        <p className="text-gray-500 text-sm mt-1">
          Progress test analysis across all terms with cohort and programme benchmarking.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Student ID</label>
            <input
              type="text"
              value={studentIdInput}
              onChange={(e) => setStudentIdInput(e.target.value)}
              placeholder="Enter student ID"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <div>
            <button
              onClick={handleSearch}
              disabled={loading || !studentIdInput.trim()}
              className="w-full text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity text-sm font-medium disabled:opacity-50"
              style={{ backgroundColor: '#d1232a' }}
            >
              {loading ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>
        </div>
        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
      </div>

      {result && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-gray-500">Student</div>
                <div className="font-medium text-gray-900">
                  {result.targetStudent.name_eng || '—'} - {result.targetStudent.name_vn || '—'}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Student ID</div>
                <div className="font-medium text-gray-900">{result.targetStudent.student_id}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Grade</div>
                <div className="font-medium text-gray-900">{result.targetGrade}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Programme</div>
                <div className="font-medium text-gray-900">{result.targetStudent.programme}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5" style={{ borderTopColor: '#1f86c7', borderTopWidth: 3 }}>
              <div className="text-xs text-gray-500 mb-1">Student Overall</div>
              <div className="text-2xl font-bold text-gray-900">{fmt(result.targetRanking.overallAverageOfAverages)}%</div>
              <div className="text-xs text-gray-500 mt-1">Average of subject averages</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5" style={{ borderTopColor: '#d1232a', borderTopWidth: 3 }}>
              <div className="text-xs text-gray-500 mb-1">Cohort Ranking</div>
              <div className="text-2xl font-bold text-gray-900">#{result.targetRanking.rank}</div>
              <div className="text-xs text-gray-500 mt-1">Out of {result.cohortSize} students</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5" style={{ borderTopColor: '#ffc612', borderTopWidth: 3 }}>
              <div className="text-xs text-gray-500 mb-1">Cohort Average</div>
              <div className="text-2xl font-bold text-gray-900">{fmt(result.cohortAverage)}%</div>
              <div className="text-xs text-gray-500 mt-1">Same grade and programme</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5" style={{ borderTopColor: '#16a34a', borderTopWidth: 3 }}>
              <div className="text-xs text-gray-500 mb-1">Programme Benchmark</div>
              <div className="text-2xl font-bold text-gray-900">{fmt(result.programmeBenchmarkAverage)}%</div>
              <div className="text-xs text-gray-500 mt-1">All grades in programme</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900">Per-Subject Averages</h3>
                <p className="text-xs text-gray-500 mt-1">Progress test averages across all available terms per subject.</p>
              </div>
              <div className="divide-y divide-gray-100">
                {result.targetMetrics.subjectAverages
                  .slice()
                  .sort((a, b) => b.average - a.average)
                  .map((row) => (
                    <div key={row.subject} className="px-5 py-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{row.subject}</div>
                        <div className="text-xs text-gray-500">{row.termCount} term score(s)</div>
                      </div>
                      <div className="text-sm font-semibold text-gray-900">{fmt(row.average)}%</div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900">Top Cohort Ranking</h3>
                <p className="text-xs text-gray-500 mt-1">Top 10 students in the same grade and programme.</p>
              </div>
              <div className="divide-y divide-gray-100">
                {result.topRows.map((row) => (
                  <div key={row.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-900">#{row.rank} {row.name_eng || '—'}</div>
                      <div className="text-xs text-gray-500">{row.student_id || '—'}</div>
                    </div>
                    <div className="text-sm font-semibold text-gray-900">{fmt(row.overallAverageOfAverages)}%</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
