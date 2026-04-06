import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import Papa from 'papaparse'

export default function Students() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState(null)

  useEffect(() => {
    fetchStudents()
  }, [])

  const fetchStudents = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('students')
      .select('*')
      .order('name_eng')
    setStudents(data || [])
    setLoading(false)
  }

  const handleCSV = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true)
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data.map(row => ({
          student_id: row['Student ID'] || row['student_id'],
          name_vn: row['Name (VN)'] || row['name_vn'],
          name_eng: row['Name (ENG)'] || row['name_eng'],
          class: row['Class'] || row['class'],
          programme: row['Programme'] || row['programme'],
        }))

        const { error } = await supabase
          .from('students')
          .upsert(rows, { onConflict: 'student_id' })

        if (error) {
          setMessage({ type: 'error', text: 'Import failed: ' + error.message })
        } else {
          setMessage({ type: 'success', text: `${rows.length} students imported successfully.` })
          fetchStudents()
        }
        setImporting(false)
        e.target.value = ''
      }
    })
  }

  const filtered = students.filter(s =>
    s.name_eng?.toLowerCase().includes(search.toLowerCase()) ||
    s.name_vn?.toLowerCase().includes(search.toLowerCase()) ||
    s.student_id?.toLowerCase().includes(search.toLowerCase()) ||
    s.class?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Layout>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Students</h2>
          <p className="text-gray-500 text-sm mt-1">{students.length} students in the system</p>
        </div>
        <label className={`cursor-pointer px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
          importing ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
        }`}>
          {importing ? 'Importing...' : '+ Import CSV'}
          <input type="file" accept=".csv" className="hidden" onChange={handleCSV} disabled={importing} />
        </label>
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

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name, ID or class..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-sm border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            {students.length === 0 
              ? 'No students yet. Import a CSV to get started.' 
              : 'No students match your search.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Student ID</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">English Name</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Vietnamese Name</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Class</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Programme</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(student => (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 font-mono text-gray-600">{student.student_id}</td>
                  <td className="px-6 py-3 font-medium text-gray-900">{student.name_eng}</td>
                  <td className="px-6 py-3 text-gray-600">{student.name_vn}</td>
                  <td className="px-6 py-3 text-gray-600">{student.class}</td>
                  <td className="px-6 py-3">
                    <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                      {student.programme}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-xs text-gray-500 font-medium mb-2">CSV Format — your file should have these column headers:</p>
        <code className="text-xs text-gray-600">Student ID, Name (VN), Name (ENG), Class, Programme</code>
      </div>
    </Layout>
  )
}