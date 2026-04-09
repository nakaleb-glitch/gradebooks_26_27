import { useAuth } from '../contexts/AuthContext'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { normalizeLinkUrl, uploadTeacherAnnouncementPdf } from '../lib/announcementAttachments'
import AnnouncementPdfButton from '../components/AnnouncementPdfButton'

const INCIDENT_TYPES = ['Disruption', 'Respect', 'Bullying', 'Academic Dishonesty', 'Attendance', 'Other']
const SEVERITY_LEVELS = ['Low', 'Medium', 'High']

export default function Dashboard() {
  const { profile, user } = useAuth()
  const [classes, setClasses] = useState([])
  const [students, setStudents] = useState([])
  const [newBehaviorReportsCount, setNewBehaviorReportsCount] = useState(0)
  const [newTeacherPasswordResetCount, setNewTeacherPasswordResetCount] = useState(0)
  const [newStudentPasswordResetCount, setNewStudentPasswordResetCount] = useState(0)
  const [studentAnnouncements, setStudentAnnouncements] = useState([])
  const [studentGradedAssignments, setStudentGradedAssignments] = useState([])
  const [teacherAnnouncements, setTeacherAnnouncements] = useState([])
  const [teacherEvents, setTeacherEvents] = useState([])
  const [teacherDeadlines, setTeacherDeadlines] = useState([])
  const [selectedDashboardItem, setSelectedDashboardItem] = useState(null)
  const [showTeacherAnnouncements, setShowTeacherAnnouncements] = useState(false)
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false)
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
  const [showTeacherSubmissions, setShowTeacherSubmissions] = useState(false)
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

    const [{ data: classData }, { data: dashboardItems }, { data: teacherAnnouncementRows }, { data: submittedReports }] = await Promise.all([
      supabase.from('classes').select('*').eq('teacher_id', profile.id).order('name'),
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
              <Link
                to="/admin/students"
                className="relative bg-white rounded-xl border border-gray-200 p-6 hover:shadow-sm transition-all block"
                style={{ borderTopColor: CARD_ACCENT.students, borderTopWidth: 3 }}
              >
                {newStudentPasswordResetCount > 0 && (
                  <span className="absolute top-3 right-3 min-w-[1.5rem] h-6 px-2 rounded-full bg-red-600 text-white text-xs font-semibold flex items-center justify-center">
                    {newStudentPasswordResetCount}
                  </span>
                )}
                <div className="font-semibold text-gray-900">Student Management</div>
                <div className="text-sm text-gray-500 mt-1">Add, edit or remove student accounts.</div>
              </Link>
              <Link
                to="/admin/classes"
                className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-sm transition-all block"
                style={{ borderTopColor: CARD_ACCENT.classes, borderTopWidth: 3 }}
              >
                <div className="font-semibold text-gray-900">Class Management</div>
                <div className="text-sm text-gray-500 mt-1">Add, edit or remove classes.</div>
              </Link>
              <Link
                to="/admin/users"
                className="relative bg-white rounded-xl border border-gray-200 p-6 hover:shadow-sm transition-all block"
                style={{ borderTopColor: CARD_ACCENT.users, borderTopWidth: 3 }}
              >
                {newTeacherPasswordResetCount > 0 && (
                  <span className="absolute top-3 right-3 min-w-[1.5rem] h-6 px-2 rounded-full bg-red-600 text-white text-xs font-semibold flex items-center justify-center">
                    {newTeacherPasswordResetCount}
                  </span>
                )}
                <div className="font-semibold text-gray-900">Teacher Management</div>
                <div className="text-sm text-gray-500 mt-1">View, add, edit or remove teacher accounts.</div>
              </Link>
              <Link
                to="/admin/resources"
                className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-sm transition-all block"
                style={{ borderTopColor: CARD_ACCENT.resources, borderTopWidth: 3 }}
              >
                <div className="font-semibold text-gray-900">Resource Management</div>
                <div className="text-sm text-gray-500 mt-1">Add, edit or remove resources.</div>
              </Link>
              <Link
                to="/admin/events-deadlines"
                className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-sm transition-all block"
                style={{ borderTopColor: CARD_ACCENT.eventsDeadlines, borderTopWidth: 3 }}
              >
                <div className="font-semibold text-gray-900">Event &amp; Admin Deadline Management</div>
                <div className="text-sm text-gray-500 mt-1">Add, edit or remove events and deadlines.</div>
              </Link>
              <Link
                to="/admin/behavior-management"
                className="relative bg-white rounded-xl border border-gray-200 p-6 hover:shadow-sm transition-all block"
                style={{ borderTopColor: CARD_ACCENT.behavior, borderTopWidth: 3 }}
              >
                {newBehaviorReportsCount > 0 && (
                  <span className="absolute top-3 right-3 min-w-[1.5rem] h-6 px-2 rounded-full bg-red-600 text-white text-xs font-semibold flex items-center justify-center">
                    {newBehaviorReportsCount}
                  </span>
                )}
                <div className="font-semibold text-gray-900">Behavior Management</div>
                <div className="text-sm text-gray-500 mt-1">Review teacher behavior reports and follow-up actions.</div>
              </Link>
              <Link
                to="/admin/gradebooks"
                className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-sm transition-all block"
                style={{ borderTopColor: '#1f86c7', borderTopWidth: 3 }}
              >
                <div className="font-semibold text-gray-900">Gradebook Management</div>
                <div className="text-sm text-gray-500 mt-1">Review termly gradebooks for each class.</div>
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
                </div>
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

          <div className="bg-white rounded-xl border border-gray-200 p-5 h-full" style={{ borderTopColor: CARD_ACCENT.events, borderTopWidth: 3 }}>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Announcements</h3>
            <p className="text-xs text-gray-500 mb-3">Class updates from your teachers.</p>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
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
            <div className="bg-white rounded-xl border border-gray-200 p-5" style={{ borderTopColor: CARD_ACCENT.class, borderTopWidth: 3 }}>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">My Classes</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {classes.length === 0 ? (
                  <div className="col-span-full rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
                    No classes assigned yet. Contact your administrator.
                  </div>
                ) : (
                  classes.map(cls => (
                    <Link
                      key={cls.id}
                      to={`/class/${cls.id}`}
                      className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-sm transition-all"
                      style={{ borderTopColor: '#9ca3af', borderTopWidth: 3 }}
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              <div className="bg-white rounded-xl border border-gray-200 p-5 h-full flex flex-col" style={{ borderTopColor: '#22c55e', borderTopWidth: 3 }}>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Class Announcements</h3>
                <div className="flex items-center justify-between mb-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAnnouncementForm(!showAnnouncementForm)
                      if (showAnnouncementForm === false) setShowTeacherAnnouncements(false)
                    }}
                    className="text-[11px] px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
                  >
                    {showAnnouncementForm ? 'Cancel' : 'Send New Announcement'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowTeacherAnnouncements(!showTeacherAnnouncements)
                      if (showTeacherAnnouncements === false) setShowAnnouncementForm(false)
                    }}
                    className="text-[11px] px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
                  >
                    {showTeacherAnnouncements ? 'Hide Announcements' : 'View Sent Announcements'}
                  </button>
                </div>
                
                {showAnnouncementForm && (
                  <div className="flex flex-col gap-3 flex-1 min-h-[16rem]">
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
                  </div>
                )}

                {showAnnouncementForm && (
                  <div className="flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                    <div className="flex-1 min-w-0">
                      <label htmlFor="dashboard-announcement-scope" className="block text-xs font-medium text-gray-500 mb-1">
                        Audience
                      </label>
                      <select
                        id="dashboard-announcement-scope"
                        value={announcementScope}
                        onChange={(e) => {
                          setAnnouncementScope(e.target.value)
                          if (e.target.value === 'all_my_classes') {
                            setAnnouncementClassIds([])
                          }
                        }}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
                      >
                        <option value="all_my_classes">All my classes</option>
                        <option value="selected_classes">Selected classes</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => postTeacherAnnouncement()}
                      disabled={postingAnnouncement}
                      className="w-full sm:w-auto shrink-0 rounded-lg bg-green-600 text-white px-4 py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-60"
                    >
                      {postingAnnouncement ? 'Posting...' : 'Post Announcement'}
                    </button>
                  </div>
                  {announcementScope === 'selected_classes' && (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-2 max-h-28 overflow-y-auto">
                      {classes.length === 0 ? (
                        <div className="text-xs text-gray-500">No classes available.</div>
                      ) : (
                        classes.map((cls) => (
                          <label key={cls.id} className="flex items-center gap-2 py-1 text-xs text-gray-700">
                            <input
                              type="checkbox"
                              checked={announcementClassIds.includes(cls.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setAnnouncementClassIds((prev) => [...prev, cls.id])
                                } else {
                                  setAnnouncementClassIds((prev) => prev.filter((id) => id !== cls.id))
                                }
                              }}
                            />
                            <span>{cls.name}</span>
                          </label>
                        ))
                      )}
                  </div>
                  {announcementScope === 'selected_classes' && (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-2 max-h-28 overflow-y-auto">
                      {classes.length === 0 ? (
                        <div className="text-xs text-gray-500">No classes available.</div>
                      ) : (
                        classes.map((cls) => (
                          <label key={cls.id} className="flex items-center gap-2 py-1 text-xs text-gray-700">
                            <input
                              type="checkbox"
                              checked={announcementClassIds.includes(cls.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setAnnouncementClassIds((prev) => [...prev, cls.id])
                                } else {
                                  setAnnouncementClassIds((prev) => prev.filter((id) => id !== cls.id))
                                }
                              }}
                            />
                            <span>{cls.name}</span>
                          </label>
                        ))
                      )}
                    </div>
                  )}
                  </div>
                )}

                {showTeacherAnnouncements && !showAnnouncementForm && (
                    <div className="border-t border-gray-200 pt-3 space-y-2 max-h-48 overflow-y-auto">
                      {teacherAnnouncements.length === 0 ? (
                        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                          No announcements posted yet.
                        </div>
                      ) : teacherAnnouncements.slice(0, 8).map((item) => (
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
                          className="w-full text-left rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 hover:bg-green-50 transition-colors"
                        >
                          <div className="text-sm font-medium text-gray-800">{item.title}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{formatDateWithDay(item.created_at)}</div>
                        </button>
                      ))}
                    </div>
                  )}
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5 h-full flex flex-col" style={{ borderTopColor: '#d1232a', borderTopWidth: 3 }}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">Behavior Report Tool</h3>
                  <button
                    type="button"
                    onClick={() => setShowTeacherSubmissions((prev) => !prev)}
                    className="text-[11px] px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
                  >
                    {showTeacherSubmissions ? 'Hide Submissions' : 'View Submissions'}
                  </button>
                </div>
                <form onSubmit={submitBehaviorReportInline} className="space-y-2">
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
                    rows={3}
                    value={behaviorForm.description}
                    onChange={(e) => setBehaviorForm((prev) => ({ ...prev, description: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
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
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={savingBehaviorReport}
                      className="px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-60"
                    >
                      {savingBehaviorReport ? 'Submitting...' : 'Submit Report'}
                    </button>
                  </div>
                </form>
                {showTeacherSubmissions && (
                  <div className="mt-3 border-t border-gray-200 pt-3 space-y-2 max-h-48 overflow-y-auto">
                    {teacherSubmittedReports.length === 0 ? (
                      <div className="text-xs text-gray-500">No submissions yet.</div>
                    ) : teacherSubmittedReports.slice(0, 8).map((report) => (
                      <div key={report.id} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs text-gray-700">
                              {report.incident_date} • {report.students?.name_eng || 'Student'} • {report.classes?.name || 'Class'}
                            </div>
                            <div className="text-[11px] text-gray-500 mt-1">
                              {report.incident_type} / {report.severity} • Status: {report.status}
                            </div>
                            {report.admin_notes ? (
                              <div className="text-[11px] text-gray-600 mt-1 line-clamp-2">Admin: {report.admin_notes}</div>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedBehaviorSubmission(report)}
                            className="shrink-0 text-[11px] px-2 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
                          >
                            View Full Report
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5" style={{ borderTopColor: CARD_ACCENT.deadlines, borderTopWidth: 3 }}>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Admin Deadlines</h3>
                <div className="space-y-2">
                  {teacherDeadlines.length === 0 ? (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                      No upcoming deadlines yet. Admin updates will appear here.
                    </div>
                  ) : teacherDeadlines.map(deadlineItem => (
                    <button
                      key={deadlineItem.id}
                      type="button"
                      onClick={() => setSelectedDashboardItem({ ...deadlineItem, label: 'Admin Deadline' })}
                      className="w-full text-left rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 hover:bg-amber-50 transition-colors"
                    >
                      <div className="text-sm font-medium text-gray-800">{deadlineItem.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{formatDateWithDay(deadlineItem.event_date)}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5" style={{ borderTopColor: CARD_ACCENT.events, borderTopWidth: 3 }}>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Events</h3>
                <div className="space-y-2">
                  {teacherEvents.length === 0 ? (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                      No upcoming events yet. Admin updates will appear here.
                    </div>
                  ) : teacherEvents.map(eventItem => (
                    <button
                      key={eventItem.id}
                      type="button"
                      onClick={() => setSelectedDashboardItem({ ...eventItem, label: 'Event' })}
                      className="w-full text-left rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 hover:bg-blue-50 transition-colors"
                    >
                      <div className="text-sm font-medium text-gray-800">{eventItem.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{formatDateWithDay(eventItem.event_date)}</div>
                    </button>
                  ))}
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
