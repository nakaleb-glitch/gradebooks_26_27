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
  'ESL', 'Mathematics', 'Science', 'Global Perspectives'
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
  const [showCsvHelp, setShowCsvHelp] = useState(false)
  const [statusMessage, setStatusMessage] = useState(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)

  useEffect(() => {
    fetchTeachers()
    fetchClasses()
    fetchSchedules()
    fetchLastUpdated()
  }, [selectedLevel])

  const fetchTeachers = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, full_name')
      .in('role', ['teacher', 'admin_teacher'])
      .order('full_name')
    setTeachers(data || [])
  }

  const fetchClasses = async () => {
    const { data } = await supabase
      .from('classes')
      .select('id, name, level, programme, teacher_id')
      .eq('level', selectedLevel)
      .order('name')
    
    // Store all class objects, not just homeroom names
    setClasses(data || [])
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
      subject: existing?.subject || '',
      teacher_name: existing?.teacher_id ? getTeacherName(existing.teacher_id) : ''
    })
    setEditingCell({ className, day, period })
  }

  // Get teachers filtered for current homeroom
  const getFilteredTeachers = () => {
    if (!editingCell) return teachers
    
    // Find ALL classes for this homeroom
    const matchingClasses = classes.filter(c => 
      c.name && c.name.startsWith(editingCell.className + ' ')
    )
    
    // Collect all unique teachers for these classes
    const classTeacherIds = new Set()
    matchingClasses.forEach(c => {
      if (c.teacher_id) classTeacherIds.add(c.teacher_id)
    })
    
    // Return ONLY the teachers assigned to this homeroom's classes
    return teachers.filter(t => classTeacherIds.has(t.id))
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
    const { error } = await supabase
      .from('teacher_schedules')
      .upsert(scheduleData, {
        onConflict: 'level, class_name, day, period'
      })

    if (error) {
      console.error('Save error:', error)
      setStatusMessage({ type: 'error', text: 'Save failed: ' + error.message })
      // Rollback local state on database error
      fetchSchedules()
      setTimeout(() => setStatusMessage(null), 5000)
    }

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

  const clearAllSchedules = async () => {
    try {
      await supabase
        .from('teacher_schedules')
        .delete()
        .eq('level', selectedLevel)
      
      await fetchSchedules()
      await fetchLastUpdated()
      
      setStatusMessage({ type: 'success', text: `All ${selectedLevel} schedules have been cleared` })
      setConfirmClear(false)
      
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Clear failed: ' + err.message })
    }
    
    setTimeout(() => setStatusMessage(null), 5000)
  }

  const fetchLastUpdated = async () => {
    const { data } = await supabase
      .from('schedule_audit')
      .select('last_updated_at, users(full_name)')
      .eq('level', selectedLevel)
      .single()
    
    if (data) {
      setLastUpdated(data)
    }
  }

  const getTeacherName = (id) => {
    const teacher = teachers.find(t => t.id === id)
    return teacher?.full_name || 'Unknown'
  }

  const exportTemplate = () => {
    // Generate dynamic CSV template
    const headers = ['Day', 'Period', 'ClassName', 'StaffID', 'Subject']
    const rows = []
    const dayLabels = ['MON', 'TUE', 'WED', 'THU', 'FRI']
    const homerooms = Array.from(new Set(classes.map(c => c.name.split(' ')[0]))).sort()
    
    // Logical ordering: ONE CLASS AT A TIME, full week
    homerooms.forEach(homeroom => {
      rows.push(['//', '//', homeroom, '', '']) // Class separator header
      DAYS.forEach((_, dayIdx) => {
        TIMETABLE.forEach(t => {
          rows.push([dayLabels[dayIdx], t.period, homeroom, '', ''])
        })
      })
      rows.push(['', '', '', '', '']) // empty separator line
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

    try {
      const text = await file.text()
      const lines = text.split('\n').filter(l => l.trim())
      
      // Skip header
      const dataLines = lines.slice(1)
      
      const dayMap = { 'MON': 0, 'TUE': 1, 'WED': 2, 'THU': 3, 'FRI': 4 }
      
      // Get all teachers with staff_id
      const { data: teachers } = await supabase
        .from('users')
        .select('id, staff_id')
        .eq('role', 'teacher')
      
      const staffIdMap = {}
      teachers.forEach(t => staffIdMap[t.staff_id?.toString()] = t.id)
      
      const schedulesToInsert = []
      let success = 0
      let failed = 0
      
      for (const line of dataLines) {
        const parts = line.split(',').map(p => p.trim())
        
        // Skip empty, comment, separator lines
        if (parts[0] === '//' || !parts[0]) continue
        if (!parts[3]) continue // skip if no staff id
        
        const day = dayMap[parts[0].toUpperCase()]
        const period = parseInt(parts[1])
        const className = parts[2]
        const staffId = parts[3].toString()
        const subject = parts[4]
        
        const teacherId = staffIdMap[staffId]
        
        if (day !== undefined && period && className && teacherId && subject) {
          schedulesToInsert.push({
            level: selectedLevel,
            class_name: className,
            day: day,
            period: period,
            teacher_id: teacherId,
            subject: subject
          })
          success++
        } else {
          failed++
        }
      }
      
      if (schedulesToInsert.length > 0) {
        // Batch upsert
        const { error } = await supabase
          .from('teacher_schedules')
          .upsert(schedulesToInsert, {
            onConflict: 'level, class_name, day, period'
          })
        
        if (error) throw error
        
        // Reload schedules
        await fetchSchedules()
      }
      
      setStatusMessage({ type: 'success', text: `Import completed: ${success} schedules imported, ${failed} rows skipped` })
      
    } catch (err) {
      console.error('Import error:', err)
      setStatusMessage({ type: 'error', text: 'Import failed: ' + err.message })
    }
    
    fileInputRef.current.value = ''
    
    setTimeout(() => setStatusMessage(null), 5000)
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

          <div className="flex flex-col items-center gap-0">
            <div className="flex gap-3">
              <button
                onClick={() => navigate('/teacher-schedule')}
                className={`w-44 h-[38px] px-4 py-2 rounded-lg text-xs font-medium transition-colors text-center`}
                style={{ backgroundColor: '#16a34a', color: 'white' }}
                onMouseOver={e => { e.currentTarget.style.backgroundColor = '#15803d' }}
                onMouseOut={e => { e.currentTarget.style.backgroundColor = '#16a34a' }}
              >
                View Teacher Schedules
              </button>
              
              <label
                className={`cursor-pointer w-44 h-[38px] px-4 py-2 rounded-lg text-sm font-medium transition-colors text-center flex items-center justify-center`}
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

              <button
                onClick={() => setConfirmClear(true)}
                className={`w-44 h-[38px] px-4 py-2 rounded-lg text-sm font-medium transition-colors text-center`}
                style={{ backgroundColor: '#dc2626', color: 'white' }}
                onMouseOver={e => { e.currentTarget.style.backgroundColor = '#b91c1c' }}
                onMouseOut={e => { e.currentTarget.style.backgroundColor = '#dc2626' }}
              >
                Clear All
              </button>
            </div>

            <div className="mt-1 self-end" style={{ marginRight: '18px' }}>
              <a
                href="#"
                onClick={e => { e.preventDefault(); exportTemplate(); }}
                className="text-xs hover:underline"
                style={{ color: '#1f86c7' }}
              >
                Download CSV Template
              </a>
            </div>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-gray-900">Teacher Schedule Management</h2>
        <p className="text-sm text-gray-500 mt-1">Click any cell to assign teacher and subject. Periods are vertical, classes are horizontal.</p>
        
        {lastUpdated && lastUpdated.last_updated_at && (
          <p className="text-xs text-gray-400 mt-1">
            Last updated by <span className="text-gray-600 font-medium">{lastUpdated.users?.full_name || 'Unknown'}</span> on <span className="text-gray-600">{new Date(lastUpdated.last_updated_at).toLocaleString()}</span>
          </p>
        )}
        
        {statusMessage && (
          <div className={`mt-4 px-4 py-3 rounded-lg text-sm font-medium ${
            statusMessage.type === 'success' 
              ? 'bg-green-50 border border-green-200 text-green-800' 
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {statusMessage.text}
          </div>
        )}
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
                  {Array.from(new Set(classes.map(c => c.name.split(' ')[0]))).sort().map(homeroom => (
                    <th key={homeroom} className="px-3 py-2 text-center font-medium text-gray-600">
                      {homeroom}
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

                      {Array.from(new Set(classes.map(c => c.name.split(' ')[0]))).sort().map(cls => {
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
                 <label className="block text-xs font-medium text-gray-500 mb-1">Subject</label>
                 <select
                   value={editForm.subject}
                   onChange={(e) => {
                     const selectedSubject = e.target.value
                     let autoTeacherId = ''
                     let autoTeacherName = ''

                     if (selectedSubject && editingCell) {
                       // Find the one matching class for this homeroom + subject
                       const matchingClass = classes.find(c =>
                         c.name && c.name.startsWith(editingCell.className + ' ') && c.subject === selectedSubject
                       )

                       if (matchingClass && matchingClass.teacher_id) {
                         autoTeacherId = matchingClass.teacher_id
                         autoTeacherName = getTeacherName(matchingClass.teacher_id)
                       }
                     }

                     setEditForm({
                       ...editForm,
                       subject: selectedSubject,
                       teacher_id: autoTeacherId,
                       teacher_name: autoTeacherName
                     })
                   }}
                   className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                 >
                   <option value="">Select subject</option>
                   {SUBJECTS.map(sub => (
                     <option key={sub} value={sub}>{sub}</option>
                   ))}
                 </select>
               </div>

              {editForm.teacher_id && editForm.teacher_name && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Assigned Teacher</label>
                  <div className="px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium border border-blue-200">
                    {editForm.teacher_name}
                  </div>
                </div>
              )}

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

      {/* Clear All Confirmation Modal */}
      {confirmClear && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
          <div className="w-full max-w-md bg-white rounded-xl border border-gray-200 p-5">
            <h4 className="text-base font-semibold text-gray-900 mb-4">Clear All Schedules</h4>
            <p className="text-sm text-gray-600 mb-6">
              Are you absolutely sure you want to delete all {selectedLevel} schedules?
              <br /><br />
              <strong>This action cannot be undone.</strong>
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={clearAllSchedules}
                className="flex-1 px-4 py-2 rounded-lg text-white text-sm font-medium"
                style={{ backgroundColor: '#dc2626' }}
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}

    </Layout>
  )
}