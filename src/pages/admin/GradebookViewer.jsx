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

const fmt = (n) => n != null ? n.toFixed(1) : '—'
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

// Define subject sort order
const SUBJECT_ORDER = ['ESL', 'Mathematics', 'Science', 'Global Perspectives']

const sortClassesBySubject = (classes) => {
  return [...classes].sort((a, b) => {
    const subjectA = a.subject || ''
    const subjectB = b.subject || ''
    const indexA = SUBJECT_ORDER.indexOf(subjectA)
    const indexB = SUBJECT_ORDER.indexOf(subjectB)
    
    // If both subjects are in the order list, sort by that
    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB
    }
    // If only one is in the list, put it first
    if (indexA !== -1) return -1
    if (indexB !== -1) return 1
    // Otherwise, sort alphabetically
    return (a.name || '').localeCompare(b.name || '')
  })
}

export default function GradebookViewer() {
  const navigate = useNavigate()
  const [homerooms, setHomerooms] = useState([])
  const [selectedHomeroom, setSelectedHomeroom] = useState('')
  const [selectedTerm, setSelectedTerm] = useState('')
  const [classes, setClasses] = useState([])
  const [sortedClasses, setSortedClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedSubject, setSelectedSubject] = useState('')
  const [studentData, setStudentData] = useState([])
  const [programme, setProgramme] = useState('')
  const [attributeNames, setAttributeNames] = useState([])
  const [activeTab, setActiveTab] = useState('summary')
  const [comments, setComments] = useState({})

  // Fetch unique homerooms
  useEffect(() => {
    fetchHomerooms()
  }, [])

  const fetchHomerooms = async () => {
    const { data } = await supabase
      .from('classes')
      .select('name')
      .order('name')
    
    // Extract homeroom from class name (first part before space)
    const homeroomSet = new Set()
    data?.forEach(cls => {
      const homeroom = cls.name?.split(' ')[0]
      if (homeroom) homeroomSet.add(homeroom)
    })
    
    setHomerooms(Array.from(homeroomSet).sort())
    setLoading(false)
  }

  // Fetch classes for selected homeroom
  useEffect(() => {
    if (selectedHomeroom) {
      fetchClasses()
    } else {
      setClasses([])
      setSortedClasses([])
      setStudentData([])
      setProgramme('')
      setSelectedSubject('')
      setAttributeNames([])
    }
  }, [selectedHomeroom])

  // Auto-select ESL when term is selected
  useEffect(() => {
    if (selectedHomeroom && selectedTerm && sortedClasses.length > 0) {
      const eslClass = sortedClasses.find(c => c.subject === 'ESL')
      if (eslClass) {
        setSelectedSubject(eslClass.id)
      } else if (sortedClasses.length > 0) {
        setSelectedSubject(sortedClasses[0].id)
      }
    }
  }, [selectedHomeroom, selectedTerm, sortedClasses])

  const fetchClasses = async () => {
    const { data } = await supabase
      .from('classes')
      .select('*, users(full_name)')
      .like('name', `${selectedHomeroom}%`)
      .order('name')
    
    setClasses(data || [])
    
    // Sort classes by subject order
    const sorted = sortClassesBySubject(data || [])
    setSortedClasses(sorted)
    
    // Determine programme and set subjects
    if (data?.length > 0) {
      const firstProgramme = data[0].programme
      setProgramme(firstProgramme)
      
      // Auto-select ESL first (or first class if ESL not available)
      const eslClass = sorted.find(c => c.subject === 'ESL')
      if (eslClass) {
        setSelectedSubject(eslClass.id)
      } else if (sorted.length > 0) {
        setSelectedSubject(sorted[0].id)
      }
    }
  }

  // Fetch all homeroom students once when homeroom is selected
  useEffect(() => {
    if (selectedHomeroom && selectedTerm) {
      fetchAllHomeroomStudents()
      fetchStandardAttributeNames()
    } else {
      setStudentData([])
    }
  }, [selectedHomeroom, selectedTerm])

  // Load subject specific data when subject changes AND students are loaded
  useEffect(() => {
    if (selectedHomeroom && selectedTerm && selectedSubject && studentData.length > 0) {
      fetchStudentGradesForSubject()
    }
  }, [selectedHomeroom, selectedTerm, selectedSubject, studentData])

  const fetchStandardAttributeNames = async () => {
    // Always use standard consistent attributes across all subjects
    const standardAttributes = ['confident', 'responsible', 'reflective', 'innovative', 'engaged']
    setAttributeNames(standardAttributes)
  }

  const fetchAllHomeroomStudents = async () => {
    // Get ALL students across ALL subject classes for this homeroom
    // Get all class ids for this homeroom first
    const classIds = sortedClasses.map(c => c.id)
    
    // Get all student enrollments for these classes
    const { data: enrollments } = await supabase
      .from('class_students')
      .select('student_id')
      .in('class_id', classIds)

    // Get unique student ids
    const uniqueStudentIds = [...new Set(enrollments?.map(e => e.student_id) || [])]
    
    if (uniqueStudentIds.length === 0) {
      setStudentData([])
      return
    }

    // Get student details
    const { data: students } = await supabase
      .from('students')
      .select('*')
      .in('id', uniqueStudentIds)
      .order('name_eng')

    // Initialize empty student map
    const studentMap = {}
    students?.forEach(student => {
      studentMap[student.id] = {
        student,
        participation: null,
        attainment: null,
        progressTest: null,
        progressTestRW: null,
        progressTestListening: null,
        progressTestSpeaking: null,
        overall: null,
        letterGrade: '—',
        attributes: {},
      }
    })

    setStudentData(Object.values(studentMap))
  }

  const fetchStudentGradesForSubject = async () => {
    const selectedClass = classes.find(c => c.id === selectedSubject)
    if (!selectedClass) return

    const studentIds = studentData.map(s => s.student.id)
    
    // Fetch participation grades for this class
    const { data: participationData } = await supabase
      .from('participation_grades')
      .select('student_id, score')
      .eq('class_id', selectedSubject)
      .eq('term', selectedTerm)
      .in('student_id', studentIds)

    // Fetch assignments for this class
    const { data: assignmentData } = await supabase
      .from('assignments')
      .select('id, max_points')
      .eq('class_id', selectedSubject)
      .eq('term', selectedTerm)

    const assignmentIds = assignmentData?.map(a => a.id) || []
    let assignmentGradesData = []
    if (assignmentIds.length > 0) {
      const { data: agData } = await supabase
        .from('assignment_grades')
        .select('student_id, assignment_id, score')
        .in('assignment_id', assignmentIds)
        .in('student_id', studentIds)
      assignmentGradesData = agData || []
    }

    // Fetch progress test grades including ESL components
    const { data: progressTestData } = await supabase
      .from('progress_test_grades')
      .select('student_id, score, reading_writing, listening, speaking, rw_total, l_total, s_total, total_points')
      .eq('class_id', selectedSubject)
      .eq('term', selectedTerm)
      .in('student_id', studentIds)

    // Fetch student attributes for this class
    console.log("🔍 Fetching attributes for class:", selectedSubject, "term:", selectedTerm)
    const { data: attributesData, error: attributesError } = await supabase
      .from('student_attributes')
      .select('student_id, attribute, score')
      .eq('class_id', selectedSubject)
      .eq('term', selectedTerm)
      .in('student_id', studentIds)
    
    if (attributesError) {
      console.error("❌ Attributes fetch error:", attributesError)
    } else {
      console.log("✅ Attributes received:", attributesData?.length, "records")
      if (attributesData?.length > 0) {
        console.log("📋 Sample attribute:", attributesData[0])
      }
    }

    // Create grade maps
    const participationMap = Object.fromEntries(participationData?.map(g => [g.student_id, g.score]) || [])
    const progressTestMap = Object.fromEntries(progressTestData?.map(g => [g.student_id, g]) || [])
    const attributesMap = {}
    attributesData?.forEach(attr => {
      if (!attributesMap[attr.student_id]) attributesMap[attr.student_id] = {}
      attributesMap[attr.student_id][attr.attribute] = attr.score
    })

    // Calculate assignment totals correctly
    const assignmentTotals = {}
    const assignmentMax = {}
    
    assignmentGradesData?.forEach(grade => {
      if (!assignmentTotals[grade.student_id]) {
        assignmentTotals[grade.student_id] = 0
        assignmentMax[grade.student_id] = 0
      }
      assignmentTotals[grade.student_id] += grade.score || 0
      const assignment = assignmentData?.find(a => a.id === grade.assignment_id)
      if (assignment) {
        assignmentMax[grade.student_id] += assignment.max_points || 0
      }
    })

    // Update existing student data with grades for this subject
    setStudentData(prevData => prevData.map(({ student, ...rest }) => {
      const participation = participationMap[student.id] != null ? participationMap[student.id] * 10 : null
      const attainment = assignmentMax[student.id] > 0 ? (assignmentTotals[student.id] / assignmentMax[student.id]) * 100 : null
      const pt = progressTestMap[student.id]

      // Calculate progress test percentages
      let progressTest = null
      let progressTestRW = null
      let progressTestListening = null
      let progressTestSpeaking = null

      if (pt) {
        // Overall progress test percentage
        if (pt.score != null && pt.total_points > 0) {
          progressTest = (pt.score / pt.total_points) * 100
        }
        // ESL component percentages
        if (pt.reading_writing != null && pt.rw_total > 0) {
          progressTestRW = (pt.reading_writing / pt.rw_total) * 100
        }
        if (pt.listening != null && pt.l_total > 0) {
          progressTestListening = (pt.listening / pt.l_total) * 100
        }
        if (pt.speaking != null && pt.s_total > 0) {
          progressTestSpeaking = (pt.speaking / pt.s_total) * 100
        }
      }

      const overallParts = []
      if (participation != null) overallParts.push(participation * 0.2)
      if (attainment != null) overallParts.push(attainment * 0.5)
      if (progressTest != null) overallParts.push(progressTest * 0.3)
      const overall = overallParts.length > 0 ? overallParts.reduce((a, b) => a + b, 0) : null

      return {
        student,
        ...rest,
        participation,
        attainment,
        progressTest,
        progressTestRW,
        progressTestListening,
        progressTestSpeaking,
        overall,
        letterGrade: letterGradeFromPercentage(overall),
        attributes: attributesMap[student.id] || {},
      }
    }))
  }

  const getSubjectClasses = () => {
    if (!programme) return []
    return sortedClasses.filter(c => c.programme === programme)
  }

  if (loading) {
    return (
      <Layout>
        <div className="text-center text-gray-400 py-20">Loading...</div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="mb-8">
      <button
        onClick={() => navigate('/dashboard')}
        className="text-white px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity mb-4 flex items-center gap-2 text-sm"
        style={{ backgroundColor: '#1f86c7' }}
      >
        ← Go Back
      </button>
        <h2 className="text-2xl font-bold text-gray-900">Admin Gradebook Viewer</h2>
        <p className="text-gray-500 text-sm mt-1">
          View collective gradebooks for all subjects in a homeroom class
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Homeroom Class</label>
            <select
              value={selectedHomeroom}
              onChange={(e) => {
                setSelectedHomeroom(e.target.value)
                setSelectedTerm('')
                setSelectedSubject('')
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Homeroom</option>
              {homerooms.map(h => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Term</label>
            <select
              value={selectedTerm}
              onChange={(e) => {
                setSelectedTerm(e.target.value)
                setSelectedSubject('')
              }}
              disabled={!selectedHomeroom}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
            >
              <option value="">Select Term</option>
              {TERMS.map(term => (
                <option key={term.key} value={term.key}>{term.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Subject Tabs */}
      {selectedHomeroom && selectedTerm && sortedClasses.length > 0 && (
        <>
          <div className="flex gap-1 border-b border-gray-200 mb-6">
            {getSubjectClasses().map(cls => (
              <button
                key={cls.id}
                onClick={() => setSelectedSubject(cls.id)}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  selectedSubject === cls.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {cls.name}
              </button>
            ))}
          </div>

          {/* Student Grade Table */}
          {studentData.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900">
                  Student Grades - {classes.find(c => c.id === selectedSubject)?.name}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Teacher: {classes.find(c => c.id === selectedSubject)?.users?.full_name || '—'}
                </p>
              </div>
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <span className="text-sm text-gray-500">{studentData.length} students</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium sticky left-0 bg-gray-50">Student</th>
                      <th className="text-center px-4 py-3 font-medium bg-gray-200 text-gray-700">Participation</th>
                      <th className="text-center px-4 py-3 font-medium bg-gray-200 text-gray-700">Marked Assignments</th>
                      <th className="text-center px-4 py-3 font-medium bg-green-100 text-green-800">Attainment</th>
                      
                      {/* Conditional columns based on subject */}
                      {classes.find(c => c.id === selectedSubject)?.subject === 'ESL' ? (
                        <>
                          <th className="text-center px-4 py-3 font-medium bg-gray-200 text-gray-700">Progress Test (R/W)</th>
                          <th className="text-center px-4 py-3 font-medium bg-gray-200 text-gray-700">Progress Test (L)</th>
                          <th className="text-center px-4 py-3 font-medium bg-gray-200 text-gray-700">Progress Test (S)</th>
                          <th className="text-center px-4 py-3 font-medium bg-green-100 text-green-800">Progress Test (Overall)</th>
                        </>
                      ) : (
                        <th className="text-center px-4 py-3 font-medium bg-green-100 text-green-800">Progress Test</th>
                      )}
                      
                      <th className="text-center px-4 py-3 font-medium bg-gray-200 text-gray-700">Overall</th>
                      <th className="text-center px-4 py-3 font-medium bg-gray-200 text-gray-700">Grade</th>
                      
      {attributeNames.map(attr => (
        <th key={attr} className="text-center px-3 py-3 font-medium bg-blue-100 text-blue-800 text-xs">
          {attr.charAt(0).toUpperCase() + attr.slice(1)}
        </th>
      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {studentData.map(({ student, participation, attainment, progressTest, progressTestRW, progressTestListening, progressTestSpeaking, overall, letterGrade, attributes }) => (
                      <tr key={student.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 sticky left-0 bg-white">
                          <div className="font-medium">
                            <span className="text-gray-900">{student.name_eng || '—'}</span>
                            <span className="text-gray-400 px-1">-</span>
                            <span className="text-blue-700">{student.name_vn || '—'}</span>
                          </div>
                          <div className="text-xs text-gray-400">{student.student_id || '—'}</div>
                        </td>
                        <td className="px-4 py-3 text-center bg-gray-50">
                          <span className={`font-semibold ${
                            participation != null 
                              ? participation >= 80 ? 'text-green-600' 
                              : participation >= 65 ? 'text-blue-600'
                              : participation >= 50 ? 'text-amber-600'
                              : 'text-red-600'
                              : 'text-gray-300'
                          }`}>
                            {participation != null ? fmt(participation) : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center bg-gray-50">
                          <span className="text-gray-600">{fmt(attainment)}</span>
                        </td>
                        <td className="px-4 py-3 text-center bg-green-50">
                          <span className={`font-semibold ${
                            attainment != null 
                              ? attainment >= 80 ? 'text-green-600' 
                              : attainment >= 65 ? 'text-blue-600'
                              : attainment >= 50 ? 'text-amber-600'
                              : 'text-red-600'
                              : 'text-gray-300'
                          }`}>
                            {fmt(attainment)}
                          </span>
                        </td>
                        
                        {/* Conditional ESL columns */}
                        {classes.find(c => c.id === selectedSubject)?.subject === 'ESL' ? (
                          <>
                            <td className="px-4 py-3 text-center bg-gray-50"><span className="text-gray-600">{fmt(progressTestRW)}</span></td>
                            <td className="px-4 py-3 text-center bg-gray-50"><span className="text-gray-600">{fmt(progressTestListening)}</span></td>
                            <td className="px-4 py-3 text-center bg-gray-50"><span className="text-gray-600">{fmt(progressTestSpeaking)}</span></td>
                            <td className="px-4 py-3 text-center bg-green-50"><span className="text-gray-600">{fmt(progressTest)}</span></td>
                          </>
                        ) : (
                          <td className="px-4 py-3 text-center bg-green-50"><span className="text-gray-600">{fmt(progressTest)}</span></td>
                        )}
                        
                        <td className="px-4 py-3 text-center bg-gray-50">
                          <span className={`font-semibold ${
                            overall != null 
                              ? overall >= 80 ? 'text-green-600' 
                              : overall >= 65 ? 'text-blue-600'
                              : overall >= 50 ? 'text-amber-600'
                              : 'text-red-600'
                              : 'text-gray-300'
                          }`}>
                            {fmt(overall)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center bg-gray-50">
                          <span className={`inline-block w-8 h-8 leading-8 rounded font-bold text-sm ${
                            letterGrade === 'A*' || letterGrade === 'A' ? 'bg-green-100 text-green-700'
                            : letterGrade === 'B' ? 'bg-blue-100 text-blue-700'
                            : letterGrade === 'C' ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                          }`}>
                            {letterGrade}
                          </span>
                        </td>
                        
                        {attributeNames.map(attr => (
                          <td key={attr} className="px-3 py-3 text-center bg-blue-50">
                            <span className="text-gray-600">{attributes[attr] != null ? fmt(attributes[attr]) : '—'}</span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {studentData.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
              No students or grade data available for this class.
            </div>
          )}
        </>
      )}

      {!selectedHomeroom || !selectedTerm ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-gray-400 text-sm">
            Select a homeroom and term to view collective gradebooks
          </div>
        </div>
      ) : null}
    </Layout>
  )
}