import { useAuth } from '../contexts/AuthContext'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
  const { profile, user } = useAuth()
  const [classes, setClasses] = useState([])
  const [students, setStudents] = useState([])
  const [newBehaviorReportsCount, setNewBehaviorReportsCount] = useState(0)
  const [teacherEvents, setTeacherEvents] = useState([])
  const [teacherDeadlines, setTeacherDeadlines] = useState([])
  const [selectedDashboardItem, setSelectedDashboardItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [levelFilter, setLevelFilter] = useState('')
  const [gradeFilter, setGradeFilter] = useState('all')

  useEffect(() => {
    if (profile) fetchDashboardData()
  }, [profile])

  const fetchDashboardData = async () => {
    setLoading(true)

    if (profile.role === 'admin') {
      const [{ data: classData }, { data: studentData }, { count: newReportsCount }] = await Promise.all([
        supabase.from('classes').select('*').order('name'),
        supabase.from('students').select('*'),
        supabase
          .from('behavior_reports')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'new'),
      ])
      setClasses(classData || [])
      setStudents(studentData || [])
      setNewBehaviorReportsCount(newReportsCount || 0)
      setLoading(false)
      return
    }

    setNewBehaviorReportsCount(0)
    const today = new Date().toISOString().slice(0, 10)
    const [{ data: classData }, { data: dashboardItems }] = await Promise.all([
      supabase.from('classes').select('*').eq('teacher_id', profile.id).order('name'),
      supabase
        .from('events_deadlines')
        .select('id, item_type, event_date, title, venue, description, plan_url')
        .gte('event_date', today)
        .order('event_date', { ascending: true })
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
                className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-sm transition-all block"
                style={{ borderTopColor: CARD_ACCENT.students, borderTopWidth: 3 }}
              >
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
                className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-sm transition-all block"
                style={{ borderTopColor: CARD_ACCENT.users, borderTopWidth: 3 }}
              >
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
            </div>
          </div>

          {/* Right column — Insights */}
          <div className="lg:col-span-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Dashboard Insights</h3>
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
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7">
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
            </div>

            <div className="lg:col-span-5 space-y-4">
              <Link
                to="/teacher/behavior-report"
                className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-all block"
                style={{ borderTopColor: '#d1232a', borderTopWidth: 3 }}
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Behavior Report Tool</h3>
                <p className="text-sm text-gray-500">Submit a student behavior report for admin review.</p>
              </Link>

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
            </div>
          </div>
        </>
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
