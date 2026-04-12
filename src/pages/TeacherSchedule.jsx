import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const PRIMARY_TIMETABLE = [
  { period: 1, time: '08:00 - 08:35', label: 'Period 1', type: 'class' },
  { period: 2, time: '08:35 - 09:10', label: 'Period 2', type: 'class' },
  { period: null, time: '09:10 - 09:30', label: 'Morning Recess', type: 'break' },
  { period: 3, time: '09:30 - 10:05', label: 'Period 3', type: 'class' },
  { period: 4, time: '10:05 - 10:40', label: 'Period 4', type: 'class' },
  { period: 5, time: '10:40 - 11:15', label: 'Period 5', type: 'class' },
  { period: null, time: '11:30 - 13:00', label: 'Lunch Break / Nap Time', type: 'break' },
  { period: 6, time: '13:30 - 14:05', label: 'Period 6', type: 'class' },
  { period: 7, time: '14:05 - 14:40', label: 'Period 7', type: 'class' },
  { period: null, time: '14:40 - 15:20', label: 'Afternoon Snack', type: 'break' },
  { period: 8, time: '15:20 - 15:55', label: 'Period 8', type: 'class' },
  { period: 9, time: '15:55 - 16:30', label: 'Period 9', type: 'class' },
]

const SECONDARY_TIMETABLE = [
  { period: 1, time: '08:00 - 08:40', label: 'Period 1', type: 'class' },
  { period: 2, time: '08:45 - 09:25', label: 'Period 2', type: 'class' },
  { period: 3, time: '09:30 - 10:10', label: 'Period 3', type: 'class' },
  { period: null, time: '10:10 - 10:25', label: 'Morning Recess', type: 'break' },
  { period: 4, time: '10:25 - 11:05', label: 'Period 4', type: 'class' },
  { period: 5, time: '11:10 - 11:50', label: 'Period 5', type: 'class' },
  { period: null, time: '12:00 - 13:20', label: 'Lunch Break', type: 'break' },
  { period: 6, time: '13:30 - 14:10', label: 'Period 6', type: 'class' },
  { period: 7, time: '14:15 - 14:55', label: 'Period 7', type: 'class' },
  { period: null, time: '14:55 - 15:20', label: 'Afternoon Snack', type: 'break' },
  { period: 8, time: '15:20 - 16:00', label: 'Period 8', type: 'class' },
  { period: 9, time: '16:05 - 16:45', label: 'Period 9', type: 'class' },
]

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']

export default function TeacherSchedule() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [schedules, setSchedules] = useState({})
  const [teachers, setTeachers] = useState([])
  const [selectedTeacher, setSelectedTeacher] = useState(null)
  const [teacherLevel, setTeacherLevel] = useState(null)

  useEffect(() => {
    fetchTeachers()
    
    // Auto load logged in teacher's schedule if user is a teacher
    if (profile && profile.role === 'teacher') {
      setSelectedTeacher(profile.id)
    }
  }, [profile])

  useEffect(() => {
    if (selectedTeacher) {
      fetchTeacherSchedule()
      // Get selected teacher's level
      const teacher = teachers.find(t => t.id === selectedTeacher)
      setTeacherLevel(teacher?.level || 'primary')
    }
  }, [selectedTeacher])

  const fetchTeachers = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, full_name, level')
      .eq('role', 'teacher')
      .order('full_name')
    setTeachers(data || [])
  }

  const fetchTeacherSchedule = async () => {
    const { data } = await supabase
      .from('teacher_schedules')
      .select('*')
      .eq('teacher_id', selectedTeacher)
    
    if (data) {
      const mapped = {}
      data.forEach(s => {
        mapped[`${s.day}-${s.period}`] = s
      })
      setSchedules(mapped)
    }
  }

  // Generate consistent color for each class
  const getClassColor = (className) => {
    const colors = [
      'bg-blue-50 border-blue-200 text-blue-800',
      'bg-green-50 border-green-200 text-green-800',
      'bg-purple-50 border-purple-200 text-purple-800',
      'bg-amber-50 border-amber-200 text-amber-800',
      'bg-rose-50 border-rose-200 text-rose-800',
      'bg-teal-50 border-teal-200 text-teal-800',
      'bg-indigo-50 border-indigo-200 text-indigo-800',
      'bg-pink-50 border-pink-200 text-pink-800',
    ]
    
    let hash = 0
    for (let i = 0; i < className.length; i++) {
      hash = ((hash << 5) - hash) + className.charCodeAt(i)
      hash = hash & hash
    }
    
    return colors[Math.abs(hash) % colors.length]
  }

  const getTimetable = () => {
    return teacherLevel === 'secondary' ? SECONDARY_TIMETABLE : PRIMARY_TIMETABLE
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

          {profile?.role === 'admin' && (
            <button
              onClick={() => navigate('/admin/teacher-schedules')}
              className="text-white px-4 py-1.5 rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
              style={{ backgroundColor: '#1f86c7' }}
            >
              ← Edit Master Schedule
            </button>
          )}
        </div>

        <h2 className="text-2xl font-bold text-gray-900">
          {profile?.role === 'teacher' ? 'My Schedule' : 'Teacher Schedule View'}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {profile?.role === 'teacher' ? 'Your weekly teaching schedule.' : 'Select a teacher to view their full weekly timetable.'}
        </p>
      </div>

        {/* Teacher Selector - Only show for admins */}
        {profile?.role === 'admin' && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
            <div className="flex items-center gap-6">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Teacher</label>
                <select
                  value={selectedTeacher || ''}
                  onChange={(e) => setSelectedTeacher(e.target.value || null)}
                  className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Choose a teacher --</option>
                  {teachers.map(teacher => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.full_name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedTeacher && teacherLevel && (
                <div className={`px-4 py-2 rounded-full font-semibold text-sm text-white ${
                  teacherLevel === 'primary' 
                    ? 'bg-green-600' 
                    : 'bg-blue-600'
                }`}>
                  {teacherLevel.charAt(0).toUpperCase() + teacherLevel.slice(1)}
                </div>
              )}
            </div>
          </div>
        )}

      {selectedTeacher ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-3 py-3 text-left font-medium text-gray-600 w-[180px]">Time / Period</th>
                {DAYS.map(day => (
                  <th key={day} className="px-3 py-3 text-center font-medium text-gray-600">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {getTimetable().map((row, idx) => {
                if (row.type === 'break') {
                  return (
                    <tr key={idx} className="border-b border-gray-100 bg-gray-100">
                      <td className="px-3 py-2 border-r border-gray-200 font-medium text-gray-500">
                        <div className="font-semibold">{row.label}</div>
                        <div className="text-xs text-gray-400">{row.time}</div>
                      </td>
                      {DAYS.map((_, dayIdx) => (
                        <td key={dayIdx} className="px-1 py-2 border-r border-gray-200 text-center text-gray-400 text-xs">
                          --
                        </td>
                      ))}
                    </tr>
                  )
                }

                return (
                  <tr key={idx} className="border-b border-gray-100">
                    <td className="px-3 py-3 border-r border-gray-100 bg-gray-50">
                      <div className="font-medium">{row.label}</div>
                      <div className="text-xs text-gray-500">{row.time}</div>
                    </td>

                    {DAYS.map((_, dayIdx) => {
                      const schedule = schedules[`${dayIdx}-${row.period}`]
                      return (
                        <td
                          key={dayIdx}
                          className="px-2 py-2 border-r border-gray-100 align-top"
                        >
                          <div className="w-full min-h-[60px] p-2 rounded">
                             {schedule ? (
                               <div className={`rounded p-2 border ${getClassColor(schedule.class_name)}`}>
                                 <div className="font-medium">{schedule.subject}</div>
                                 <div className="text-xs opacity-90">{schedule.class_name}</div>
                               </div>
                             ) : (
                              <div className="text-gray-400 text-sm italic">Free Period</div>
                            )}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-gray-500">
            <div className="text-lg font-medium mb-1">No teacher selected</div>
            <div className="text-sm">Select a teacher from the dropdown above to view their weekly schedule.</div>
          </div>
        </div>
      )}

    </Layout>
  )
}