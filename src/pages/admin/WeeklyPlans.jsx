import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { useNavigate } from 'react-router-dom'

// Import official school week calendar
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

// Flatten all weeks into single array for dropdown
const ALL_WEEKS = [
  ...PARTICIPATION_WEEK_SCHEDULE.midterm_1,
  ...PARTICIPATION_WEEK_SCHEDULE.final_1,
  ...PARTICIPATION_WEEK_SCHEDULE.midterm_2,
  ...PARTICIPATION_WEEK_SCHEDULE.final_2,
]

// Fixed subject sort order
const SUBJECT_ORDER = ['ESL', 'Mathematics', 'Science', 'Global Perspectives']

const sortClassesBySubject = (classes) => {
  return [...classes].sort((a, b) => {
    const subjectA = a.subject || ''
    const subjectB = b.subject || ''
    const indexA = SUBJECT_ORDER.indexOf(subjectA)
    const indexB = SUBJECT_ORDER.indexOf(subjectB)
    
    if (indexA !== -1 && indexB !== -1) return indexA - indexB
    if (indexA !== -1) return -1
    if (indexB !== -1) return 1
    return (a.name || '').localeCompare(b.name || '')
  })
}

export default function WeeklyPlans() {
  const navigate = useNavigate()
  const [homerooms, setHomerooms] = useState([])
  const [selectedHomeroom, setSelectedHomeroom] = useState('')
  const [selectedWeek, setSelectedWeek] = useState(ALL_WEEKS.findIndex(w => w.week === 1)) // Default to Week 1
  const [classes, setClasses] = useState([])
  const [sortedClasses, setSortedClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [programme, setProgramme] = useState('')

  // Fetch unique homerooms on mount
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
    
    setHomerooms(Array.from(homeroomSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })))
    setLoading(false)
  }

  // Fetch classes for selected homeroom
  useEffect(() => {
    if (selectedHomeroom) {
      fetchClasses()
    } else {
      setClasses([])
      setSortedClasses([])
      setProgramme('')
    }
  }, [selectedHomeroom])

  const fetchClasses = async () => {
    const { data } = await supabase
      .from('classes')
      .select('*, users(full_name)')
      .like('name', `${selectedHomeroom}%`)
      .order('name')
    
    setClasses(data || [])
    
    // Sort classes by fixed subject order
    const sorted = sortClassesBySubject(data || [])
    setSortedClasses(sorted)
    
    // Determine programme for this homeroom
    if (data?.length > 0) {
      setProgramme(data[0].programme)
    }
  }

  // Get visible subjects based on programme
  const getVisibleClasses = () => {
    let visible = sortedClasses
    
    // Hide GP for Integrated
    if (programme === 'integrated') {
      visible = visible.filter(c => c.subject !== 'Global Perspectives')
    }
    
    return visible
  }

  // Get lesson count for subject based on programme
  const getLessonsForSubject = (subject) => {
    if (subject === 'ESL') {
      if (programme === 'integrated') return 6
      return 4
    }
    if (subject === 'Mathematics' || subject === 'Science') {
      if (programme === 'bilingual') return 3
      return 2
    }
    if (subject === 'Global Perspectives') {
      return 1
    }
    return 1
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
        <h2 className="text-2xl font-bold text-gray-900">Weekly Plan Management</h2>
        <p className="text-gray-500 text-sm mt-1">Monitor weekly plan completion for all classes.</p>
      </div>

      {/* Week Selector + Class Toggles */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="flex items-center gap-6">
          <div className="w-64 shrink-0">
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-10"
            >
              {ALL_WEEKS.map((weekItem, idx) => (
                <option key={weekItem.week} value={idx}>
                  {weekItem.label} — {weekItem.range}
                </option>
              ))}
            </select>
          </div>
          
          {/* Homeroom Class Toggles */}
          {homerooms.length > 0 && (
            <div className="flex-1 flex gap-1 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
              {homerooms.map(h => (
                <button
                  key={h}
                  onClick={() => setSelectedHomeroom(h)}
                  className={`px-4 py-2 text-sm font-medium transition-colors rounded-lg whitespace-nowrap shrink-0 h-10 ${
                    selectedHomeroom === h
                      ? 'bg-amber-400 text-gray-900'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {h}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Overall Status */}
      {selectedHomeroom && sortedClasses.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold text-gray-900">{selectedHomeroom} Weekly Plan</h3>
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mt-2 ${
                programme === 'bilingual' 
                  ? 'bg-purple-100 text-purple-700' 
                  : 'bg-teal-100 text-teal-700'
              }`}>
                {programme === 'bilingual' ? 'Bilingual' : 'Integrated'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">Weekly Plan Status:</span>
              <span className="text-sm px-3 py-1.5 rounded-full font-medium bg-red-100 text-red-700">
                Incomplete
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Weekly Plan Horizontal Table */}
      {selectedHomeroom && sortedClasses.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {getVisibleClasses().map(cls => {
              const lessonCount = getLessonsForSubject(cls.subject)
              return (
                <div key={cls.id} className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-bold text-gray-900 text-xl">{cls.subject}</h4>
                      <span className="text-sm text-gray-500 mt-1 block">
                        Teacher: {cls.users?.full_name || 'Unassigned'}
                      </span>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-500">
                      Not Submitted
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    {Array.from({ length: lessonCount }, (_, i) => i + 1).map(lesson => (
                      <div key={lesson} className="flex items-center gap-4">
                        <div className="w-24">
                          <div className="text-sm font-medium text-gray-600">
                            Lesson #{lesson}:
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            Day - P#/P#
                          </div>
                        </div>
                        <div className="flex-1 h-10 bg-gray-50 rounded-lg border border-gray-200 border-dashed cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-colors">
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!selectedHomeroom && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-gray-400 text-sm">
            Select a homeroom class above to view weekly plans
          </div>
        </div>
      )}

      {selectedHomeroom && getVisibleClasses().length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="text-gray-400">No subjects found for this homeroom</div>
        </div>
      )}
    </Layout>
  )
}