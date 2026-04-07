import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'

const LEVELS = ['primary', 'secondary']
const PROGRAMMES = ['bilingual', 'integrated']
const SUBJECTS = ['ESL', 'Mathematics', 'Science', 'Global Perspectives']
const RESOURCE_TYPES = ['portal', 'drive', 'pdf', 'other']
const GRADES_BY_LEVEL = {
  primary: ['1', '2', '3', '4', '5'],
  secondary: ['6', '7', '8', '9', '10', '11', '12'],
}

const LEVEL_LABEL = { primary: 'Primary', secondary: 'Secondary' }
const PROGRAMME_LABEL = { bilingual: 'Bilingual', integrated: 'Integrated' }
const TYPE_ICON = { portal: '🌐', drive: '📁', pdf: '📄', other: '🔗' }

export default function Resources() {
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ level: 'all', grade: 'all', programme: 'all', subject: 'all' })
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [showAddForm, setShowAddForm] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [newForm, setNewForm] = useState({
    title: '',
    description: '',
    url: '',
    resource_type: 'other',
    sort_order: 99,
    level: '',
    grade: '',
    programme: '',
    subject: '',
  })
  const [message, setMessage] = useState(null)

  useEffect(() => { fetchResources() }, [])

  const fetchResources = async () => {
    setLoading(true)
    const { data } = await supabase.from('resource_links').select('*').order('sort_order')
    setResources(data || [])
    setLoading(false)
  }

  const filtered = resources.filter(r =>
    (filter.level === 'all' || r.level === filter.level) &&
    (filter.grade === 'all' || r.grade === filter.grade) &&
    (filter.programme === 'all' || r.programme === filter.programme) &&
    (filter.subject === 'all' || r.subject === filter.subject)
  )

  const startEdit = (r) => {
    setEditingId(r.id)
    setEditForm({ title: r.title, description: r.description || '', url: r.url || '', resource_type: r.resource_type, sort_order: r.sort_order })
  }

  const saveEdit = async (id) => {
    const { error } = await supabase.from('resource_links').update({
      title: editForm.title,
      description: editForm.description || null,
      url: editForm.url || null,
      resource_type: editForm.resource_type,
      sort_order: editForm.sort_order,
    }).eq('id', id)
    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'success', text: 'Resource updated.' })
      setEditingId(null)
      fetchResources()
    }
  }

  const deleteResource = async (id) => {
    await supabase.from('resource_links').delete().eq('id', id)
    setConfirmDelete(null)
    fetchResources()
  }

  const addResource = async () => {
    if (!newForm.title || !newForm.level || !newForm.grade || !newForm.programme || !newForm.subject) {
      setMessage({ type: 'error', text: 'Please complete title, level, grade, programme, and subject.' })
      return
    }
    const { error } = await supabase.from('resource_links').insert({
      ...newForm,
      level: newForm.level,
      grade: newForm.grade,
      programme: newForm.programme,
      subject: newForm.subject,
      url: newForm.url || null,
      description: newForm.description || null,
    })
    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'success', text: 'Resource added.' })
      setShowAddForm(false)
      setNewForm({ title: '', description: '', url: '', resource_type: 'other', sort_order: 99, level: '', grade: '', programme: '', subject: '' })
      fetchResources()
    }
  }

  const gradeOptions = Array.from(
    new Set(
      resources
        .filter(r => filter.level === 'all' || r.level === filter.level)
        .map(r => r.grade)
        .filter(Boolean)
    )
  ).sort((a, b) => Number(a) - Number(b))

  return (
    <Layout>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Resource Management</h2>
          <p className="text-gray-500 text-sm mt-1">Add, edit or remove teacher resources.</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="w-44 px-4 py-2 text-white rounded-lg text-sm font-medium text-center"
          style={{ backgroundColor: '#1f86c7' }}
          onMouseOver={e => e.currentTarget.style.backgroundColor = '#166a9b'}
          onMouseOut={e => e.currentTarget.style.backgroundColor = '#1f86c7'}
        >
          {showAddForm ? 'Cancel' : 'New Resource'}
        </button>
      </div>

      {message && (
        <div className={`mb-6 px-4 py-3 rounded-lg text-sm font-medium ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-4 opacity-50 hover:opacity-100">✕</button>
        </div>
      )}

      {confirmDelete && (
        <div className="mb-6 px-4 py-4 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm font-medium text-red-700 mb-3">
            Are you sure you want to delete <strong>{confirmDelete.title}</strong>? This cannot be undone.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => deleteResource(confirmDelete.id)}
              className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
            >
              Yes, delete resource
            </button>
            <button
              onClick={() => setConfirmDelete(null)}
              className="px-4 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Level</label>
            <select
              value={filter.level}
              onChange={e => setFilter(f => ({ ...f, level: e.target.value, grade: 'all' }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Levels</option>
              {LEVELS.map(l => (
                <option key={l} value={l}>{LEVEL_LABEL[l]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Grade</label>
            <select
              value={filter.grade}
              onChange={e => setFilter(f => ({ ...f, grade: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Grades</option>
              {gradeOptions.map(g => (
                <option key={g} value={g}>Grade {g}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Programme</label>
            <select
              value={filter.programme}
              onChange={e => setFilter(f => ({ ...f, programme: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Programmes</option>
              {PROGRAMMES.map(p => (
                <option key={p} value={p}>{PROGRAMME_LABEL[p]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Subject</label>
            <select
              value={filter.subject}
              onChange={e => setFilter(f => ({ ...f, subject: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Subjects</option>
              {SUBJECTS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setFilter({ level: 'all', grade: 'all', programme: 'all', subject: 'all' })}
            className="px-3 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: '#d1232a' }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">Add Resource</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Level</label>
              <select
                value={newForm.level}
                onChange={e => setNewForm({ ...newForm, level: e.target.value, grade: '' })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select level</option>
                {LEVELS.map(l => (
                  <option key={l} value={l}>{LEVEL_LABEL[l]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Programme</label>
              <select
                value={newForm.programme}
                onChange={e => setNewForm({ ...newForm, programme: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select programme</option>
                {PROGRAMMES.map(p => (
                  <option key={p} value={p}>{PROGRAMME_LABEL[p]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Grade</label>
              <select
                value={newForm.grade}
                onChange={e => setNewForm({ ...newForm, grade: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select grade</option>
                {(newForm.level ? GRADES_BY_LEVEL[newForm.level] : []).map(g => (
                  <option key={g} value={g}>Grade {g}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Subject</label>
              <select
                value={newForm.subject}
                onChange={e => setNewForm({ ...newForm, subject: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select subject</option>
                {SUBJECTS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Title</label>
              <input type="text" placeholder="e.g. Study Map" value={newForm.title}
                onChange={e => setNewForm({ ...newForm, title: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Description (optional)</label>
              <input type="text" placeholder="e.g. Cambridge Stage 4 Study Map" value={newForm.description}
                onChange={e => setNewForm({ ...newForm, description: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">URL (leave blank = Coming Soon)</label>
              <input type="text" placeholder="https://..." value={newForm.url}
                onChange={e => setNewForm({ ...newForm, url: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Type</label>
              <select value={newForm.resource_type} onChange={e => setNewForm({ ...newForm, resource_type: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {RESOURCE_TYPES.map(t => <option key={t} value={t}>{TYPE_ICON[t]} {t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Sort Order</label>
              <input type="number" value={newForm.sort_order}
                onChange={e => setNewForm({ ...newForm, sort_order: parseInt(e.target.value) })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={addResource} className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              Add Resource
            </button>
            <button onClick={() => setShowAddForm(false)} className="px-5 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Resource list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No resources for this combination yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Title</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Level</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Grade</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Programme</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Subject</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Description</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">URL</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Type</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Order</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {editingId === r.id ? (
                      <input type="text" value={editForm.title}
                        onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                        className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-36" />
                    ) : <span className="font-medium text-gray-900">{r.title}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">{LEVEL_LABEL[r.level]}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                      {r.grade ? `Grade ${r.grade}` : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${r.programme === 'bilingual' ? 'bg-purple-100 text-purple-700' : 'bg-teal-100 text-teal-700'}`}>
                      {PROGRAMME_LABEL[r.programme]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{r.subject}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {editingId === r.id ? (
                      <input type="text" value={editForm.description}
                        onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                        className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48" />
                    ) : r.description || <span className="italic text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === r.id ? (
                      <input type="text" value={editForm.url}
                        onChange={e => setEditForm({ ...editForm, url: e.target.value })}
                        className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48" />
                    ) : r.url ? (
                      <a href={r.url} target="_blank" rel="noopener noreferrer"
                        className="text-blue-600 hover:underline truncate block max-w-xs">{r.url}</a>
                    ) : (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-400 rounded text-xs">Coming Soon</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === r.id ? (
                      <select value={editForm.resource_type}
                        onChange={e => setEditForm({ ...editForm, resource_type: e.target.value })}
                        className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        {RESOURCE_TYPES.map(t => <option key={t} value={t}>{TYPE_ICON[t]} {t}</option>)}
                      </select>
                    ) : <span className="text-gray-500">{TYPE_ICON[r.resource_type]} {r.resource_type}</span>}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === r.id ? (
                      <input type="number" value={editForm.sort_order}
                        onChange={e => setEditForm({ ...editForm, sort_order: parseInt(e.target.value) })}
                        className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-16 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    ) : r.sort_order}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === r.id ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(r.id)}
                          className="px-3 py-1 text-white rounded-lg text-xs font-medium"
                          style={{ backgroundColor: '#16a34a' }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1 border border-gray-300 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEdit(r)}
                          className="px-3 py-1 border rounded-lg text-xs font-medium text-white"
                          style={{ backgroundColor: '#1f86c7', borderColor: '#1f86c7' }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setConfirmDelete(r)}
                          className="px-3 py-1 border border-red-200 text-red-500 rounded-lg text-xs hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    )}
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