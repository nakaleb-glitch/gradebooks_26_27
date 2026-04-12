import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { useNavigate } from 'react-router-dom'
import ExcelJS from 'exceljs'

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
  const [loadingGrades, setLoadingGrades] = useState(false)
  const [selectedSubject, setSelectedSubject] = useState('')
  const [studentData, setStudentData] = useState([])
  const [programme, setProgramme] = useState('')
  const [attributeNames, setAttributeNames] = useState([])
  const [subjectGradeCache, setSubjectGradeCache] = useState({})
  const [activeTab, setActiveTab] = useState('summary')
  const [selectedComment, setSelectedComment] = useState(null)

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
      setSubjectGradeCache({})
    }
  }, [selectedHomeroom])

  // BULK LOAD ALL GRADE DATA ONCE WHEN HOMEROOM + TERM ARE SELECTED
  useEffect(() => {
    if (selectedHomeroom && selectedTerm && sortedClasses.length > 0) {
      fetchAllGradeDataInParallel()
    } else {
      setStudentData([])
      setSubjectGradeCache({})
    }
  }, [selectedHomeroom, selectedTerm, sortedClasses])

  // Auto-select ESL when data is loaded
  useEffect(() => {
    if (selectedHomeroom && selectedTerm && sortedClasses.length > 0 && Object.keys(subjectGradeCache).length > 0) {
      const eslClass = sortedClasses.find(c => c.subject === 'ESL')
      if (eslClass) {
        setSelectedSubject(eslClass.id)
      } else if (sortedClasses.length > 0) {
        setSelectedSubject(sortedClasses[0].id)
      }
    }
  }, [selectedHomeroom, selectedTerm, sortedClasses, subjectGradeCache])

  const fetchClasses = async () => {
    const { data } = await supabase
      .from('classes')
      .select('*, users!classes_teacher_id_fkey(full_name)')
      .like('name', `${selectedHomeroom}%`)
      .order('name')
    
    setClasses(data || [])
    
    // Sort classes by subject order
    const sorted = sortClassesBySubject(data || [])
    setSortedClasses(sorted)
    
    // Determine programme type for this homeroom:
    // If Global Perspectives exists → Bilingual programme
    // Else → Integrated programme
    if (data?.length > 0) {
      const hasGlobalPerspectives = data.some(c => c.subject === 'Global Perspectives')
      setProgramme(hasGlobalPerspectives ? 'Bilingual' : 'Integrated')
    }

    // Always use standard consistent attributes across all subjects
    const standardAttributes = ['confident', 'responsible', 'reflective', 'innovative', 'engaged']
    setAttributeNames(standardAttributes)
  }

  // ✅ NEW: PARALLEL BULK DATA LOADING - LOAD EVERYTHING ONCE
  const fetchAllGradeDataInParallel = async () => {
    setLoadingGrades(true)
    
    try {
      console.log('🚀 Starting BULK parallel grade load for all subjects')
      
      // Step 1: Get all students for this homeroom
      const classIds = sortedClasses.map(c => c.id)
      
      const { data: enrollments } = await supabase
        .from('class_students')
        .select('student_id')
        .in('class_id', classIds)

      // Get unique student ids
      const uniqueStudentIds = [...new Set(enrollments?.map(e => e.student_id) || [])]
      
      if (uniqueStudentIds.length === 0) {
        setStudentData([])
        setLoadingGrades(false)
        return
      }

      // Get student details
      const { data: students } = await supabase
        .from('students')
        .select('*')
        .in('id', uniqueStudentIds)
        .order('name_eng')

      // Initialize student base data
      const studentBase = {}
      students?.forEach(student => {
        studentBase[student.id] = { student }
      })

      setStudentData(Object.values(studentBase))

      // Check if this is a final term (needs comments)
      const isFinalTerm = selectedTerm === 'final_1' || selectedTerm === 'final_2'

      // ✅ Step 2: PARALLEL QUERY ALL SUBJECTS AT ONCE
      const allSubjectPromises = sortedClasses.map(async (subjectClass) => {
        console.log(`📚 Loading grades for: ${subjectClass.subject}`)
        
        // Fetch ALL grade types in parallel for this subject
        const [
          { data: participationData },
          { data: assignmentData },
          { data: progressTestData },
          { data: attributesData }
        ] = await Promise.all([
          supabase.from('participation_grades').select('student_id, score').eq('class_id', subjectClass.id).eq('term', selectedTerm).in('student_id', uniqueStudentIds),
          supabase.from('assignments').select('id, max_points').eq('class_id', subjectClass.id).eq('term', selectedTerm),
          supabase.from('progress_test_grades').select('student_id, score, reading_writing_score, listening_score, speaking_score, reading_writing_total, listening_total, speaking_total, total_points, comment').eq('class_id', subjectClass.id).eq('term', selectedTerm).in('student_id', uniqueStudentIds),
          supabase.from('student_attributes').select('student_id, confident, responsible, reflective, innovative, engaged').eq('class_id', subjectClass.id).eq('term', selectedTerm).in('student_id', uniqueStudentIds)
        ])

        // Get assignment grades if there are assignments
        let assignmentGradesData = []
        if (assignmentData?.length > 0) {
          const assignmentIds = assignmentData.map(a => a.id)
          const { data: agData } = await supabase.from('assignment_grades').select('student_id, assignment_id, score').in('assignment_id', assignmentIds).in('student_id', uniqueStudentIds)
          assignmentGradesData = agData || []
        }

        // Process and calculate all grades for this subject
        const participationMap = Object.fromEntries(participationData?.map(g => [g.student_id, g.score]) || [])
        const progressTestMap = Object.fromEntries(progressTestData?.map(g => [g.student_id, g]) || [])
        const attributesMap = Object.fromEntries(attributesData?.map(row => [row.student_id, row]) || [])

        // Calculate assignment totals
        const assignmentTotals = {}
        const assignmentMax = {}
        assignmentGradesData?.forEach(grade => {
          if (!assignmentTotals[grade.student_id]) {
            assignmentTotals[grade.student_id] = 0
            assignmentMax[grade.student_id] = 0
          }
          assignmentTotals[grade.student_id] += grade.score || 0
          const assignment = assignmentData?.find(a => a.id === grade.assignment_id)
          if (assignment) assignmentMax[grade.student_id] += assignment.max_points || 0
        })

        // Calculate final grades for every student
        const subjectGrades = {}
        Object.keys(studentBase).forEach(studentId => {
          const participation = participationMap[studentId] != null ? participationMap[studentId] * 10 : null
          const attainment = assignmentMax[studentId] > 0 ? (assignmentTotals[studentId] / assignmentMax[studentId]) * 100 : null
          const pt = progressTestMap[studentId]

          let calculatedAttainment = null
          if (participation != null && attainment != null) {
            calculatedAttainment = (participation * 0.2) + (attainment * 0.8)
          } else if (attainment != null) {
            calculatedAttainment = attainment
          }

          // Calculate progress test percentages
          let progressTest = null
          let progressTestRW = null
          let progressTestListening = null
          let progressTestSpeaking = null

          if (pt) {
            // ESL component percentages
            if (pt.reading_writing_score != null && pt.reading_writing_total > 0) {
              progressTestRW = (pt.reading_writing_score / pt.reading_writing_total) * 100
            }
            if (pt.listening_score != null && pt.listening_total > 0) {
              progressTestListening = (pt.listening_score / pt.listening_total) * 100
            }
            if (pt.speaking_score != null && pt.speaking_total > 0) {
              progressTestSpeaking = (pt.speaking_score / pt.speaking_total) * 100
            }

            if (subjectClass.subject === 'ESL') {
              const components = []
              if (progressTestRW != null) components.push(progressTestRW)
              if (progressTestListening != null) components.push(progressTestListening)
              if (progressTestSpeaking != null) components.push(progressTestSpeaking)
              if (components.length === 3) {
                progressTest = avg(components)
              }
            } else {
              if (pt.score != null && pt.total_points > 0) {
                progressTest = (pt.score / pt.total_points) * 100
              }
            }
          }

          let overall = null
          if (calculatedAttainment != null && progressTest != null) {
            overall = (calculatedAttainment * 0.75) + (progressTest * 0.25)
          } else if (calculatedAttainment != null) {
            overall = calculatedAttainment
          }

          subjectGrades[studentId] = {
            participation,
            attainment,
            calculatedAttainment,
            progressTest,
            progressTestRW,
            progressTestListening,
            progressTestSpeaking,
            overall,
            letterGrade: letterGradeFromPercentage(overall),
            attributes: attributesMap[studentId] || {},
            comment: pt?.comment || null
          }
        })

        return { classId: subjectClass.id, grades: subjectGrades }
      })

      // Wait for ALL subjects to finish loading
      const allSubjectResults = await Promise.all(allSubjectPromises)
      
      // Build cache: classId → student grades map
      const cache = {}
      allSubjectResults.forEach(result => {
        cache[result.classId] = result.grades
      })

      setSubjectGradeCache(cache)
      console.log('✅ ALL grades loaded successfully! Total subjects:', Object.keys(cache).length)

    } catch (error) {
      console.error('❌ Bulk load failed:', error)
    } finally {
      setLoadingGrades(false)
    }
  }

  const getSubjectClasses = () => {
    return sortedClasses
  }

  // ✅ FAST EXPORT - USES ALREADY CACHED DATA (NO DATABASE CALLS!)
  const exportGradebook = async () => {
    console.log('📤 [EXPORT START] Using cached data - no database calls!')
    try {
      // Load correct template
      const templatePath = programme === 'Bilingual' 
        ? '/templates/lms_primary_gradebook_bilingual_template.xlsx'
        : '/templates/lms_primary_gradebook_integrated_template.xlsx'

      console.log('📄 Step 1/4: Loading template')
      const response = await fetch(templatePath)
      if (!response.ok) throw new Error(`Failed to load template: ${response.status} ${response.statusText}`)

      const buffer = await response.arrayBuffer()
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(buffer)
      console.log('✅ Template loaded')

      // Write homeroom class name
      const classSheet = workbook.getWorksheet('CLASS')
      if (!classSheet) throw new Error('CLASS worksheet not found in template')
      classSheet.getCell('B3').value = selectedHomeroom

       // ✅ Write student names once
       studentData.forEach((data, index) => {
         const row = 5 + index
         classSheet.getCell(`B${row}`).value = data.student.student_id
         classSheet.getCell(`C${row}`).value = data.student.name_vn
         classSheet.getCell(`D${row}`).value = data.student.name_eng
       })

      console.log('📄 Step 2/4: Writing subject sheets')

      // Write all subjects using already cached data
      const writeSubjectSheet = (sheetName, subjectName) => {
        const subjectClass = sortedClasses.find(c => c.subject === subjectName)
        if (!subjectClass) return

        const sheet = workbook.getWorksheet(sheetName)
        if (!sheet) return

        const subjectGrades = subjectGradeCache[subjectClass.id]
        if (!subjectGrades) return

        studentData.forEach((data, index) => {
          const row = 5 + index
          const grades = subjectGrades[data.student.id]
          if (!grades) return

           sheet.getCell(`E${row}`).value = grades.participation
           sheet.getCell(`F${row}`).value = grades.attainment

           if (subjectName === 'ESL') {
             sheet.getCell(`H${row}`).value = grades.progressTestListening
             sheet.getCell(`I${row}`).value = grades.progressTestRW
             sheet.getCell(`J${row}`).value = grades.progressTestSpeaking

             if (grades.attributes) {
               sheet.getCell(`M${row}`).value = grades.attributes.confident
               sheet.getCell(`N${row}`).value = grades.attributes.responsible
               sheet.getCell(`O${row}`).value = grades.attributes.reflective
               sheet.getCell(`P${row}`).value = grades.attributes.innovative
               sheet.getCell(`Q${row}`).value = grades.attributes.engaged
             }
           } else {
             sheet.getCell(`H${row}`).value = grades.progressTest
             
             if (grades.attributes) {
               sheet.getCell(`J${row}`).value = grades.attributes.confident
               sheet.getCell(`K${row}`).value = grades.attributes.responsible
               sheet.getCell(`L${row}`).value = grades.attributes.reflective
               sheet.getCell(`M${row}`).value = grades.attributes.innovative
               sheet.getCell(`N${row}`).value = grades.attributes.engaged
             }
           }
        })

        console.log(`✅ ${subjectName} sheet written`)
      }

      writeSubjectSheet('ESL', 'ESL')
      writeSubjectSheet('Maths', 'Mathematics')
      writeSubjectSheet('Science', 'Science')
      
      if (programme === 'Bilingual') {
        writeSubjectSheet('GP', 'Global Perspectives')
      }

      console.log('📄 Step 3/4: Generating file')
      const blob = await workbook.xlsx.writeBuffer()

      console.log('📄 Step 4/4: Downloading')
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      const a = document.createElement('a')
      a.href = url
      const currentYear = new Date().getFullYear()
      a.download = `${currentYear}_pl_${selectedHomeroom}_${programme}_${selectedTerm}_gradebook.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      
      console.log('✅ [EXPORT SUCCESS]')
      alert('✅ Gradebook exported successfully!')

    } catch (error) {
      console.error('❌ [EXPORT FAILED]', error)
      alert(`❌ Export failed: ${error.message}`)
    }
  }

  // Get current subject grades from cache instantly
  const currentSubjectGrades = useMemo(() => {
    if (!selectedSubject || !subjectGradeCache[selectedSubject]) return {}
    return subjectGradeCache[selectedSubject]
  }, [selectedSubject, subjectGradeCache])

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
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-white px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 text-sm"
            style={{ backgroundColor: '#1f86c7' }}
          >
            ← Go Back
          </button>

           {selectedHomeroom && selectedTerm && (
             <div className="flex flex-col gap-2 items-end">
               <div className="flex gap-3">
                 {loadingGrades && (
                   <div className="px-4 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg flex items-center gap-2">
                     <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                     Loading all grades...
                   </div>
                 )}
                 
                 {!loadingGrades && Object.keys(subjectGradeCache).length > 0 && (
                   <button
                     onClick={exportGradebook}
                     className="text-white px-4 py-1.5 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 text-sm font-medium"
                     style={{ backgroundColor: '#eab308' }}
                   >
                     Export Grades
                   </button>
                 )}
               </div>
               
               {!loadingGrades && Object.keys(subjectGradeCache).length > 0 && (
                 <div className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded">
                   ✅ Grades Successfully Loaded!
                 </div>
               )}
             </div>
           )}
        </div>

        <h2 className="text-2xl font-bold text-gray-900">Gradebook Management</h2>
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
          <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
            {getSubjectClasses().map(cls => (
              <button
                key={cls.id}
                onClick={() => setSelectedSubject(cls.id)}
                disabled={loadingGrades}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                  selectedSubject === cls.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                } ${loadingGrades ? 'opacity-50' : ''}`}
              >
                {cls.subject || cls.name}
              </button>
            ))}
          </div>

          {/* Student Grade Table */}
          {studentData.length > 0 && Object.keys(currentSubjectGrades).length > 0 && (
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
                <div className="min-w-max">
                  
                  {/* Header Row */}
                  <div className="flex bg-gray-50 border-b border-gray-200">
                    <div style={{ width: '240px', minWidth: '240px', maxWidth: '240px', height: '44px', fontSize: '12px' }} className="text-left px-4 text-gray-500 font-medium sticky left-0 bg-gray-50 z-10 flex items-center">
                      Student
                    </div>
                    <div style={{ width: '100px', minWidth: '100px', maxWidth: '100px', height: '44px', fontSize: '12px', lineHeight: '16px', whiteSpace: 'nowrap' }} className="text-center px-2 font-medium bg-gray-200 text-gray-700 flex items-center justify-center">
                      Participation
                    </div>
                    <div style={{ width: '130px', minWidth: '130px', maxWidth: '130px', height: '44px', fontSize: '12px', lineHeight: '16px', whiteSpace: 'nowrap' }} className="text-center px-2 font-medium bg-gray-200 text-gray-700 flex items-center justify-center">
                      Marked Assignments
                    </div>
                    <div style={{ width: '100px', minWidth: '100px', maxWidth: '100px', height: '44px', fontSize: '12px', lineHeight: '16px', whiteSpace: 'nowrap' }} className="text-center px-2 font-medium bg-green-100 text-green-800 flex items-center justify-center">
                      Attainment
                    </div>
                    
                    {/* Conditional headers based on subject */}
                      {classes.find(c => c.id === selectedSubject)?.subject === 'ESL' ? (
                      <>
                        <div style={{ width: '100px', minWidth: '100px', maxWidth: '100px', height: '44px', fontSize: '12px', lineHeight: '16px', whiteSpace: 'nowrap' }} className="text-center px-2 font-medium bg-gray-200 text-gray-700 flex items-center justify-center">
                          Progress (R/W)
                        </div>
                        <div style={{ width: '100px', minWidth: '100px', maxWidth: '100px', height: '44px', fontSize: '12px', lineHeight: '16px', whiteSpace: 'nowrap' }} className="text-center px-2 font-medium bg-gray-200 text-gray-700 flex items-center justify-center">
                          Progress (L)
                        </div>
                        <div style={{ width: '100px', minWidth: '100px', maxWidth: '100px', height: '44px', fontSize: '12px', lineHeight: '16px', whiteSpace: 'nowrap' }} className="text-center px-2 font-medium bg-gray-200 text-gray-700 flex items-center justify-center">
                          Progress (S)
                        </div>
                        <div style={{ width: '100px', minWidth: '100px', maxWidth: '100px', height: '44px', fontSize: '12px', lineHeight: '16px', whiteSpace: 'nowrap' }} className="text-center px-2 font-medium bg-green-100 text-green-800 flex items-center justify-center">
                          Progress Test
                        </div>
                      </>
                    ) : (
                      <div style={{ width: '100px', minWidth: '100px', maxWidth: '100px', height: '44px', fontSize: '12px', lineHeight: '16px', whiteSpace: 'nowrap' }} className="text-center px-2 font-medium bg-green-100 text-green-800 flex items-center justify-center">
                        Progress Test
                      </div>
                    )}
                    
                    <div style={{ width: '100px', minWidth: '100px', maxWidth: '100px', height: '44px', fontSize: '12px', lineHeight: '16px', whiteSpace: 'nowrap' }} className="text-center px-2 font-medium bg-gray-200 text-gray-700 flex items-center justify-center">
                      Overall
                    </div>
                    <div style={{ width: '80px', minWidth: '80px', maxWidth: '80px', height: '44px', fontSize: '12px', lineHeight: '16px', whiteSpace: 'nowrap' }} className="text-center px-2 font-medium bg-gray-200 text-gray-700 flex items-center justify-center">
                      Grade
                    </div>
                    
                    {attributeNames.map(attr => (
                      <div key={attr} style={{ width: '80px', minWidth: '80px', maxWidth: '80px', height: '44px', fontSize: '12px', lineHeight: '16px', whiteSpace: 'nowrap' }} className="text-center px-2 font-medium bg-blue-100 text-blue-800 flex items-center justify-center">
                        {attr.charAt(0).toUpperCase() + attr.slice(1)}
                      </div>
                    ))}

                    {(selectedTerm === 'final_1' || selectedTerm === 'final_2') && (
                      <div style={{ width: '180px', minWidth: '180px', maxWidth: '180px', height: '44px', fontSize: '12px', lineHeight: '16px', whiteSpace: 'nowrap' }} className="text-center px-2 font-medium bg-gray-200 text-gray-700 flex items-center justify-center">
                        Teacher Comment
                      </div>
                    )}
                  </div>

                  {/* Data Rows */}
                  {studentData.map(({ student }) => {
                    const grades = currentSubjectGrades[student.id] || {}
                    
                    return (
                      <div key={student.id} className="flex border-b border-gray-100 hover:bg-gray-50">
                        <div style={{ width: '240px', minWidth: '240px', maxWidth: '240px', height: '52px', fontSize: '13px' }} className="px-4 sticky left-0 bg-white z-10 flex items-center">
                          <div className="font-medium">
                            <span className="text-gray-900">{student.name_eng || '—'}</span>
                            <span className="text-gray-400 px-1">-</span>
                            <span className="text-blue-700">{student.name_vn || '—'}</span>
                            <div className="text-xs text-gray-400">{student.student_id || '—'}</div>
                          </div>
                        </div>
                        
                        <div style={{ width: '100px', minWidth: '100px', maxWidth: '100px', height: '52px', fontSize: '12px' }} className="px-2 text-center bg-gray-50 flex items-center justify-center">
                          <span className="text-black font-sans">{fmt(grades.participation)}</span>
                        </div>
                        <div style={{ width: '130px', minWidth: '130px', maxWidth: '130px', height: '52px', fontSize: '12px' }} className="px-2 text-center bg-gray-50 flex items-center justify-center">
                          <span className="text-black font-sans">{fmt(grades.attainment)}</span>
                        </div>
                        <div style={{ width: '100px', minWidth: '100px', maxWidth: '100px', height: '52px', fontSize: '12px' }} className="px-2 text-center bg-green-50 flex items-center justify-center">
                          <span className="text-black font-sans font-bold">{fmt(grades.calculatedAttainment)}</span>
                        </div>
                        
                        {/* Conditional ESL columns */}
                        {classes.find(c => c.id === selectedSubject)?.subject === 'ESL' ? (
                          <>
                            <div style={{ width: '100px', minWidth: '100px', maxWidth: '100px', height: '52px', fontSize: '12px' }} className="px-2 text-center bg-gray-50 flex items-center justify-center">
                              <span className="text-black font-sans">{fmt(grades.progressTestRW)}</span>
                            </div>
                            <div style={{ width: '100px', minWidth: '100px', maxWidth: '100px', height: '52px', fontSize: '12px' }} className="px-2 text-center bg-gray-50 flex items-center justify-center">
                              <span className="text-black font-sans">{fmt(grades.progressTestListening)}</span>
                            </div>
                            <div style={{ width: '100px', minWidth: '100px', maxWidth: '100px', height: '52px', fontSize: '12px' }} className="px-2 text-center bg-gray-50 flex items-center justify-center">
                              <span className="text-black font-sans">{fmt(grades.progressTestSpeaking)}</span>
                            </div>
                            <div style={{ width: '100px', minWidth: '100px', maxWidth: '100px', height: '52px', fontSize: '12px' }} className="px-2 text-center bg-green-50 flex items-center justify-center">
                              <span className="text-black font-sans font-bold">{fmt(grades.progressTest)}</span>
                            </div>
                          </>
                        ) : (
                          <div style={{ width: '100px', minWidth: '100px', maxWidth: '100px', height: '52px', fontSize: '12px' }} className="px-2 text-center bg-green-50 flex items-center justify-center">
                            <span className="text-black font-sans">{fmt(grades.progressTest)}</span>
                          </div>
                        )}
                        
                        <div style={{ width: '100px', minWidth: '100px', maxWidth: '100px', height: '52px', fontSize: '12px' }} className="px-2 text-center bg-gray-50 flex items-center justify-center">
                          <span className="text-black font-sans font-bold">{fmt(grades.overall)}</span>
                        </div>
                        <div style={{ width: '80px', minWidth: '80px', maxWidth: '80px', height: '52px', fontSize: '12px' }} className="px-2 text-center bg-gray-50 flex items-center justify-center">
                          <span className={`inline-block w-8 h-8 leading-8 rounded font-bold text-sm ${
                            grades.letterGrade === 'A*' || grades.letterGrade === 'A' ? 'bg-green-100 text-green-700'
                            : grades.letterGrade === 'B' ? 'bg-blue-100 text-blue-700'
                            : grades.letterGrade === 'C' ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                          }`}>
                            {grades.letterGrade || '—'}
                          </span>
                        </div>
                        
                        {attributeNames.map(attr => (
                          <div key={attr} style={{ width: '80px', minWidth: '80px', maxWidth: '80px', height: '52px', fontSize: '12px' }} className="px-2 text-center bg-blue-50 flex items-center justify-center">
                            <span className="text-black font-sans">{grades.attributes?.[attr] != null ? fmt(grades.attributes[attr]) : '—'}</span>
                          </div>
                        ))}

                        {(selectedTerm === 'final_1' || selectedTerm === 'final_2') && (
                          <div style={{ width: '180px', minWidth: '180px', maxWidth: '180px', height: '52px', fontSize: '12px' }} className="px-2 text-center bg-gray-50 flex items-center justify-center cursor-pointer hover:bg-gray-100" onClick={() => grades.comment && setSelectedComment(grades.comment)}>
                            <span className="text-black font-sans truncate">
                              {grades.comment ? grades.comment.substring(0, 35) + (grades.comment.length > 35 ? '...' : '') : '—'}
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {loadingGrades && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <div className="text-gray-500">Loading grade data for all subjects...</div>
              <div className="text-xs text-gray-400 mt-2">Please wait - this only happens once</div>
            </div>
          )}

          {studentData.length === 0 && !loadingGrades && (
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

      {/* Comment Modal */}
      {selectedComment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedComment(null)}>
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Teacher Comment</h3>
              <button onClick={() => setSelectedComment(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="text-gray-700 whitespace-pre-wrap">
              {selectedComment}
            </div>
            <div className="mt-6 text-right">
              <button onClick={() => setSelectedComment(null)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
