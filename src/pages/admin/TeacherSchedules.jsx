import { useState, useEffect, useRef } from 'react'
import Layout from '../../components/Layout'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

const TIMETABLE = [
  { period: 1, primary: '08:10 - 08:45', secondary: '08:00 - 08:40', label: 'Period 1' },
  { period: 2, primary: '08:45 - 09:20', secondary: '08:45 - 09:25', label: 'Period 2' },
  { period: 3, primary: '09:45 - 10:20', secondary: '09:30 - 10:10', label: 'Period 3' },
  { period: 4, primary: '10:20 - 10:55', secondary: '10:25 - 11:05', label: 'Period 4' },
  { period: 5, primary: '10:55 - 11:30', secondary: '11:10 - 11:50', label: 'Period 5' },
  { period: 6, primary: '13:35 - 14:10', secondary: '13:30 - 14:10', label: 'Period 6' },
  { period: 7, primary: '14:10 - 14:45', secondary: '14:15 - 14:55', label: 'Period 7' },
  { period: 8, primary: '15:20 - 15:55', secondary: '15:20 - 16:00', label: 'Period 8' },
  { period: 9, primary: '15:55 - 16:30', secondary: '16:05 - 16:45', label: 'Period 9' },
]

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']

const SUBJECTS = [
  'ESL', 'Mathematics', 'Science', 'Global Perspectives', 'English', 'Vietnamese',
  'Physical Education', 'Art', 'Music', 'Computer Science', 'Chemistry', 'Physics',
  'Biology', 'History', 'Geography', 'Economics', 'Business'
]

export default function TeacherSchedules() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [selectedLevel, setSelectedLevel] = useState('primary')
  const [schedules, setSchedules] = useState({})
  const [teachers, setTeachers] = useState([])
  const [classes, setClasses] = useState([])
  const [editingCell, setEditingCell] = useState(null)
  const [editForm, setEditForm] = useState({ teacher_id: '', subject: '' })
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    fetchTeachers()
    fetchClasses()
    fetchSchedules()
  }, [selectedLevel])

  const fetchTeachers = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('role', 'teacher')
      .order('full_name')
    setTeachers(data || [])
  }

  const fetchClasses = async () => {
    const { data } = await supabase
      .from('classes')
      .select('id, name, level, programme, teacher_id')
      .eq('level', selectedLevel)
      .order('name')
    
    // Get unique homerooms
    const homerooms = new Set()
    data?.forEach(c => {
      const homeroom = c.name.split(' ')[0]
      homerooms.add(homeroom)
    })
    
    setClasses(Array.from(homerooms).sort())
  }

  const fetchSchedules = async () => {
    const { data } = await supabase
      .from('teacher_schedules')
      .select('*')
      .eq('level', selectedLevel)
    if (data) {
      const mapped = {}
      data.forEach(s => {
        mapped[`${s.class_name}-${s.day}-${s.period}`] = s
      })
      setSchedules(mapped)
    }
  }

  const openEditModal = (className, day, period) => {
    const existing = schedules[`${className}-${day}-${period}`]
    setEditForm({
      teacher_id: existing?.teacher_id || '',
      subject: existing?.subject || ''
    })
    setEditingCell({ className, day, period })
  }

  // Get teachers filtered for current homeroom
  const getFilteredTeachers = () => {
    if (!editingCell) return teachers
    
    // Find class teacher for this homeroom
    const matchingClass = classes.find(c => c.name && c.name.startsWith(editingCell.className))
    
    if (matchingClass && matchingClass.teacher_id) {
      const assignedTeacher = teachers.find(t => t.id === matchingClass.teacher_id)
      if (assignedTeacher) {
        // Put assigned teacher first, then all others
        const otherTeachers = teachers.filter(t => t.id !== matchingClass.teacher_id)
        return [assignedTeacher, ...otherTeachers]
      }
    }
    
    return teachers
  }

  const saveSchedule = async () => {
    if (!editForm.teacher_id || !editForm.subject) return
    setSaving(true)

    const scheduleData = {
      level: selectedLevel,
      class_name: editingCell.className,
      day: editingCell.day,
      period: editingCell.period,
      teacher_id: editForm.teacher_id,
      subject: editForm.subject
    }

    // Update local state immediately for instant UI feedback
    const newSchedules = {
      ...schedules,
      [`${editingCell.className}-${editingCell.day}-${editingCell.period}`]: scheduleData
    }
    setSchedules(newSchedules)

    // Save to database
    await supabase
      .from('teacher_schedules')
      .upsert(scheduleData, {
        onConflict: 'level, class_name, day, period'
      })

    setSaving(false)
    setEditingCell(null)
  }

  const clearSchedule = async () => {
    setSaving(true)
    
    // Update local state immediately
    const newSchedules = { ...schedules }
    delete newSchedules[`${editingCell.className}-${editingCell.day}-${editingCell.period}`]
    setSchedules(newSchedules)
    
    await supabase
      .from('teacher_schedules')
      .delete()
      .eq('level', selectedLevel)
      .eq('class_name', editingCell.className)
      .eq('day', editingCell.day)
      .eq('period', editingCell.period)
      
    setSaving(false)
    setEditingCell(null)
  }

  const getTeacherName = (id) => {
    const teacher = teachers.find(t => t.id === id)
    return teacher?.full_name || 'Unknown'
  }

  const exportTemplate = () => {
    // Generate CSV template
    const headers = ['Day', 'Period', ...classes]
    const rows = []
    
    DAYS.forEach((day, dayIdx) => {
      TIMETABLE.forEach(t => {
        if (t.isBreak) return
        rows.push([day, t.period, ...classes.map(() => '')])
      })
    })

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `master_schedule_${selectedLevel}_template.csv`
    a.click()
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Simple CSV import handler
    // Full excel parser can be added later
    alert('CSV import placeholder - will process: ' + file.name)
    fileInputRef.current.value = ''
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

          <div className="flex gap-3 items-end">
            <div className="flex flex-col items-center">
              <button
                onClick={() => navigate('/admin/teacher-schedule-view')}
                className={`w-44 px-4 py-2 rounded-lg text-sm font-medium transition-colors text-center`}
                style={{ backgroundColor: '#16a34a', color: 'white' }}
                onMouseOver={e => { e.currentTarget.style.backgroundColor = '#15803d' }}
                onMouseOut={e => { e.currentTarget.style.backgroundColor = '#16a34a' }}
              >
                View Teacher Schedules
              </button>
            </div>
            
            <div className="flex flex-col items-center">
              <label
                className={`cursor-pointer w-44 px-4 py-2 rounded-lg text-sm font-medium transition-colors text-center`}
                style={{ backgroundColor: '#ffc612', color: '#1a1a1a' }}
                onMouseOver={e => { e.currentTarget.style.backgroundColor = '#e6b10f' }}
                onMouseOut={e => { e.currentTarget.style.backgroundColor = '#ffc612' }}
              >
                + Import CSV
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
              <a
                href="#"
                onClick={e => { e.preventDefault(); exportTemplate(); }}
                className="mt-1 text-xs hover:underline"
                style={{ color: '#1f86c7' }}
              >
                Download CSV Template
              </a>
            </div>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-gray-900">Teacher Schedule Management</h2>
        <p className="text-sm text-gray-500 mt-1">Click any cell to assign teacher and subject. Periods are vertical, classes are horizontal.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 mb-4">
        <div className="grid grid-cols-2 border-b border-gray-200">
          <button
            onClick={() => setSelectedLevel('primary')}
            className={`py-3 text-sm font-medium transition-colors border-b-2 ${
              selectedLevel === 'primary'
                ? 'border-[#d1232a] bg-[#d1232a1a] text-[#d1232a] font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            Primary
          </button>
          <button
            onClick={() => setSelectedLevel('secondary')}
            className={`py-3 text-sm font-medium transition-colors border-b-2 ${
              selectedLevel === 'secondary'
                ? 'border-[#d1232a] bg-[#d1232a1a] text-[#d1232a] font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            Secondary
          </button>
        </div>
      </div>

      {DAYS.map((day, dayIdx) => (
        <div key={day} className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2 bg-gray-100 px-3 py-1 rounded">{day}</h3>

          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-3 py-2 text-left font-medium text-gray-600 w-[150px]">Period</th>
                  {classes.map(cls => (
                    <th key={cls} className="px-3 py-2 text-center font-medium text-gray-600">
                      {cls}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIMETABLE.map((row, pidx) => {
                  return (
                    <tr key={pidx} className="border-b border-gray-100">
                      <td className="px-3 py-2 border-r border-gray-100 bg-gray-50">
                        <div className="font-medium">{row.label}</div>
                        <div className="text-xs text-gray-500">{selectedLevel === 'primary' ? row.primary : row.secondary}</div>
                      </td>

                      {classes.map(cls => {
                        const schedule = schedules[`${cls}-${dayIdx}-${row.period}`]
                        return (
                          <td
                            key={cls}
                            className="px-1 py-1 border-r border-gray-100 align-top"
                          >
                            <button
                              onClick={() => openEditModal(cls, dayIdx, row.period)}
                              className="w-full min-h-[50px] p-1 rounded border border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 transition-colors text-xs text-left"
                            >
                              {schedule ? (
                                <div>
                                  <div className="font-medium text-gray-800 truncate">{getTeacherName(schedule.teacher_id)}</div>
                                  <div className="text-gray-600 truncate">{schedule.subject}</div>
                                </div>
                              ) : (
                                <span className="text-gray-400">+</span>
                              )}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Edit Modal */}
      {editingCell && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
          <div className="w-full max-w-md bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h4 className="text-base font-semibold text-gray-900">Edit Schedule</h4>
                <p className="text-xs text-gray-500 mt-1">
                  Class {editingCell.className} • {DAYS[editingCell.day]} • Period {editingCell.period}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingCell(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Teacher</label>
                <select
                  value={editForm.teacher_id}
                  onChange={(e) => setEditForm({ ...editForm, teacher_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  <option value="">Select teacher</option>
                  {getFilteredTeachers().map(t => (
                    <option key={t.id} value={t.id}>{t.full_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Subject</label>
                <select
                  value={editForm.subject}
                  onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  <option value="">Select subject</option>
                  {SUBJECTS.map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={clearSchedule}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-red-600 text-sm font-medium hover:bg-red-50"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => setEditingCell(null)}
                  className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveSchedule}
                  disabled={saving || !editForm.teacher_id || !editForm.subject}
                  className="flex-1 px-4 py-2 rounded-lg text-white text-sm font-medium"
                  style={{ backgroundColor: '#1f86c7' }}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}