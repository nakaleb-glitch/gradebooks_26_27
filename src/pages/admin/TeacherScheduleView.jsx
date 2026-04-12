import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const FULL_TIMETABLE = [
  { period: 1, time: '08:00 - 08:45', label: 'Period 1', type: 'class' },
  { period: 2, time: '08:45 - 09:30', label: 'Period 2', type: 'class' },
  { period: null, time: '09:30 - 09:45', label: 'Morning Recess', type: 'break' },
  { period: 3, time: '09:45 - 10:30', label: 'Period 3', type: 'class' },
  { period: 4, time: '10:30 - 11:15', label: 'Period 4', type: 'class' },
  { period: 5, time: '11:15 - 12:00', label: 'Period 5', type: 'class' },
  { period: null, time: '12:00 - 13:30', label: 'Lunch Break', type: 'break' },
  { period: 6, time: '13:30 - 14:15', label: 'Period 6', type: 'class' },
  { period: 7, time: '14:15 - 15:00', label: 'Period 7', type: 'class' },
  { period: null, time: '15:00 - 15:15', label: 'Afternoon Break', type: 'break' },
  { period: 8, time: '15:15 - 16:00', label: 'Period 8', type: 'class' },
  { period: 9, time: '16:00 - 16:45', label: 'Period 9', type: 'class' },
]

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']

export default function TeacherScheduleView() {
  const navigate = useNavigate()
  const [schedules, setSchedules] = useState({})
  const [teachers, setTeachers] = useState([])
  const [selectedTeacher, setSelectedTeacher] = useState(null)

  useEffect(() => {
    fetchTeachers()
  }, [])

  useEffect(() => {
    if (selectedTeacher) {
      fetchTeacherSchedule()
    }
  }, [selectedTeacher])

  const fetchTeachers = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, full_name')
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

        <h2 className="text-2xl font-bold text-gray-900">Teacher Schedule View</h2>
        <p className="text-sm text-gray-500 mt-1">Select a teacher to view their full weekly timetable.</p>
      </div>

      {/* Teacher Selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Teacher</label>
        <select
          value={selectedTeacher || ''}
          onChange={(e) => setSelectedTeacher(e.target.value || null)}
          className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">-- Choose a teacher --</option>
          {teachers.map(teacher => (
            <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>
          ))}
        </select>
      </div>

      {selectedTeacher ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
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
              {FULL_TIMETABLE.map((row, idx) => {
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
                              <div>
                                <div className="font-medium text-gray-800">{schedule.subject}</div>
                                <div className="text-xs text-gray-600">{schedule.class_name}</div>
                                <div className="text-xs text-gray-400">{schedule.level}</div>
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