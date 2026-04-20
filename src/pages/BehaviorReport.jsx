import { useCallback, useEffect, useMemo, useState } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

const INCIDENT_TYPES = ['Disruption', 'Respect', 'Bullying', 'Academic Dishonesty', 'Attendance', 'Other']
const SEVERITY_LEVELS = ['Low', 'Medium', 'High']

export default function BehaviorReport() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [classes, setClasses] = useState([])
  const [students, setStudents] = useState([])
  const [submittedReports, setSubmittedReports] = useState([])
  const [loadingReports, setLoadingReports] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [message, setMessage] = useState(null)
  const [form, setForm] = useState({
    class_id: '',
    student_id: '',
    incident_date: new Date().toISOString().slice(0, 10),
    incident_type: 'Disruption',
    severity: 'Medium',
    description: '',
    action_taken: '',
  })

  const fetchTeacherClasses = useCallback(async () => {
    if (!profile?.id) return
    const { data } = await supabase
      .from('classes')
      .select('id, name, subject')
      .eq('teacher_id', profile.id)
      .order('name')
    setClasses(data || [])
  }, [profile?.id])

  const fetchSubmittedReports = useCallback(async () => {
    if (!profile?.id) return
    setLoadingReports(true)
    const { data } = await supabase
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
        classes(name, subject),
        students(student_id, name_eng, name_vn)
      `)
      .eq('reporter_id', profile.id)
      .order('incident_date', { ascending: false })
      .order('created_at', { ascending: false })

    setSubmittedReports(data || [])
    setLoadingReports(false)
  }, [profile?.id])

  useEffect(() => {
    fetchTeacherClasses()
  }, [fetchTeacherClasses])

  useEffect(() => {
    fetchSubmittedReports()
  }, [fetchSubmittedReports])

  useEffect(() => {
    if (form.class_id) fetchClassStudents(form.class_id)
  }, [form.class_id])

  const selectedClass = useMemo(
    () => classes.find(c => c.id === form.class_id),
    [classes, form.class_id]
  )

  const fetchClassStudents = async (classId) => {
    const { data } = await supabase
      .from('class_students')
      .select('student_id, students(id, name_eng, name_vn, student_id)')
      .eq('class_id', classId)

    const list = (data || [])
      .map(row => row.students)
      .filter(Boolean)
      .sort((a, b) => (a.name_eng || '').localeCompare(b.name_eng || ''))

    setStudents(list)
  }

  const submitReport = async (e) => {
    e.preventDefault()
    if (!form.class_id || !form.student_id || !form.incident_date || !form.description.trim()) {
      setMessage({ type: 'error', text: 'Please complete class, student, date, and description.' })
      return
    }

    setSaving(true)
    const payload = {
      reporter_id: profile.id,
      class_id: form.class_id,
      student_id: form.student_id,
      incident_date: form.incident_date,
      incident_type: form.incident_type,
      severity: form.severity,
      description: form.description.trim(),
      action_taken: form.action_taken.trim() || null,
      status: 'new',
    }

    const { error } = await supabase.from('behavior_reports').insert(payload)
    if (error) {
      setMessage({ type: 'error', text: error.message })
      setSaving(false)
      return
    }

    setMessage({ type: 'success', text: 'Behavior report submitted for admin review.' })
    setForm(prev => ({
      ...prev,
      class_id: '',
      student_id: '',
      incident_type: 'Disruption',
      severity: 'Medium',
      description: '',
      action_taken: '',
    }))
    setStudents([])
    setShowForm(false)
    fetchSubmittedReports()
    setSaving(false)
  }

  return (
    <Layout>
      <div className="mb-8">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-sm text-gray-400 hover:text-gray-600 mb-4 flex items-center gap-1"
        >
          ← Go Back
        </button>
        <h2 className="text-2xl font-bold text-gray-900">Behavior Management Report</h2>
        <p className="text-gray-500 text-sm mt-1">Submit a student behavior report for admin review.</p>
      </div>

      {message && (
        <div className={`mb-6 px-4 py-3 rounded-lg text-sm font-medium ${
          message.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {!showForm && (
        <div className="mb-6 flex justify-end">
          <button
            onClick={() => setShowForm(true)}
            className="px-5 py-2 bg-[#ffc612] text-[#1a1a1a] rounded-lg text-sm font-medium hover:brightness-95"
          >
            Create Report
          </button>
        </div>
      )}

      {showForm && (
        <form onSubmit={submitReport} className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Class</label>
              <select
                value={form.class_id}
                onChange={e => setForm(prev => ({ ...prev, class_id: e.target.value, student_id: '' }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select class</option>
                {classes.map(cls => (
                  <option key={cls.id} value={cls.id}>{cls.name} ({cls.subject})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Student</label>
              <select
                value={form.student_id}
                onChange={e => setForm(prev => ({ ...prev, student_id: e.target.value }))}
                disabled={!form.class_id}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
              >
                <option value="">{form.class_id ? 'Select student' : 'Select class first'}</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name_eng} {s.name_vn ? `- ${s.name_vn}` : ''} ({s.student_id})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Date of Incident</label>
              <input
                type="date"
                value={form.incident_date}
                onChange={e => setForm(prev => ({ ...prev, incident_date: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Severity</label>
              <select
                value={form.severity}
                onChange={e => setForm(prev => ({ ...prev, severity: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {SEVERITY_LEVELS.map(level => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-medium text-gray-500 block mb-1">Incident Type</label>
              <select
                value={form.incident_type}
                onChange={e => setForm(prev => ({ ...prev, incident_type: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {INCIDENT_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-medium text-gray-500 block mb-1">Incident Description</label>
              <textarea
                rows={4}
                value={form.description}
                onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Describe what happened..."
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-medium text-gray-500 block mb-1">Action Taken (optional)</label>
              <textarea
                rows={3}
                value={form.action_taken}
                onChange={e => setForm(prev => ({ ...prev, action_taken: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="What actions have already been taken?"
              />
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:bg-gray-300"
            >
              {saving ? 'Submitting...' : 'Submit Report'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-5 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            {selectedClass && (
              <span className="ml-3 text-xs text-gray-500">Reporting for: {selectedClass.name}</span>
            )}
          </div>
        </form>
      )}

      <div className="mt-8 bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">My Submitted Reports</h3>
          <p className="text-xs text-gray-500 mt-1">View status updates and admin comments for your submitted reports.</p>
        </div>
        {loadingReports ? (
          <div className="p-6 text-sm text-gray-400">Loading reports...</div>
        ) : submittedReports.length === 0 ? (
          <div className="p-6 text-sm text-gray-400">No reports submitted yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Date</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Student</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Class</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Type / Severity</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Admin Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {submittedReports.map(report => (
                <tr key={report.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">{report.incident_date}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{report.students?.name_eng || '—'}</div>
                    <div className="text-xs text-gray-500">{report.students?.name_vn || '—'}</div>
                    <div className="text-xs text-gray-400">{report.students?.student_id || '—'}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    <div>{report.classes?.name || '—'}</div>
                    <div className="text-xs text-gray-500">{report.classes?.subject || ''}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    <div>{report.incident_type}</div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      report.severity === 'High'
                        ? 'bg-red-100 text-red-700'
                        : report.severity === 'Medium'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-blue-100 text-blue-700'
                    }`}>
                      {report.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      report.status === 'resolved'
                        ? 'bg-green-100 text-green-700'
                        : report.status === 'reviewed'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-amber-100 text-amber-700'
                    }`}>
                      {report.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-pre-wrap max-w-xs">{report.admin_notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  )
}
