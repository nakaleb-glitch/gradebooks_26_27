import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import { supabase } from '../../lib/supabase'

const STATUS_OPTIONS = ['new', 'reviewed', 'resolved']

export default function BehaviorManagement() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState(null)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    fetchReports()
  }, [])

  const fetchReports = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('behavior_reports')
      .select(`
        *,
        classes(name, subject),
        students(student_id, name_eng, name_vn),
        users!behavior_reports_reporter_id_fkey(full_name, staff_id)
      `)
      .order('incident_date', { ascending: false })
      .order('created_at', { ascending: false })

    setReports(data || [])
    setLoading(false)
  }

  const updateReport = async (id, patch) => {
    setUpdatingId(id)
    const { error } = await supabase
      .from('behavior_reports')
      .update(patch)
      .eq('id', id)
    if (error) {
      setMessage({ type: 'error', text: error.message })
      setUpdatingId(null)
      return
    }
    setReports(prev => prev.map(report => (report.id === id ? { ...report, ...patch } : report)))
    setMessage({ type: 'success', text: 'Report updated.' })
    setUpdatingId(null)
  }

  return (
    <Layout>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Behavior Management</h2>
        <p className="text-gray-500 text-sm mt-1">Review teacher-submitted behavior reports and track follow-up status.</p>
      </div>

      {message && (
        <div className={`mb-6 px-4 py-3 rounded-lg text-sm font-medium ${
          message.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-4 opacity-50 hover:opacity-100">✕</button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading reports...</div>
        ) : reports.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No behavior reports submitted yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Date</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Student</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Class</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Type / Severity</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Description</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Action Taken</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Submitted By</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Admin Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reports.map(report => (
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
                  <td className="px-4 py-3 text-gray-700 max-w-xs whitespace-pre-wrap">{report.description}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs whitespace-pre-wrap">{report.action_taken || '—'}</td>
                  <td className="px-4 py-3 text-gray-700">
                    <div>{report.users?.full_name || '—'}</div>
                    <div className="text-xs text-gray-500">{report.users?.staff_id || '—'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={report.status}
                      onChange={e => updateReport(report.id, { status: e.target.value })}
                      disabled={updatingId === report.id}
                      className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    >
                      {STATUS_OPTIONS.map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 min-w-60">
                    <textarea
                      defaultValue={report.admin_notes || ''}
                      rows={2}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Add admin follow-up notes..."
                      onBlur={e => {
                        if ((report.admin_notes || '') !== e.target.value) {
                          updateReport(report.id, { admin_notes: e.target.value || null })
                        }
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  )
}
