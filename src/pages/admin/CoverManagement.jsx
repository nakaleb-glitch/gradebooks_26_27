import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout'
import { supabase } from '../../lib/supabase'
import { getCurrentWeekIndexWithOverride } from '../../lib/academicCalendar'
import { useAuth } from '../../contexts/AuthContext'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

const WEEK_OPTIONS = Array.from({ length: 40 }, (_, idx) => ({
  value: idx,
  label: `Week ${idx}`,
}))

export default function CoverManagement() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [selectedLevel, setSelectedLevel] = useState('primary')
  const [selectedWeek, setSelectedWeek] = useState(() => getCurrentWeekIndexWithOverride(40))
  const [baseSchedules, setBaseSchedules] = useState([])
  const [covers, setCovers] = useState([])
  const [teachers, setTeachers] = useState([])
  const [saving, setSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState(null)
  const [form, setForm] = useState({
    base_schedule_id: '',
    cover_teacher_id: '',
    notes: '',
  })

  const fetchData = useCallback(async () => {
    const [scheduleRes, coverRes, teacherRes] = await Promise.all([
      supabase
        .from('teacher_schedules')
        .select('id, class_name, day, period, subject, teacher_id, users!teacher_schedules_teacher_id_fkey(full_name)')
        .eq('level', selectedLevel)
        .order('day', { ascending: true })
        .order('period', { ascending: true })
        .order('class_name', { ascending: true }),
      supabase
        .from('teacher_schedule_covers')
        .select(`
          id,
          week,
          notes,
          cover_teacher_id,
          created_at,
          base_schedule_id,
          cover_teacher:users!teacher_schedule_covers_cover_teacher_id_fkey(full_name),
          base_schedule:teacher_schedules!teacher_schedule_covers_base_schedule_id_fkey(
            id,class_name,day,period,subject,teacher_id,level,users!teacher_schedules_teacher_id_fkey(full_name)
          )
        `)
        .eq('week', selectedWeek)
        .order('created_at', { ascending: false }),
      supabase
        .from('users')
        .select('id, full_name')
        .in('role', ['teacher', 'admin_teacher'])
        .eq('level', selectedLevel)
        .order('full_name', { ascending: true }),
    ])

    if (scheduleRes.error || coverRes.error || teacherRes.error) {
      setStatusMessage({
        type: 'error',
        text: scheduleRes.error?.message || coverRes.error?.message || teacherRes.error?.message || 'Failed to load cover data.',
      })
      return
    }

    setBaseSchedules(scheduleRes.data || [])
    setCovers((coverRes.data || []).filter((row) => row.base_schedule && row.base_schedule.level === selectedLevel))
    setTeachers(teacherRes.data || [])
  }, [selectedLevel, selectedWeek])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const selectedBaseSchedule = useMemo(
    () => baseSchedules.find((s) => s.id === form.base_schedule_id) || null,
    [baseSchedules, form.base_schedule_id]
  )

  const createOrUpdateCover = async (e) => {
    e.preventDefault()
    if (!form.base_schedule_id || !form.cover_teacher_id) return

    setSaving(true)
    const payload = {
      base_schedule_id: form.base_schedule_id,
      week: selectedWeek,
      cover_teacher_id: form.cover_teacher_id,
      notes: form.notes.trim() || null,
      created_by: profile.id,
    }

    const { error } = await supabase
      .from('teacher_schedule_covers')
      .upsert(payload, { onConflict: 'base_schedule_id,week' })

    if (error) {
      setStatusMessage({ type: 'error', text: `Unable to save cover: ${error.message}` })
      setSaving(false)
      return
    }

    setStatusMessage({ type: 'success', text: 'Cover assignment saved.' })
    setForm({ base_schedule_id: '', cover_teacher_id: '', notes: '' })
    setSaving(false)
    await fetchData()
    window.setTimeout(() => setStatusMessage(null), 3000)
  }

  const editCover = (cover) => {
    setForm({
      base_schedule_id: cover.base_schedule_id,
      cover_teacher_id: cover.cover_teacher_id || '',
      notes: cover.notes || '',
    })
  }

  const deleteCover = async (coverId) => {
    const confirmed = window.confirm('Delete this cover assignment?')
    if (!confirmed) return

    const { error } = await supabase
      .from('teacher_schedule_covers')
      .delete()
      .eq('id', coverId)

    if (error) {
      setStatusMessage({ type: 'error', text: `Unable to delete cover: ${error.message}` })
      return
    }

    setStatusMessage({ type: 'success', text: 'Cover assignment deleted.' })
    await fetchData()
    window.setTimeout(() => setStatusMessage(null), 3000)
  }

  const formatSlot = (schedule) => {
    const day = DAYS[schedule.day] || `Day ${schedule.day}`
    const teacherName = schedule.users?.full_name || 'Unknown teacher'
    return `${day} · Period ${schedule.period} · ${schedule.class_name} · ${schedule.subject} (${teacherName})`
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
            style={{ backgroundColor: '#16a34a' }}
          >
            Open Master Schedule
          </button>
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Cover Lesson Management</h2>
        <p className="text-sm text-gray-500 mt-1">
          Assign temporary cover teachers by week. Covers only affect the selected week.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Level</label>
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="primary">Primary</option>
              <option value="secondary">Secondary</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Week</label>
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              {WEEK_OPTIONS.map((week) => (
                <option key={week.value} value={week.value}>{week.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
          statusMessage.type === 'success'
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {statusMessage.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form onSubmit={createOrUpdateCover} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Assign Cover</h3>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Base Lesson Slot</label>
            <select
              required
              value={form.base_schedule_id}
              onChange={(e) => setForm((prev) => ({ ...prev, base_schedule_id: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Select a lesson slot</option>
              {baseSchedules.map((schedule) => (
                <option key={schedule.id} value={schedule.id}>
                  {formatSlot(schedule)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Cover Teacher</label>
            <select
              required
              value={form.cover_teacher_id}
              onChange={(e) => setForm((prev) => ({ ...prev, cover_teacher_id: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Select a cover teacher</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Notes (optional)</label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Reason or instructions for this cover"
            />
          </div>

          {selectedBaseSchedule && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Original teacher keeps this lesson visible and it will be marked as covered for this week.
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
            style={{ backgroundColor: '#1f86c7' }}
          >
            {saving ? 'Saving...' : 'Save Cover Assignment'}
          </button>
        </form>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Covers for Week {selectedWeek}</h3>
          <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
            {covers.length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                No cover assignments for this week and level.
              </div>
            ) : covers.map((cover) => (
              <div key={cover.id} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
                <div className="text-sm font-medium text-gray-800">
                  {formatSlot(cover.base_schedule)}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  Cover teacher: {cover.cover_teacher?.full_name || 'Unknown'}
                </div>
                {cover.notes && (
                  <div className="text-xs text-gray-500 mt-1">Notes: {cover.notes}</div>
                )}
                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => editCover(cover)}
                    className="px-3 py-1.5 rounded border border-gray-300 text-xs text-gray-700 hover:bg-gray-100"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteCover(cover.id)}
                    className="px-3 py-1.5 rounded border border-red-200 text-xs text-red-700 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  )
}
