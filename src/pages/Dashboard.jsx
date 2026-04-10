import { useAuth } from '../contexts/AuthContext'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { normalizeLinkUrl, uploadTeacherAnnouncementPdf } from '../lib/announcementAttachments'
import AnnouncementPdfButton from '../components/AnnouncementPdfButton'

const INCIDENT_TYPES = ['Disruption', 'Respect', 'Bullying', 'Academic Dishonesty', 'Attendance', 'Other']
const SEVERITY_LEVELS = ['Low', 'Medium', 'High']

// School official week calendar
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

export default function Dashboard() {
  const { profile, user } = useAuth()
  const [classes, setClasses] = useState([])
  const [students, setStudents] = useState([])
  const [newBehaviorReportsCount, setNewBehaviorReportsCount] = useState(0)
  const [newTeacherPasswordResetCount, setNewTeacherPasswordResetCount] = useState(0)
  const [newStudentPasswordResetCount, setNewStudentPasswordResetCount] = useState(0)
  const [incompleteWeeklyPlanCount, setIncompleteWeeklyPlanCount] = useState(0)
  const [studentAnnouncements, setStudentAnnouncements] = useState([])
  const [studentGradedAssignments, setStudentGradedAssignments] = useState([])
  const [teacherAnnouncements, setTeacherAnnouncements] = useState([])
  const [teacherEvents, setTeacherEvents] = useState([])
  const [teacherDeadlines, setTeacherDeadlines] = useState([])
  const [selectedDashboardItem, setSelectedDashboardItem] = useState(null)
  const [showTeacherAnnouncements, setShowTeacherAnnouncements] = useState(null)
  const [announcementScope, setAnnouncementScope] = useState('all_my_classes')
  const [announcementClassIds, setAnnouncementClassIds] = useState([])
  const [announcementTitle, setAnnouncementTitle] = useState('')
  const [announcementMessage, setAnnouncementMessage] = useState('')
  const [announcementLinkUrl, setAnnouncementLinkUrl] = useState('')
  const [announcementPdfFile, setAnnouncementPdfFile] = useState(null)
  const announcementPdfInputRef = useRef(null)
  const [postingAnnouncement, setPostingAnnouncement] = useState(false)
  const [announcementFeedback, setAnnouncementFeedback] = useState(null)
  const [behaviorStudents, setBehaviorStudents] = useState([])
  const [teacherSubmittedReports, setTeacherSubmittedReports] = useState([])
  const [selectedBehaviorSubmission, setSelectedBehaviorSubmission] = useState(null)
  const [showTeacherSubmissions, setShowTeacherSubmissions] = useState(null)
  const [savingBehaviorReport, setSavingBehaviorReport] = useState(false)
  const [behaviorMessage, setBehaviorMessage] = useState(null)
  const [behaviorForm, setBehaviorForm] = useState({
    class_id: '',
    student_id: '',
    incident_date: new Date().toISOString().slice(0, 10),
    incident_type: 'Disruption',
    severity: 'Medium',
    description: '',
    action_taken: '',
  })
  const [loading, setLoading] = useState(true)
  const [levelFilter, setLevelFilter] = useState('')
  const [gradeFilter, setGradeFilter] = useState('all')
  const [debugWeekOverride, setDebugWeekOverride] = useState(getCurrentWeekIndex())
  const [showDebugControls, setShowDebugControls] = useState(false)

  useEffect(() => {
    if (profile) fetchDashboardData()
  }, [profile])

  const fetchDashboardData = async () => {
    setLoading(true)

    if (profile.role === 'admin') {
      const [{ data: classData }, { data: studentData }, { count: newReportsCount }, { data: newResetRequests }, { data: userRows }] = await Promise.all([
        supabase.from('classes').select('*').order('name'),
        supabase.from('students').select('*'),
        supabase
          .from('behavior_reports')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'new'),
        supabase
          .from('password_reset_requests')
          .select('staff_id')
          .eq('status', 'new'),
        supabase.from('users').select('staff_id, role'),
      ])
      const roleById = new Map(
        (userRows || []).map((u) => [String(u.staff_id || '').trim().toLowerCase(), u.role])
      )
      let teacherResetCount = 0
      let studentResetCount = 0
      ;(newResetRequests || []).forEach((req) => {
        const role = roleById.get(String(req.staff_id || '').trim().toLowerCase())
        if (role === 'student') studentResetCount += 1
        else if (role === 'teacher') teacherResetCount += 1
      })
      setClasses(classData || [])
      setStudents(studentData || [])
      setNewBehaviorReportsCount(newReportsCount || 0)
      setNewTeacherPasswordResetCount(teacherResetCount)
      setNewStudentPasswordResetCount(studentResetCount)
      
      // Calculate incomplete weekly plan count
      const currentWeek = getCurrentWeekIndex()
      
      // Count how many unique (class, week) combinations are missing
      const { count: submittedCount } = await supabase
        .from('weekly_plan_lessons')
        .select('id', { count: 'exact', head: true })
        .eq('week', currentWeek)
        .eq('status', 'submitted')
      
      // Total required lessons = sum of lessons per class for current week
      let totalRequired = 0
      classData?.forEach(cls => {
        if (cls.subject === 'ESL') totalRequired += cls.programme === 'integrated' ? 6 : 4
        else if (cls.subject === 'Mathematics' || cls.subject === 'Science') totalRequired += cls.programme === 'bilingual' ? 3 : 2
        else if (cls.subject === 'Global Perspectives') totalRequired += 1
        else totalRequired += 1
      })
      
      const incompleteCount = totalRequired - (submittedCount || 0)
      setIncompleteWeeklyPlanCount(Math.max(0, incompleteCount))
      
      setLoading(false)
      return
    }

    setNewBehaviorReportsCount(0)
    setNewTeacherPasswordResetCount(0)
    setNewStudentPasswordResetCount(0)
    const today = new Date().toISOString().slice(0, 10)

    if (profile.role === 'student') {
      let studentClasses = []
      if (profile.student_id_ref) {
        const { data: enrollmentRows } = await supabase
          .from('class_students')
          .select('classes(*)')
          .eq('student_id', profile.student_id_ref)

        studentClasses = (enrollmentRows || [])
          .map((row) => row.classes)
          .filter(Boolean)
          .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric: true }))

        // Fetch teacher names for all classes via the foreign key relationship
        if (studentClasses.length > 0) {
          const { data: teacherRows } = await supabase
            .from('classes')
            .select('id, users(id, full_name)')
            .in('id', studentClasses.map(c => c.id))

          const teacherNameByClassId = {}
          teacherRows.forEach(cls => {
            if (cls.users?.full_name) {
              teacherNameByClassId[cls.id] = cls.users.full_name
            }
          })
          
          studentClasses = studentClasses.map((cls) => ({
            ...cls,
            teacher_name: teacherNameByClassId[cls.id] || 'No teacher assigned',
          }))
        }
      }

      setClasses(studentClasses)
      const classIds = studentClasses.map((c) => c.id)
      if (classIds.length > 0) {
        const [{ data: assignmentRows }, { data: assignmentGradeRows }, { data: participationRows }, { data: teacherTargetRows }] = await Promise.all([
          supabase
            .from('assignments')
            .select('*')
            .in('class_id', classIds)
            .order('created_at', { ascending: false }),
          supabase
            .from('assignment_grades')
            .select('assignment_id, score, comment, is_absent, created_at')
            .eq('student_id', profile.student_id_ref)
            .not('score', 'is', null),
          supabase
            .from('participation_grades')
            .select('class_id, term, week, score')
            .eq('student_id', profile.student_id_ref)
            .in('class_id', classIds)
            .not('score', 'is', null),
          supabase
            .from('teacher_announcement_targets')
            .select('class_id, teacher_announcements(id, title, message, created_at, link_url, attachment_url, attachment_name)')
            .in('class_id', classIds),
        ])

        const classNameById = Object.fromEntries(studentClasses.map((c) => [c.id, c.name]))
        const assignmentById = Object.fromEntries((assignmentRows || []).map((a) => [a.id, a]))
        const getAssignmentTitle = (assignment) => {
          const candidates = [
            assignment?.name,
            assignment?.title,
            assignment?.assignment_name,
            assignment?.assignment_title,
          ]
          const valid = candidates.find((value) => typeof value === 'string' && value.trim().length > 0)
          return valid ? valid.trim() : 'Assignment'
        }
        const assignmentItems = (assignmentGradeRows || [])
          .map((g) => {
            const assignment = assignmentById[g.assignment_id]
            if (!assignment) return null
            return {
              id: `assignment_${assignment.id}_${assignment.class_id}`,
              class_id: assignment.class_id,
              class_name: classNameById[assignment.class_id] || 'Class',
              term: assignment.term,
              item_name: getAssignmentTitle(assignment),
              item_type: 'assignment',
              score: g.score,
              max_points: assignment.max_points,
              sort_time: g.created_at || assignment.created_at || null,
            }
          })
          .filter(Boolean)

        const participationItems = (participationRows || [])
          .map((p) => ({
            id: `participation_${p.class_id}_${p.term}_${p.week}`,
            class_id: p.class_id,
            class_name: classNameById[p.class_id] || 'Class',
            term: p.term,
            item_name: `Participation - Week ${p.week}`,
            item_type: 'participation',
            score: p.score,
            max_points: 10,
            sort_time: null,
          }))
          .filter(Boolean)

        const gradedRows = [...assignmentItems, ...participationItems]
          .sort((a, b) => {
            if (a.sort_time && b.sort_time) {
              return new Date(b.sort_time).getTime() - new Date(a.sort_time).getTime()
            }
            if (a.sort_time) return -1
            if (b.sort_time) return 1
            return String(a.class_name).localeCompare(String(b.class_name), undefined, { numeric: true })
          })
          .slice(0, 12)

        const teacherAnnouncementsMerged = (teacherTargetRows || [])
          .map((row) => {
            const announcement = row.teacher_announcements
            if (!announcement) return null
            return {
              id: `teacher_${announcement.id}_${row.class_id}`,
              title: announcement.title,
              event_date: announcement.created_at,
              venue: classNameById[row.class_id] || 'Class',
              description: announcement.message,
              plan_url: null,
              link_url: announcement.link_url || null,
              attachment_url: announcement.attachment_url || null,
              attachment_name: announcement.attachment_name || null,
              label: 'Teacher Announcement',
            }
          })
          .filter(Boolean)

        const mergedAnnouncements = [...teacherAnnouncementsMerged]
          .sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime())
          .slice(0, 8)

        setStudentAnnouncements(mergedAnnouncements)
        setStudentGradedAssignments(gradedRows)
      } else {
        setStudentAnnouncements([])
        setStudentGradedAssignments([])
      }
      setTeacherAnnouncements([])
      setTeacherEvents([])
      setTeacherDeadlines([])
      setLoading(false)
      return
    }

    const currentWeek = getCurrentWeekIndex()
    
    const [{ data: classData }, { count: submittedPlanCount }, { data: dashboardItems }, { data: teacherAnnouncementRows }, { data: submittedReports }] = await Promise.all([
      supabase.from('classes').select('*').eq('teacher_id', profile.id).order('name'),
      supabase
        .from('weekly_plan_lessons')
        .select('id', { count: 'exact', head: true })
        .eq('week', currentWeek)
        .eq('status', 'submitted')
        .in('class_id', (await supabase.from('classes').select('id').eq('teacher_id', profile.id)).data?.map(c => c.id) || []),
      supabase
        .from('events_deadlines')
        .select('id, item_type, event_date, title, venue, description, plan_url')
        .gte('event_date', today)
        .order('event_date', { ascending: true })
        .order('created_at', { ascending: false }),
      supabase
        .from('teacher_announcements')
        .select('id, title, message, created_at, scope, link_url, attachment_url, attachment_name, teacher_announcement_targets(class_id, classes(name))')
        .eq('teacher_id', profile.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('behavior_reports')
        .select(`
          id,
          incident_date,
          incident_type,
          severity,
          description,
          action_taken,
          status,
          admin_notes,
          created_at,
          classes(name),
          students(student_id, name_eng, name_vn)
        `)
        .eq('reporter_id', profile.id)
        .order('incident_date', { ascending: false })
        .order('created_at', { ascending: false }),
    ])

    // Calculate teacher's incomplete weekly plan count
    let totalRequiredPlans = 0
    classData?.forEach(cls => {
      if (cls.subject === 'ESL') totalRequiredPlans += cls.programme === 'integrated' ? 6 : 4
      else if (cls.subject === 'Mathematics' || cls.subject === 'Science') totalRequiredPlans += cls.programme === 'bilingual' ? 3 : 2
      else if (cls.subject === 'Global Perspectives') totalRequiredPlans += 1
      else totalRequiredPlans += 1
    })
    setIncompleteWeeklyPlanCount(Math.max(0, totalRequiredPlans - (submittedPlanCount || 0)))

    const rows = dashboardItems || []
    const classList = classData || []

    let classCounts = {}
    if (classList.length > 0) {
      const classIds = classList.map(cls => cls.id)
      const { data: enrollmentRows } = await supabase
        .from('class_students')
        .select('class_id')
        .in('class_id', classIds)

      classCounts = (enrollmentRows || []).reduce((acc, row) => {
        acc[row.class_id] = (acc[row.class_id] || 0) + 1
        return acc
      }, {})
    }

    setClasses(classList.map(cls => ({
      ...cls,
      student_count: classCounts[cls.id] || 0,
    })))
    const ownAnnouncements = (teacherAnnouncementRows || []).map((row) => ({
      id: row.id,
      title: row.title,
      description: row.message,
      created_at: row.created_at,
      scope: row.scope,
      link_url: row.link_url || null,
      attachment_url: row.attachment_url || null,
      attachment_name: row.attachment_name || null,
      targets: (row.teacher_announcement_targets || []).map((target) => ({
        class_id: target.class_id,
        class_name: target.classes?.name || 'Class',
      })),
    }))
    setTeacherAnnouncements(ownAnnouncements)
    setTeacherSubmittedReports(submittedReports || [])
    setTeacherEvents(rows.filter(item => item.item_type === 'event'))
    setTeacherDeadlines(rows.filter(item => item.item_type === 'deadline'))
    setLoading(false)
  }

  const levelLabel = (l) => ({
    primary: 'Primary',
    lower_secondary: 'Lower Secondary',
    upper_secondary: 'Upper Secondary',
    high_school: 'High School',
  }[l] || l)

  const programmeLabel = (p) => p === 'bilingual' ? 'Bilingual' : 'Integrated'

  const programmeBadgeStyle = (p) => p === 'bilingual'
    ? 'bg-purple-100 text-purple-700'
    : 'bg-teal-100 text-teal-700'

  const extractGrade = (value) => {
    if (!value) return null
    const match = String(value).trim().match(/^(\d+)/)
    return match ? match[1] : null
  }

  const normalizeProgramme = (value) => {
    if (!value) return 'unknown'
    const v = String(value).trim().toLowerCase()
    if (v === 'bilingual') return 'bilingual'
    if (v === 'integrated') return 'integrated'
    return 'unknown'
  }

  const normalizeLevel = (value) => {
    if (!value) return null
    const v = String(value).trim().toLowerCase()
    if (v === 'primary') return 'primary'
    if (v === 'secondary' || v === 'lower_secondary' || v === 'upper_secondary' || v === 'high_school') {
      return 'secondary'
    }
    return v
  }

  const getHomeroom = (className) => {
    if (!className) return null
    return String(className).trim().split(/\s+/)[0] || null
  }

  const getUniqueClasses = () => {
    const byHomeroom = new Map()
    for (const cls of classes) {
      const homeroom = getHomeroom(cls.name)
      if (!homeroom) continue

      const grade = extractGrade(homeroom) || 'Unknown'
      const programme = normalizeProgramme(cls.programme)
      const level = cls.level || null

      const existing = byHomeroom.get(homeroom)
      if (!existing) {
        byHomeroom.set(homeroom, { homeroom, grade, programme, level })
        continue
      }

      // If programme differs across subject-rows for same homeroom, treat as unknown/mixed.
      if (existing.programme !== programme) {
        existing.programme = 'unknown'
      }
      if (!existing.level && level) {
        existing.level = level
      }
    }

    return Array.from(byHomeroom.values())
  }

  const getFilteredUniqueClasses = () => getUniqueClasses().filter(c =>
    (!levelFilter || normalizeLevel(c.level) === levelFilter) &&
    (gradeFilter === 'all' || c.grade === gradeFilter)
  )

  const getFilteredStudents = () => students.filter(student =>
    (!levelFilter || normalizeLevel(student.level) === levelFilter) &&
    (gradeFilter === 'all' || extractGrade(student.class) === gradeFilter)
  )

  const filteredUniqueClasses = getFilteredUniqueClasses()
  const filteredStudents = getFilteredStudents()

  const levelScopedClasses = classes.filter(c =>
    !levelFilter || normalizeLevel(c.level) === levelFilter
  )
  const levelScopedStudents = students.filter(s =>
    !levelFilter || normalizeLevel(s.level) === levelFilter
  )

  const gradeList = Array.from(new Set([
    ...levelScopedClasses.map(c => extractGrade(c.name)),
    ...levelScopedStudents.map(s => extractGrade(s.class)),
  ].filter(Boolean))).sort((a, b) => Number(a) - Number(b))

  const buildSnapshotByGrade = (items, getGrade, getProgramme) => {
    const byGrade = {}
    for (const item of items) {
      const grade = getGrade(item) || 'Unknown'
      const programme = normalizeProgramme(getProgramme(item))
      if (!byGrade[grade]) byGrade[grade] = { grade, total: 0, bilingual: 0, integrated: 0, unknown: 0 }
      byGrade[grade].total += 1
      if (programme === 'bilingual') byGrade[grade].bilingual += 1
      else if (programme === 'integrated') byGrade[grade].integrated += 1
      else byGrade[grade].unknown += 1
    }

    return Object.values(byGrade).sort((a, b) => {
      if (a.grade === 'Unknown') return 1
      if (b.grade === 'Unknown') return -1
      return Number(a.grade) - Number(b.grade)
    })
  }

  const classSnapshot = buildSnapshotByGrade(
    filteredUniqueClasses,
    c => c.grade,
    c => c.programme
  )

  const studentSnapshot = buildSnapshotByGrade(
    filteredStudents,
    s => extractGrade(s.class),
    s => s.programme
  )

  const totalUniqueClassCount = filteredUniqueClasses.length
  const totalStudentCount = filteredStudents.length

  const sumSnapshot = (rows) => rows.reduce((acc, r) => ({
    total: acc.total + r.total,
    bilingual: acc.bilingual + r.bilingual,
    integrated: acc.integrated + r.integrated,
    unknown: acc.unknown + r.unknown,
  }), { total: 0, bilingual: 0, integrated: 0, unknown: 0 })

  const classTotals = sumSnapshot(classSnapshot)
  const studentTotals = sumSnapshot(studentSnapshot)

  useEffect(() => {
    if (gradeFilter === 'all') return
    if (!gradeList.includes(gradeFilter)) {
      setGradeFilter('all')
    }
  }, [levelFilter, gradeFilter, gradeList])

  const CARD_ACCENT = {
    students: '#d1232a',
    classes: '#1f86c7',
    users: '#ffc612',
    resources: '#1f86c7',
    eventsDeadlines: '#d1232a',
    behavior: '#1f86c7',
    class: '#d1232a',
    events: '#1f86c7',
    deadlines: '#ffc612',
  }

  const formatDateWithDay = (value) => {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    })
  }

  const formatTermLabel = (value) => {
    const termText = String(value || '')
      .replaceAll('_', ' ')
      .trim()
      .toLowerCase()
    if (!termText) return ''
    return termText
      .split(' ')
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const postTeacherAnnouncement = async (forcedClassIds = null, forcedScope = null, silent = false) => {
    if (!silent) setAnnouncementFeedback(null)

    const targetScope = forcedScope || announcementScope
    const targetClassIds = forcedClassIds || (
      targetScope === 'all_my_classes'
        ? classes.map((c) => c.id)
        : announcementClassIds
    )

    if (!announcementTitle.trim() || !announcementMessage.trim()) {
      if (!silent) setAnnouncementFeedback({ type: 'error', text: 'Please enter both title and message.' })
      return
    }

    if (!targetClassIds || targetClassIds.length === 0) {
      if (!silent) setAnnouncementFeedback({ type: 'error', text: 'Please select at least one class target.' })
      return
    }

    setPostingAnnouncement(true)
    const linkUrl = normalizeLinkUrl(announcementLinkUrl)

    const { data: announcement, error: announcementError } = await supabase
      .from('teacher_announcements')
      .insert({
        teacher_id: profile.id,
        title: announcementTitle.trim(),
        message: announcementMessage.trim(),
        scope: targetScope,
        link_url: linkUrl,
      })
      .select('id')
      .single()

    if (announcementError || !announcement?.id) {
      setPostingAnnouncement(false)
      if (!silent) {
        setAnnouncementFeedback({
          type: 'error',
          text: `Unable to post announcement: ${announcementError?.message || 'Unknown error'}`,
        })
      }
      return
    }

    const targetRows = Array.from(new Set(targetClassIds)).map((classId) => ({
      announcement_id: announcement.id,
      class_id: classId,
    }))

    const { error: targetError } = await supabase
      .from('teacher_announcement_targets')
      .insert(targetRows)

    if (targetError) {
      setPostingAnnouncement(false)
      if (!silent) {
        setAnnouncementFeedback({
          type: 'error',
          text: `Announcement saved, but class targets failed: ${targetError.message}`,
        })
      }
      return
    }

    let showAnnouncementSuccess = true

    if (announcementPdfFile) {
      const { path, displayName, error: uploadError } = await uploadTeacherAnnouncementPdf(
        announcement.id,
        announcementPdfFile
      )
      if (uploadError || !path) {
        setPostingAnnouncement(false)
        if (!silent) {
          setAnnouncementFeedback({
            type: 'error',
            text: `Announcement posted, but the PDF could not be uploaded: ${uploadError?.message || 'Unknown error'}`,
          })
        }
        setAnnouncementTitle('')
        setAnnouncementMessage('')
        setAnnouncementLinkUrl('')
        setAnnouncementPdfFile(null)
        if (announcementPdfInputRef.current) announcementPdfInputRef.current.value = ''
        setAnnouncementScope('all_my_classes')
        setAnnouncementClassIds([])
        await fetchDashboardData()
        return
      }
      const { error: attachError } = await supabase
        .from('teacher_announcements')
        .update({ attachment_url: path, attachment_name: displayName })
        .eq('id', announcement.id)
        .eq('teacher_id', profile.id)

      if (attachError && !silent) {
        setAnnouncementFeedback({
          type: 'error',
          text: `Announcement posted, but saving the attachment failed: ${attachError.message}`,
        })
        showAnnouncementSuccess = false
      }
    }

    setPostingAnnouncement(false)

    setAnnouncementTitle('')
    setAnnouncementMessage('')
    setAnnouncementLinkUrl('')
    setAnnouncementPdfFile(null)
    if (announcementPdfInputRef.current) announcementPdfInputRef.current.value = ''
    setAnnouncementScope('all_my_classes')
    setAnnouncementClassIds([])
    await fetchDashboardData()

    if (!silent && showAnnouncementSuccess) {
      setAnnouncementFeedback({ type: 'success', text: 'Announcement posted successfully.' })
    }
  }

  const fetchBehaviorStudents = async (classId) => {
    if (!classId) {
      setBehaviorStudents([])
      return
    }
    const { data } = await supabase
      .from('class_students')
      .select('student_id, students(id, name_eng, name_vn, student_id)')
      .eq('class_id', classId)

    const list = (data || [])
      .map((row) => row.students)
      .filter(Boolean)
      .sort((a, b) => (a.name_eng || '').localeCompare(b.name_eng || ''))
    setBehaviorStudents(list)
  }

  const submitBehaviorReportInline = async (e) => {
    e.preventDefault()
    if (!behaviorForm.class_id || !behaviorForm.student_id || !behaviorForm.incident_date || !behaviorForm.description.trim()) {
      setBehaviorMessage({ type: 'error', text: 'Please complete class, student, date, and description.' })
      return
    }

    setSavingBehaviorReport(true)
    const payload = {
      reporter_id: profile.id,
      class_id: behaviorForm.class_id,
      student_id: behaviorForm.student_id,
      incident_date: behaviorForm.incident_date,
      incident_type: behaviorForm.incident_type,
      severity: behaviorForm.severity,
      description: behaviorForm.description.trim(),
      action_taken: behaviorForm.action_taken.trim() || null,
      status: 'new',
    }

    const { error } = await supabase.from('behavior_reports').insert(payload)
    if (error) {
      setBehaviorMessage({ type: 'error', text: error.message })
      setSavingBehaviorReport(false)
      return
    }

    setBehaviorMessage({ type: 'success', text: 'Behavior report submitted for admin review.' })
    setBehaviorForm({
      class_id: '',
      student_id: '',
      incident_date: new Date().toISOString().slice(0, 10),
      incident_type: 'Disruption',
      severity: 'Medium',
      description: '',
      action_taken: '',
    })
    setBehaviorStudents([])
    setSavingBehaviorReport(false)
    await fetchDashboardData()
  }

  return (
    <Layout>
      {loading ? (
        <div className="text-center text-gray-400 py-10">Loading...</div>
      ) : profile?.role === 'admin' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left column — Admin tools */}
          <div className="lg:col-span-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Admin Tools</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card 1 - RED */}
              <Link
                to="/admin/students"
                className="relative bg-white rounded-xl border border-gray-200 p-6 hover:shadow-sm transition-all block min-h-[120px]"
                style={{ borderTopColor: '#d1232a', borderTopWidth: 3 }}
              >
                {newStudentPasswordResetCount > 0 && (
                  <span className="absolute top-3 right-3 min-w-[1.5rem] h-6 px-2 rounded-full bg-red-600 text-white text-xs font-semibold flex items-center justify-center">
                    {newStudentPasswordResetCount}
                  </span>
                )}
                <div className="font-semibold text-gray-900">Student Management</div>
                <div className="text-sm text-gray-500 mt-1">Add, edit or remove student accounts.</div>
              </Link>
              {/* Card 2 - BLUE */}
              <Link
                to="/admin/classes"
                className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-sm transition-all block min-h-[120px]"
                style={{ borderTopColor: '#1f86c7', borderTopWidth: 3 }}
              >
                <div className="font-semibold text-gray-900">Class Management</div>
                <div className="text-sm text-gray-500 mt-1">Add, edit or remove classes.</div>
              </Link>
              {/* Card 3 - YELLOW */}
              <Link
                to="/admin/users"
                className="relative bg-white rounded-xl border border-gray-200 p-6 hover:shadow-sm transition-all block min-h-[120px]"
                style={{ borderTopColor: '#ffc612', borderTopWidth: 3 }}
              >
                {newTeacherPasswordResetCount > 0 && (
                  <span className="absolute top-3 right-3 min-w-[1.5rem] h-6 px-2 rounded-full bg-red-600 text-white text-xs font-semibold flex items-center justify-center">
                    {newTeacherPasswordResetCount}
                  </span>
                )}
                <div className="font-semibold text-gray-900">Teacher Management</div>
                <div className="text-sm text-gray-500 mt-1">View, add, edit or remove teacher accounts.</div>
              </Link>
              {/* Card 4 - RED */}
              <Link
                to="/admin/resources"
                className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-sm transition-all block min-h-[120px]"
                style={{ borderTopColor: '#d1232a', borderTopWidth: 3 }}
              >
                <div className="font-semibold text-gray-900">Resource Management</div>
                <div className="text-sm text-gray-500 mt-1">Add, edit or remove resources.</div>
              </Link>
              {/* Card 5 - BLUE */}
              <Link
                to="/admin/events-deadlines"
                className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-sm transition-all block min-h-[120px]"
                style={{ borderTopColor: '#1f86c7', borderTopWidth: 3 }}
              >
                <div className="font-semibold text-gray-900">Event & Admin Deadline Management</div>
                <div className="text-sm text-gray-500 mt-1">Add, edit or remove events and deadlines.</div>
              </Link>
              {/* Card 6 - YELLOW */}
              <Link
                to="/admin/behavior-management"
                className="relative bg-white rounded-xl border border-gray-200 p-6 hover:shadow-sm transition-all block min-h-[120px]"
                style={{ borderTopColor: '#ffc612', borderTopWidth: 3 }}
              >
                {newBehaviorReportsCount > 0 && (
                  <span className="absolute top-3 right-3 min-w-[1.5rem] h-6 px-2 rounded-full bg-red-600 text-white text-xs font-semibold flex items-center justify-center">
                    {newBehaviorReportsCount}
                  </span>
                )}
                <div className="font-semibold text-gray-900">Behavior Management</div>
                <div className="text-sm text-gray-500 mt-1">Review teacher behavior reports and follow-up actions.</div>
              </Link>
              {/* Card 7 - RED */}
              <Link
                to="/admin/gradebooks"
                className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-sm transition-all block min-h-[120px]"
                style={{ borderTopColor: '#d1232a', borderTopWidth: 3 }}
                onClick={e => {
                  const hasUnsaved = sessionStorage.getItem('gradebook_unsaved_changes') === '1'
                  if (hasUnsaved && !window.confirm('You have unsaved gradebook changes. Please click Save before leaving this page. Continue anyway?')) {
                    e.preventDefault()
                  }
                }}
              >
                <div className="font-semibold text-gray-900">Gradebook Management</div>
                <div className="text-sm text-gray-500 mt-1">Review termly gradebooks for each class.</div>
              </Link>
              {/* Card 8 - BLUE */}
               <Link
                 to="/weekly-plans"
                 className="relative bg-white rounded-xl border border-gray-200 p-6 hover:shadow-sm transition-all block min-h-[120px]"
                 style={{ borderTopColor: '#1f86c7', borderTopWidth: 3 }}
               >
                 {incompleteWeeklyPlanCount > 0 && (
                   <span className="absolute top-3 right-3 min-w-[1.5rem] h-6 px-2 rounded-full bg-red-600 text-white text-xs font-semibold flex items-center justify-center">
                     {incompleteWeeklyPlanCount}
                   </span>
                 )}
                 <div className="font-semibold text-gray-900">Weekly Plan Management</div>
                 <div className="text-sm text-gray-500 mt-1">Monitor weekly plan completion for all classes.</div>
               </Link>
            </div>
          </div>

          {/* Right column — Insights */}
          <div className="lg:col-span-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Campus Statistics</h3>
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex flex-wrap items-end gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">Level</label>
                    <select
                      value={levelFilter}
                      onChange={e => {
                        setLevelFilter(e.target.value)
                        setGradeFilter('all')
                      }}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Level</option>
                      <option value="primary">Primary</option>
                      <option value="secondary">Secondary</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">Grade</label>
                    <select
                      value={gradeFilter}
                      onChange={e => setGradeFilter(e.target.value)}
                      disabled={!levelFilter}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      <option value="all">{!levelFilter ? 'Select level first' : 'All Grades'}</option>
                      {gradeList.map(g => (
                        <option key={g} value={g}>Grade {g}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <button
                      onClick={() => setShowDebugControls(!showDebugControls)}
                      className="text-[10px] px-2 py-1 rounded border border-gray-300 text-gray-500 hover:bg-gray-50"
                    >
                      {showDebugControls ? 'Hide Debug' : 'Show Debug'}
                    </button>
                  </div>
                </div>

                {showDebugControls && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <label className="text-xs font-medium text-gray-500 block mb-1">
                          System Week Override
                          {sessionStorage.getItem('debug_week_override') !== null && (
                            <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
                              ACTIVE
                            </span>
                          )}
                        </label>
                        <div className="flex gap-2">
                          <select
                            value={debugWeekOverride}
                            onChange={e => setDebugWeekOverride(Number(e.target.value))}
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {ALL_WEEKS.map((weekItem, idx) => (
                              <option key={weekItem.week} value={idx}>
                                {weekItem.label} — {weekItem.range}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => {
                              sessionStorage.setItem('debug_week_override', String(debugWeekOverride))
                              fetchDashboardData()
                            }}
                            className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
                          >
                            Apply
                          </button>
                          <button
                            onClick={() => {
                              sessionStorage.removeItem('debug_week_override')
                              setDebugWeekOverride(getCurrentWeekIndex())
                              fetchDashboardData()
                            }}
                            className="px-3 py-2 rounded-lg bg-gray-200 text-gray-700 text-sm hover:bg-gray-300"
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2">
                      Select a week to override the entire system. All pages and features will react as if it is this week.
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <SnapshotCard
                  title="Classes Snapshot"
                  color="#1f86c7"
                  totals={classTotals}
                  metricColors={{
                    total: '#d1232a',
                    bilingual: '#1f86c7',
                    integrated: '#ffc612',
                  }}
                />
                <SnapshotCard
                  title="Students Snapshot"
                  color="#d1232a"
                  totals={studentTotals}
                  metricColors={{
                    total: '#d1232a',
                    bilingual: '#1f86c7',
                    integrated: '#ffc612',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      ) : profile?.role === 'student' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
           <div className="bg-white rounded-xl border border-gray-200 p-5 h-full" style={{ borderTopColor: CARD_ACCENT.class, borderTopWidth: 3 }}>
             <h3 className="text-lg font-semibold text-gray-900 mb-4">My Classes</h3>
             <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
               {classes.length === 0 ? (
                 <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
                   No classes assigned yet. Please contact your administrator.
                 </div>
               ) : (
                 classes.map(cls => (
                   <Link
                     key={cls.id}
                     to={`/student/class/${cls.id}`}
                     className="block bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-all"
                     style={{ borderTopColor: '#9ca3af', borderTopWidth: 3 }}
                   >
                     <div className="font-semibold text-gray-900">{cls.name}</div>
                     <div className="text-sm text-gray-500 mt-1">
                       {levelLabel(cls.level)} - {programmeLabel(cls.programme)}
                     </div>
                     <div className="text-xs text-gray-400 mt-2">
                       Teacher: {cls.teacher_name || 'TBA'}
                     </div>
                   </Link>
                 ))
               )}
             </div>
           </div>

           <div className="space-y-4">
             <div className="bg-white rounded-xl border border-gray-200 p-5" style={{ borderTopColor: CARD_ACCENT.events, borderTopWidth: 3 }}>
               <h3 className="text-lg font-semibold text-gray-900 mb-1">Announcements</h3>
               <p className="text-xs text-gray-500 mb-3">Class updates from your teachers.</p>
               <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
                 {studentAnnouncements.length === 0 ? (
                   <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                     No announcements posted yet.
                   </div>
                 ) : studentAnnouncements.map(item => (
                   <button
                     key={item.id}
                     type="button"
                     onClick={() => setSelectedDashboardItem({ ...item, label: item.label || 'Announcement' })}
                     className="w-full text-left rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 hover:bg-blue-50 transition-colors"
                   >
                     <div className="text-sm font-medium text-gray-800">{item.title}</div>
                     <div className="text-xs text-gray-500 mt-0.5">{formatDateWithDay(item.event_date)}</div>
                   </button>
                 ))}
               </div>
             </div>

             <Link
               to="/weekly-plans"
               className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-all block"
               style={{ borderTopColor: '#1f86c7', borderTopWidth: 3 }}
             >
               <h3 className="text-lg font-semibold text-gray-900 mb-2">Weekly Plans</h3>
               <p className="text-xs text-gray-500 mb-4">View weekly lesson plans for all your classes</p>
               <div className="w-full rounded-lg text-white px-4 py-2 text-sm font-medium text-center" style={{ backgroundColor: 'rgb(31, 134, 199)' }}>
                 Open Weekly Plans
               </div>
             </Link>
           </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 h-full" style={{ borderTopColor: CARD_ACCENT.deadlines, borderTopWidth: 3 }}>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Graded Assignments</h3>
            <p className="text-xs text-gray-500 mb-3">Newly marked assignments. Click to open your class gradebook term.</p>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {studentGradedAssignments.length === 0 ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                  No graded assignments posted yet.
                </div>
              ) : studentGradedAssignments.map(item => (
                <Link
                  key={item.id}
                  to={`/student/class/${item.class_id}?term=${encodeURIComponent(item.term || 'midterm_1')}`}
                  className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 hover:bg-amber-50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 text-left">
                      <div className="text-sm font-medium text-gray-800 truncate">{item.item_name || 'Assignment'}</div>
                      <div className="text-xs text-gray-500 mt-0.5 truncate">
                        {item.class_name} - {formatTermLabel(item.term)}
                      </div>
                    </div>
                    <div className="shrink-0 w-14 h-14 rounded-md border border-gray-300 bg-white text-[11px] leading-tight font-semibold text-gray-700 flex items-center justify-center text-center px-1">
                      {item.max_points ? `${item.score}/${item.max_points}` : item.score}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              
              {/* LEFT COLUMN: My Classes ONLY */}
              <div className="bg-white rounded-xl border border-gray-200 p-5" style={{ borderTopColor: CARD_ACCENT.class, borderTopWidth: 3 }}>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">My Classes</h3>
                <div className="space-y-3">
                  {classes.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
                      No classes assigned yet. Contact your administrator.
                    </div>
                  ) : (
                    classes.map(cls => (
                      <Link
                        key={cls.id}
                        to={`/class/${cls.id}`}
                        className="block bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-all"
                        style={{ borderTopColor: '#9ca3af', borderTopWidth: 2 }}
                      >
                        <div className="font-semibold text-gray-900">{cls.name}</div>
                        <div className="text-sm text-gray-500 mt-1">
                          {levelLabel(cls.level)} - {programmeLabel(cls.programme)}
                        </div>
                        <div className="text-xs text-gray-400 mt-2">
                          {cls.student_count || 0} students
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: All other modules stacked vertically */}
              <div className="space-y-4">

                {/* 1. Admin Deadlines */}
                <div className="bg-white rounded-xl border border-gray-200 p-5" style={{ borderTopColor: CARD_ACCENT.deadlines, borderTopWidth: 3 }}>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Admin Deadlines</h3>
                  <div className="space-y-2">
                    {teacherDeadlines.length === 0 ? (
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                        No upcoming deadlines yet. Admin updates will appear here.
                      </div>
                    ) : teacherDeadlines.map(deadlineItem => {
                      const today = new Date()
                      today.setHours(0, 0, 0, 0)
                      const deadlineDate = new Date(deadlineItem.event_date)
                      deadlineDate.setHours(0, 0, 0, 0)
                      const daysRemaining = Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24))
                      
                      let statusColor = 'bg-gray-100 text-gray-600'
                      if (daysRemaining < 0) statusColor = 'bg-gray-300 text-gray-700'
                      else if (daysRemaining <= 2) statusColor = 'bg-red-100 text-red-700'
                      else if (daysRemaining <= 5) statusColor = 'bg-amber-100 text-amber-700'
                      else statusColor = 'bg-green-100 text-green-700'

                      return (
                        <button
                          key={deadlineItem.id}
                          type="button"
                          onClick={() => setSelectedDashboardItem({ ...deadlineItem, label: 'Admin Deadline' })}
                          className="w-full text-left rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 hover:bg-amber-50 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-gray-800">{deadlineItem.title}</div>
                              <div className="text-xs text-gray-500 mt-0.5">{formatDateWithDay(deadlineItem.event_date)}</div>
                            </div>
                            <span className="shrink-0 text-xs text-gray-500 flex items-center gap-1">
                              Days remaining: <span className={`font-semibold px-2 py-0.5 rounded-full ${statusColor}`}>
                                {daysRemaining < 0 ? 'Past' : daysRemaining === 0 ? 'Today' : `${daysRemaining}d`}
                              </span>
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* 2. Weekly Plans */}
                <Link
                  to="/weekly-plans"
                  className="relative bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-all block"
                  style={{ borderTopColor: '#1f86c7', borderTopWidth: 3 }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Weekly Plans</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">Lessons remaining to complete:</span>
                      {incompleteWeeklyPlanCount > 0 ? (
                        <span className="min-w-[1.5rem] h-6 px-2 rounded-full bg-red-600 text-white text-xs font-semibold flex items-center justify-center">
                          {incompleteWeeklyPlanCount}
                        </span>
                      ) : (
                        <span className="text-sm text-green-600 font-medium">All submitted ✓</span>
                      )}
                    </div>
                  </div>
                  <div className="w-full rounded-lg text-white px-4 py-2.5 text-sm font-medium text-center" style={{ backgroundColor: 'rgb(31, 134, 199)' }}>
                    Complete weekly plans now!
                  </div>
                </Link>

                {/* 3. Class Announcements */}
                <div className="bg-white rounded-xl border border-gray-200 p-5" style={{ borderTopColor: '#22c55e', borderTopWidth: 3 }}>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Class Announcements</h3>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <button
                      type="button"
                      onClick={() => setShowTeacherAnnouncements(showTeacherAnnouncements === 'create' ? null : 'create')}
                      className="py-2 px-4 rounded-lg text-white text-sm font-medium transition-colors"
                      style={{ backgroundColor: 'rgb(31, 134, 199)' }}
                    >
                      Create new
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowTeacherAnnouncements(showTeacherAnnouncements === 'view' ? null : 'view')}
                      className="py-2 px-4 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors"
                    >
                      View all announcements
                    </button>
                  </div>

                  {showTeacherAnnouncements === 'create' && (
                    <div className="flex flex-col gap-3 mt-2 pt-4 border-t border-gray-100">
                      <div>
                        <label htmlFor="dashboard-announcement-title" className="block text-xs font-medium text-gray-500 mb-1">
                          Title
                        </label>
                        <input
                          id="dashboard-announcement-title"
                          type="text"
                          value={announcementTitle}
                          onChange={(e) => setAnnouncementTitle(e.target.value)}
                          placeholder="Short headline"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                        />
                      </div>
                      <div>
                        <label htmlFor="dashboard-announcement-message" className="block text-xs font-medium text-gray-500 mb-1">
                          Message
                        </label>
                        <textarea
                          id="dashboard-announcement-message"
                          value={announcementMessage}
                          onChange={(e) => setAnnouncementMessage(e.target.value)}
                          placeholder="Write your announcement..."
                          className="w-full min-h-[8rem] max-h-[min(24rem,50vh)] rounded-lg border border-gray-300 px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-200"
                        />
                      </div>
                      <div>
                        <label htmlFor="dashboard-announcement-link" className="block text-xs font-medium text-gray-500 mb-1">
                          Link (optional)
                        </label>
                        <input
                          id="dashboard-announcement-link"
                          type="text"
                          inputMode="url"
                          autoComplete="url"
                          value={announcementLinkUrl}
                          onChange={(e) => setAnnouncementLinkUrl(e.target.value)}
                          placeholder="e.g. Google Drive or class resource"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                        />
                      </div>
                      <div>
                        <label htmlFor="dashboard-announcement-pdf" className="block text-xs font-medium text-gray-500 mb-1">
                          PDF attachment (optional)
                        </label>
                        <input
                          id="dashboard-announcement-pdf"
                          ref={announcementPdfInputRef}
                          type="file"
                          accept="application/pdf"
                          className="block w-full text-xs text-gray-600 file:mr-2 file:rounded file:border-0 file:bg-gray-100 file:px-2 file:py-1 file:text-sm"
                          onChange={(e) => {
                            const f = e.target.files?.[0] || null
                            setAnnouncementPdfFile(f)
                          }}
                        />
                        {announcementPdfFile && (
                          <div className="text-xs text-gray-500 mt-1 truncate" title={announcementPdfFile.name}>
                            {announcementPdfFile.name}
                          </div>
                        )}
                      </div>
                      {announcementFeedback && (
                        <div
                          className={`text-xs px-2 py-1 rounded border ${
                            announcementFeedback.type === 'success'
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : 'bg-red-50 text-red-700 border-red-200'
                          }`}
                        >
                          {announcementFeedback.text}
                        </div>
                      )}
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <div className="text-xs font-medium text-gray-600 mb-2">Classes</div>
                        <label className="flex items-center gap-2 py-1.5 text-sm text-gray-700 border-b border-gray-200 pb-2 mb-1">
                          <input
                            type="checkbox"
                            checked={announcementClassIds.length === classes.length && classes.length > 0}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setAnnouncementClassIds(classes.map((c) => c.id))
                              } else {
                                setAnnouncementClassIds([])
                              }
                            }}
                          />
                          <span className="font-medium">Select All</span>
                        </label>
                        {classes.length === 0 ? (
                          <div className="text-xs text-gray-500 py-2">No classes available.</div>
                        ) : (
                          classes.map((cls) => (
                            <label key={cls.id} className="flex items-center gap-2 py-1.5 text-sm text-gray-700">
                              <input
                                type="checkbox"
                                checked={announcementClassIds.includes(cls.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    const newList = [...announcementClassIds, cls.id]
                                    setAnnouncementClassIds(newList)
                                  } else {
                                    const newList = announcementClassIds.filter((id) => id !== cls.id)
                                    setAnnouncementClassIds(newList)
                                  }
                                }}
                              />
                              <span>{cls.name}</span>
                            </label>
                          ))
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => postTeacherAnnouncement()}
                        disabled={postingAnnouncement}
                        className="w-full rounded-lg bg-green-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-green-700 disabled:opacity-60"
                      >
                        {postingAnnouncement ? 'Posting...' : 'Post Announcement'}
                      </button>
                    </div>
                  )}

                  {showTeacherAnnouncements === 'view' && (
                    <div className="mt-2 pt-4 border-t border-gray-100 space-y-2 max-h-[20rem] overflow-y-auto">
                      {teacherAnnouncements.length === 0 ? (
                        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                          No announcements posted yet.
                        </div>
                      ) : teacherAnnouncements.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSelectedDashboardItem({
                            title: item.title,
                            event_date: item.created_at,
                            label: 'Teacher Announcement',
                            venue: item.targets.map((t) => t.class_name).join(', ') || '—',
                            description: item.description,
                            plan_url: null,
                            link_url: item.link_url,
                            attachment_url: item.attachment_url,
                            attachment_name: item.attachment_name,
                          })}
                          className="w-full text-left rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 hover:bg-green-50 transition-colors"
                        >
                          <div className="text-sm font-medium text-gray-800">{item.title}</div>
                          <div className="text-xs text-gray-500 mt-1">{formatDateWithDay(item.created_at)}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            Sent to: {item.targets.map((t) => t.class_name).join(', ')}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 4. Behavior Report Tool */}
                <div className="bg-white rounded-xl border border-gray-200 p-5" style={{ borderTopColor: '#d1232a', borderTopWidth: 3 }}>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Behavior Report Tool</h3>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <button
                      type="button"
                      onClick={() => setShowTeacherSubmissions(showTeacherSubmissions === 'create' ? null : 'create')}
                      className="py-2 px-4 rounded-lg text-white text-sm font-medium transition-colors"
                      style={{ backgroundColor: 'rgb(31, 134, 199)' }}
                    >
                      Create new
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowTeacherSubmissions(showTeacherSubmissions === 'view' ? null : 'view')}
                      className="py-2 px-4 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors"
                    >
                      View all reports
                    </button>
                  </div>

                  {showTeacherSubmissions === 'create' && (
                    <form onSubmit={submitBehaviorReportInline} className="flex flex-col gap-3 mt-2 pt-4 border-t border-gray-100">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <select
                          value={behaviorForm.class_id}
                          onChange={async (e) => {
                            const classId = e.target.value
                            setBehaviorForm((prev) => ({ ...prev, class_id: classId, student_id: '' }))
                            await fetchBehaviorStudents(classId)
                          }}
                          className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
                        >
                          <option value="">Select class</option>
                          {classes.map((cls) => (
                            <option key={cls.id} value={cls.id}>{cls.name}</option>
                          ))}
                        </select>
                        <select
                          value={behaviorForm.student_id}
                          onChange={(e) => setBehaviorForm((prev) => ({ ...prev, student_id: e.target.value }))}
                          disabled={!behaviorForm.class_id}
                          className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white disabled:bg-gray-100 disabled:text-gray-400"
                        >
                          <option value="">{behaviorForm.class_id ? 'Select student' : 'Select class first'}</option>
                          {behaviorStudents.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name_eng}{s.name_vn ? ` - ${s.name_vn}` : ''} ({s.student_id})
                            </option>
                          ))}
                        </select>
                        <input
                          type="date"
                          value={behaviorForm.incident_date}
                          onChange={(e) => setBehaviorForm((prev) => ({ ...prev, incident_date: e.target.value }))}
                          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        />
                        <select
                          value={behaviorForm.severity}
                          onChange={(e) => setBehaviorForm((prev) => ({ ...prev, severity: e.target.value }))}
                          className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
                        >
                          {SEVERITY_LEVELS.map((level) => (
                            <option key={level} value={level}>{level}</option>
                          ))}
                        </select>
                      </div>
                      <select
                        value={behaviorForm.incident_type}
                        onChange={(e) => setBehaviorForm((prev) => ({ ...prev, incident_type: e.target.value }))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
                      >
                        {INCIDENT_TYPES.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                      <textarea
                        value={behaviorForm.description}
                        onChange={(e) => setBehaviorForm((prev) => ({ ...prev, description: e.target.value }))}
                        className="w-full min-h-[8rem] rounded-lg border border-gray-300 px-3 py-2 text-sm resize-y"
                        placeholder="Describe what happened..."
                      />
                      <textarea
                        rows={2}
                        value={behaviorForm.action_taken}
                        onChange={(e) => setBehaviorForm((prev) => ({ ...prev, action_taken: e.target.value }))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        placeholder="Action taken (optional)"
                      />
                      {behaviorMessage && (
                        <div className={`text-xs px-2 py-1 rounded border ${
                          behaviorMessage.type === 'success'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}>
                          {behaviorMessage.text}
                        </div>
                      )}
                      <button
                        type="submit"
                        disabled={savingBehaviorReport}
                        className="w-full rounded-lg bg-green-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-green-700 disabled:opacity-60"
                      >
                        {savingBehaviorReport ? 'Submitting...' : 'Submit Report'}
                      </button>
                    </form>
                  )}

                  {showTeacherSubmissions === 'view' && (
                    <div className="mt-2 pt-4 border-t border-gray-100 space-y-2 max-h-[20rem] overflow-y-auto">
                      {teacherSubmittedReports.length === 0 ? (
                        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                          No reports submitted yet.
                        </div>
                      ) : teacherSubmittedReports.map((report) => (
                        <button
                          key={report.id}
                          type="button"
                          onClick={() => setSelectedBehaviorSubmission(report)}
                          className="w-full text-left rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 hover:bg-red-50 transition-colors"
                        >
                          <div className="text-sm font-medium text-gray-800">{report.students?.name_eng || 'Student'}</div>
                          <div className="text-xs text-gray-500 mt-1">{report.incident_date} • {report.incident_type} / {report.severity}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            Status: {report.status}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 5. Events */}
                <div className="bg-white rounded-xl border border-gray-200 p-5" style={{ borderTopColor: CARD_ACCENT.events, borderTopWidth: 3 }}>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Events</h3>
                  <div className="space-y-2">
                    {teacherEvents.length === 0 ? (
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                        No upcoming events yet. Admin updates will appear here.
                      </div>
                    ) : teacherEvents.map(eventItem => {
                      const today = new Date()
                      today.setHours(0, 0, 0, 0)
                      const eventDate = new Date(eventItem.event_date)
                      eventDate.setHours(0, 0, 0, 0)
                      const daysUntil = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24))
                      
                      let statusColor = 'bg-gray-100 text-gray-600'
                      if (daysUntil < 0) statusColor = 'bg-gray-300 text-gray-700'
                      else if (daysUntil <= 2) statusColor = 'bg-red-100 text-red-700'
                      else if (daysUntil <= 5) statusColor = 'bg-amber-100 text-amber-700'
                      else statusColor = 'bg-green-100 text-green-700'

                      return (
                        <button
                          key={eventItem.id}
                          type="button"
                          onClick={() => setSelectedDashboardItem({ ...eventItem, label: 'Event' })}
                          className="w-full text-left rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 hover:bg-blue-50 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-gray-800">{eventItem.title}</div>
                              <div className="text-xs text-gray-500 mt-0.5">{formatDateWithDay(eventItem.event_date)}</div>
                            </div>
                            <span className="shrink-0 text-xs text-gray-500 flex items-center gap-1">
                              Days until: <span className={`font-semibold px-2 py-0.5 rounded-full ${statusColor}`}>
                                {daysUntil < 0 ? 'Past' : daysUntil === 0 ? 'Today' : `${daysUntil}d`}
                              </span>
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

              </div>
            </div>
          </div>
        </>
      )}

      {selectedBehaviorSubmission && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
          <div className="w-full max-w-lg bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="text-base font-semibold text-gray-900">Behavior Report Details</h4>
                <p className="text-xs text-gray-500 mt-1">
                  Submitted {selectedBehaviorSubmission.incident_date} • Status: {selectedBehaviorSubmission.status}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBehaviorSubmission(null)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close behavior report details"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <div>
                <div className="text-xs font-medium text-gray-500">Student</div>
                <div className="text-gray-800">
                  {selectedBehaviorSubmission.students?.name_eng || 'Student'}
                  {selectedBehaviorSubmission.students?.name_vn ? ` - ${selectedBehaviorSubmission.students.name_vn}` : ''}
                  {selectedBehaviorSubmission.students?.student_id ? ` (${selectedBehaviorSubmission.students.student_id})` : ''}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500">Class</div>
                <div className="text-gray-800">{selectedBehaviorSubmission.classes?.name || 'Class'}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500">Incident Type / Severity</div>
                <div className="text-gray-800">{selectedBehaviorSubmission.incident_type} / {selectedBehaviorSubmission.severity}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500">Description</div>
                <div className="text-gray-800 whitespace-pre-wrap">{selectedBehaviorSubmission.description || '—'}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500">Action Taken</div>
                <div className="text-gray-800 whitespace-pre-wrap">{selectedBehaviorSubmission.action_taken || '—'}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500">Admin Reply</div>
                <div className="text-gray-800 whitespace-pre-wrap">{selectedBehaviorSubmission.admin_notes || 'No admin reply yet'}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedDashboardItem && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
          <div className="w-full max-w-md bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="text-base font-semibold text-gray-900">{selectedDashboardItem.title}</h4>
                <p className="text-xs text-gray-500 mt-1">
                  {selectedDashboardItem.label} • {formatDateWithDay(selectedDashboardItem.event_date)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDashboardItem(null)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close details"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <div>
                <div className="text-xs font-medium text-gray-500">Location / Venue</div>
                <div className="text-gray-800">{selectedDashboardItem.venue || '—'}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500">Description</div>
                <div className="text-gray-800 whitespace-pre-wrap">{selectedDashboardItem.description || '—'}</div>
              </div>
              {selectedDashboardItem.label === 'Teacher Announcement' ? (
                <>
                  <div>
                    <div className="text-xs font-medium text-gray-500">Link</div>
                    {selectedDashboardItem.link_url ? (
                      <a
                        href={selectedDashboardItem.link_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline break-all"
                      >
                        {selectedDashboardItem.link_url}
                      </a>
                    ) : (
                      <div className="text-gray-400">—</div>
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-500">PDF attachment</div>
                    {selectedDashboardItem.attachment_url ? (
                      <AnnouncementPdfButton
                        storagePath={selectedDashboardItem.attachment_url}
                        fileName={selectedDashboardItem.attachment_name}
                      />
                    ) : (
                      <div className="text-gray-400">—</div>
                    )}
                  </div>
                </>
              ) : (
                <div>
                  <div className="text-xs font-medium text-gray-500">Planning Link</div>
                  {selectedDashboardItem.plan_url ? (
                    <a
                      href={selectedDashboardItem.plan_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline break-all"
                    >
                      {selectedDashboardItem.plan_url}
                    </a>
                  ) : (
                    <div className="text-gray-400">—</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

function SnapshotCard({ title, color, totals, metricColors }) {
  const cardStyle = (hex) => ({
    borderColor: hex,
    backgroundColor: `${hex}1A`, // subtle tint
  })

  const valueStyle = (hex) => ({ color: hex })

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5" style={{ borderTopColor: color, borderTopWidth: 3 }}>
      <h4 className="font-semibold text-gray-900">{title}</h4>
      <div className="grid grid-cols-3 gap-2 mt-4">
        <div className="rounded-lg border p-3" style={cardStyle(metricColors.total)}>
          <div className="text-[11px] text-gray-600">Total</div>
          <div className="text-lg font-bold" style={valueStyle(metricColors.total)}>{totals.total}</div>
        </div>
        <div className="rounded-lg border p-3" style={cardStyle(metricColors.bilingual)}>
          <div className="text-[11px] text-gray-600">Bilingual</div>
          <div className="text-lg font-bold" style={valueStyle(metricColors.bilingual)}>{totals.bilingual}</div>
        </div>
        <div className="rounded-lg border p-3" style={cardStyle(metricColors.integrated)}>
          <div className="text-[11px] text-gray-600">Integrated</div>
          <div className="text-lg font-bold" style={valueStyle(metricColors.integrated)}>{totals.integrated}</div>
        </div>
      </div>
    </div>
  )
}
