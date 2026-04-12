import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

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

export default function TeacherScheduleView() {
  const navigate = useNavigate()
  const [selectedLevel, setSelectedLevel] = useState('primary')
  const [schedules, setSchedules] = useState({})
  const [teachers, setTeachers] = useState([])
  const [classes, setClasses] = useState([])

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
      .select('id, name, level, programme')
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

  const getTeacherName = (id) => {
    const teacher = teachers.find(t => t.id === id)
    return teacher?.full_name || ''
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

          <button
            onClick={() => navigate('/admin/teacher-schedules')}
            className="text-white px-4 py-1.5 rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
            style={{ backgroundColor: '#1f86c7' }}
          >
            ← Edit Master Schedule
          </button>
        </div>

        <h2 className="text-2xl font-bold text-gray-900">Teacher Schedule Overview</h2>
        <p className="text-sm text-gray-500 mt-1">Read only schedule view. Periods are vertical, classes are horizontal.</p>
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
                            <div className="w-full min-h-[50px] p-1 rounded border border-transparent text-xs text-left">
                              {schedule ? (
                                <div>
                                  <div className="font-medium text-gray-800 truncate">{getTeacherName(schedule.teacher_id)}</div>
                                  <div className="text-gray-600 truncate">{schedule.subject}</div>
                                </div>
                              ) : null}
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
        </div>
      ))}

    </Layout>
  )
}