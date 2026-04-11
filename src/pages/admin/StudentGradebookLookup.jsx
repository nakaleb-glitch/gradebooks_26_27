import { useState } from 'react'
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
          { data: participationData },
          { data: assignmentData },
          { data: progressTestData },
          { data: attributesData }
        ] = await Promise.all([
          supabase.from('participation_grades').select('score').eq('class_id', subjectClass.id).eq('term', selectedTerm).eq('student_id', studentData.id).maybeSingle(),
          supabase.from('assignments').select('id, max_points').eq('class_id', subjectClass.id).eq('term', selectedTerm),
          supabase.from('progress_test_grades').select('*').eq('class_id', subjectClass.id).eq('term', selectedTerm).eq('student_id', studentData.id).maybeSingle(),
          supabase.from('student_attributes').select('*').eq('class_id', subjectClass.id).eq('term', selectedTerm).eq('student_id', studentData.id).maybeSingle()
        ])

        let assignmentGradesData = []
        if (assignmentData?.length > 0) {
          const assignmentIds = assignmentData.map(a => a.id)
          const { data: agData } = await supabase.from('assignment_grades').select('score').in('assignment_id', assignmentIds).eq('student_id', studentData.id)
          assignmentGradesData = agData || []
        }

        const participation = participationData?.score != null ? participationData.score * 10 : null
        
        let attainment = null
        if (assignmentData?.length > 0 && assignmentGradesData.length > 0) {
          const totalScore = assignmentGradesData.reduce((sum, g) => sum + (g.score || 0), 0)
          const totalMax = assignmentData.reduce((sum, a) => sum + (a.max_points || 0), 0)
          attainment = totalMax > 0 ? (totalScore / totalMax) * 100 : null
        }

        let calculatedAttainment = null
        if (participation != null && attainment != null) {
          calculatedAttainment = (participation * 0.2) + (attainment * 0.8)
        } else if (attainment != null) {
          calculatedAttainment = attainment
        }

        let progressTest = null
        let progressTestRW = null
        let progressTestListening = null
        let progressTestSpeaking = null
        let comment = null

        if (progressTestData) {
          comment = progressTestData.comment
          if (subjectClass.subject === 'ESL') {
            const components = []
            if (progressTestData.reading_writing_score != null && progressTestData.reading_writing_total > 0) {
              progressTestRW = (progressTestData.reading_writing_score / progressTestData.reading_writing_total) * 100
              components.push(progressTestRW)
            }
            if (progressTestData.listening_score != null && progressTestData.listening_total > 0) {
              progressTestListening = (progressTestData.listening_score / progressTestData.listening_total) * 100
              components.push(progressTestListening)
            }
            if (progressTestData.speaking_score != null && progressTestData.speaking_total > 0) {
              progressTestSpeaking = (progressTestData.speaking_score / progressTestData.speaking_total) * 100
              components.push(progressTestSpeaking)
            }
            if (components.length === 3) {
              progressTest = avg(components)
            }
          } else {
            if (progressTestData.score != null && progressTestData.total_points > 0) {
              progressTest = (progressTestData.score / progressTestData.total_points) * 100
            }
          }
        }

        let overall = null
        if (calculatedAttainment != null && progressTest != null) {
          overall = (calculatedAttainment * 0.75) + (progressTest * 0.25)
        } else if (calculatedAttainment != null) {
          overall = calculatedAttainment
        }

        return {
          classId: subjectClass.id,
          grades: {
            participation,
            attainment,
            calculatedAttainment,
            progressTest,
            progressTestRW,
            progressTestListening,
            progressTestSpeaking,
            overall,
            letterGrade: letterGradeFromPercentage(overall),
            attributes: attributesData || {},
            comment
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

              {selectedSubject && subjectGradeCache[selectedSubject] && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {classes.find(c => c.id === selectedSubject)?.name}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Teacher: {classes.find(c => c.id === selectedSubject)?.users?.full_name || '—'}
                    </p>
                  </div>

                  <div className="overflow-x-auto">
                    <div className="min-w-max">
                      <div className="flex bg-gray-50 border-b border-gray-200">
                        <div style={{ width: '100px', minWidth: '100px', height: '44px', fontSize: '12px' }} className="text-center px-2 font-medium bg-gray-200 text-gray-700 flex items-center justify-center">
                          Participation
                        </div>
                        <div style={{ width: '130px', minWidth: '130px', height: '44px', fontSize: '12px', lineHeight: '16px', whiteSpace: 'nowrap' }} className="text-center px-2 font-medium bg-gray-200 text-gray-700 flex items-center justify-center">
                          Marked Assignments
                        </div>
                        <div style={{ width: '100px', minWidth: '100px', height: '44px', fontSize: '12px', lineHeight: '16px', whiteSpace: 'nowrap' }} className="text-center px-2 font-medium bg-green-100 text-green-800 flex items-center justify-center">
                          Attainment
                        </div>
                        
                        {classes.find(c => c.id === selectedSubject)?.subject === 'ESL' ? (
                          <div>
                            <div style={{ width: '100px', minWidth: '100px', height: '44px', fontSize: '12px', lineHeight: '16px', whiteSpace: 'nowrap' }} className="text-center px-2 font-medium bg-gray-200 text-gray-700 flex items-center justify-center">
                              Progress (R/W)
                            </div>
                            <div style={{ width: '100px', minWidth: '100px', height: '44px', fontSize: '12px', lineHeight: '16px', whiteSpace: 'nowrap' }} className="text-center px-2 font-medium bg-gray-200 text-gray-700 flex items-center justify-center">
                              Progress (L)
                            </div>
                            <div style={{ width: '100px', minWidth: '100px', height: '44px', fontSize: '12px', lineHeight: '16px', whiteSpace: 'nowrap' }} className="text-center px-2 font-medium bg-gray-200 text-gray-700 flex items-center justify-center">
                              Progress (S)
                            </div>
                            <div style={{ width: '100px', minWidth: '100px', height: '44px', fontSize: '12px', lineHeight: '16px', whiteSpace: 'nowrap' }} className="text-center px-2 font-medium bg-green-100 text-green-800 flex items-center justify-center">
                              Progress Test
                            </div>
                          </div>
                        ) : (
                          <div style={{ width: '100px', minWidth: '100px', height: '44px', fontSize: '12px', lineHeight: '1