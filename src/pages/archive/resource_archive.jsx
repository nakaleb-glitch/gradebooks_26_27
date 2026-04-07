import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'

const LEVELS = ['primary', 'secondary']
const PROGRAMMES = ['bilingual', 'integrated']
const SUBJECTS = ['ESL', 'Mathematics', 'Science', 'Global Perspectives']
const RESOURCE_TYPES = ['portal', 'drive', 'pdf', 'other']

const LEVEL_LABEL = { primary: 'Primary', secondary: 'Secondary' }
const PROGRAMME_LABEL = { bilingual: 'Bilingual', integrated: 'Integrated' }
const TYPE_ICON = { portal: '🌐', drive: '📁', pdf: '📄', other: '🔗' }

const DEFAULT_RESOURCES = [
  // BILINGUAL PRIMARY
  { level: 'primary', programme: 'bilingual', subject: 'ESL', title: 'Coursebook', description: 'Cambridge Primary Global English Stage 2–6', url: null, resource_type: 'portal', sort_order: 1 },
  { level: 'primary', programme: 'bilingual', subject: 'ESL', title: 'Cambridge GO', description: 'Online portal for Cambridge Primary Global English', url: 'https://www.cambridge.org/go', resource_type: 'portal', sort_order: 2 },
  { level: 'primary', programme: 'bilingual', subject: 'ESL', title: 'Study Map', description: null, url: null, resource_type: 'drive', sort_order: 3 },
  { level: 'primary', programme: 'bilingual', subject: 'ESL', title: 'Unit Resources', description: null, url: null, resource_type: 'drive', sort_order: 4 },
  { level: 'primary', programme: 'bilingual', subject: 'ESL', title: 'Unit Tests', description: null, url: null, resource_type: 'drive', sort_order: 5 },
  { level: 'primary', programme: 'bilingual', subject: 'ESL', title: 'Examinations', description: null, url: null, resource_type: 'drive', sort_order: 6 },

  { level: 'primary', programme: 'bilingual', subject: 'Mathematics', title: 'Coursebook', description: 'Cambridge Primary Mathematics Stage 2–6', url: null, resource_type: 'portal', sort_order: 1 },
  { level: 'primary', programme: 'bilingual', subject: 'Mathematics', title: 'Cambridge GO', description: 'Online portal for Cambridge Primary Mathematics', url: 'https://www.cambridge.org/go', resource_type: 'portal', sort_order: 2 },
  { level: 'primary', programme: 'bilingual', subject: 'Mathematics', title: 'Study Map', description: null, url: null, resource_type: 'drive', sort_order: 3 },
  { level: 'primary', programme: 'bilingual', subject: 'Mathematics', title: 'Unit Resources', description: null, url: null, resource_type: 'drive', sort_order: 4 },
  { level: 'primary', programme: 'bilingual', subject: 'Mathematics', title: 'Unit Tests', description: null, url: null, resource_type: 'drive', sort_order: 5 },
  { level: 'primary', programme: 'bilingual', subject: 'Mathematics', title: 'Examinations', description: null, url: null, resource_type: 'drive', sort_order: 6 },

  { level: 'primary', programme: 'bilingual', subject: 'Science', title: 'Coursebook', description: 'Cambridge Primary Science Stage 2–6', url: null, resource_type: 'portal', sort_order: 1 },
  { level: 'primary', programme: 'bilingual', subject: 'Science', title: 'Cambridge GO', description: 'Online portal for Cambridge Primary Science', url: 'https://www.cambridge.org/go', resource_type: 'portal', sort_order: 2 },
  { level: 'primary', programme: 'bilingual', subject: 'Science', title: 'Study Map', description: null, url: null, resource_type: 'drive', sort_order: 3 },
  { level: 'primary', programme: 'bilingual', subject: 'Science', title: 'Unit Resources', description: null, url: null, resource_type: 'drive', sort_order: 4 },
  { level: 'primary', programme: 'bilingual', subject: 'Science', title: 'Unit Tests', description: null, url: null, resource_type: 'drive', sort_order: 5 },
  { level: 'primary', programme: 'bilingual', subject: 'Science', title: 'Examinations', description: null, url: null, resource_type: 'drive', sort_order: 6 },

  { level: 'primary', programme: 'bilingual', subject: 'Global Perspectives', title: 'Coursebook', description: 'Cambridge Primary Global Perspectives Stage 2–6', url: null, resource_type: 'portal', sort_order: 1 },
  { level: 'primary', programme: 'bilingual', subject: 'Global Perspectives', title: 'Cambridge GO', description: 'Online portal for Cambridge Primary Global Perspectives', url: 'https://www.cambridge.org/go', resource_type: 'portal', sort_order: 2 },
  { level: 'primary', programme: 'bilingual', subject: 'Global Perspectives', title: 'Study Map', description: null, url: null, resource_type: 'drive', sort_order: 3 },
  { level: 'primary', programme: 'bilingual', subject: 'Global Perspectives', title: 'Unit Resources', description: null, url: null, resource_type: 'drive', sort_order: 4 },
  { level: 'primary', programme: 'bilingual', subject: 'Global Perspectives', title: 'Unit Tests', description: null, url: null, resource_type: 'drive', sort_order: 5 },
  { level: 'primary', programme: 'bilingual', subject: 'Global Perspectives', title: 'Examinations', description: null, url: null, resource_type: 'drive', sort_order: 6 },

  // INTEGRATED PRIMARY
  { level: 'primary', programme: 'integrated', subject: 'ESL', title: 'Coursebook', description: 'Kid\'s Box Level 2–6', url: null, resource_type: 'portal', sort_order: 1 },
  { level: 'primary', programme: 'integrated', subject: 'ESL', title: 'Cambridge One', description: 'Online portal for Kid\'s Box', url: 'https://www.cambridgeone.org', resource_type: 'portal', sort_order: 2 },
  { level: 'primary', programme: 'integrated', subject: 'ESL', title: 'Study Map', description: null, url: null, resource_type: 'drive', sort_order: 3 },
  { level: 'primary', programme: 'integrated', subject: 'ESL', title: 'Unit Resources', description: null, url: null, resource_type: 'drive', sort_order: 4 },
  { level: 'primary', programme: 'integrated', subject: 'ESL', title: 'Unit Tests', description: null, url: null, resource_type: 'drive', sort_order: 5 },
  { level: 'primary', programme: 'integrated', subject: 'ESL', title: 'Examinations', description: null, url: null, resource_type: 'drive', sort_order: 6 },

  { level: 'primary', programme: 'integrated', subject: 'Mathematics', title: 'Coursebook', description: 'Cambridge Primary Mathematics Skills Builder Stage 1–5', url: null, resource_type: 'portal', sort_order: 1 },
  { level: 'primary', programme: 'integrated', subject: 'Mathematics', title: 'Cambridge One', description: 'Online portal for Cambridge Mathematics', url: 'https://www.cambridgeone.org', resource_type: 'portal', sort_order: 2 },
  { level: 'primary', programme: 'integrated', subject: 'Mathematics', title: 'Study Map', description: null, url: null, resource_type: 'drive', sort_order: 3 },
  { level: 'primary', programme: 'integrated', subject: 'Mathematics', title: 'Unit Resources', description: null, url: null, resource_type: 'drive', sort_order: 4 },
  { level: 'primary', programme: 'integrated', subject: 'Mathematics', title: 'Unit Tests', description: null, url: null, resource_type: 'drive', sort_order: 5 },
  { level: 'primary', programme: 'integrated', subject: 'Mathematics', title: 'Examinations', description: null, url: null, resource_type: 'drive', sort_order: 6 },

  { level: 'primary', programme: 'integrated', subject: 'Science', title: 'Coursebook', description: 'Cambridge Primary Science Skills Builder Stage 1–5', url: null, resource_type: 'portal', sort_order: 1 },
  { level: 'primary', programme: 'integrated', subject: 'Science', title: 'Cambridge One', description: 'Online portal for Cambridge Science', url: 'https://www.cambridgeone.org', resource_type: 'portal', sort_order: 2 },
  { level: 'primary', programme: 'integrated', subject: 'Science', title: 'Study Map', description: null, url: null, resource_type: 'drive', sort_order: 3 },
  { level: 'primary', programme: 'integrated', subject: 'Science', title: 'Unit Resources', description: null, url: null, resource_type: 'drive', sort_order: 4 },
  { level: 'primary', programme: 'integrated', subject: 'Science', title: 'Unit Tests', description: null, url: null, resource_type: 'drive', sort_order: 5 },
  { level: 'primary', programme: 'integrated', subject: 'Science', title: 'Examinations', description: null, url: null, resource_type: 'drive', sort_order: 6 },

  // BILINGUAL SECONDARY
  { level: 'secondary', programme: 'bilingual', subject: 'ESL', title: 'Coursebook', description: 'Cambridge Lower Secondary Global English Stage 7–9', url: null, resource_type: 'portal', sort_order: 1 },
  { level: 'secondary', programme: 'bilingual', subject: 'ESL', title: 'Cambridge GO', description: 'Online portal for Cambridge Lower Secondary Global English', url: 'https://www.cambridge.org/go', resource_type: 'portal', sort_order: 2 },
  { level: 'secondary', programme: 'bilingual', subject: 'ESL', title: 'Study Map', description: null, url: null, resource_type: 'drive', sort_order: 3 },
  { level: 'secondary', programme: 'bilingual', subject: 'ESL', title: 'Unit Resources', description: null, url: null, resource_type: 'drive', sort_order: 4 },
  { level: 'secondary', programme: 'bilingual', subject: 'ESL', title: 'Unit Tests', description: null, url: null, resource_type: 'drive', sort_order: 5 },
  { level: 'secondary', programme: 'bilingual', subject: 'ESL', title: 'Examinations', description: null, url: null, resource_type: 'drive', sort_order: 6 },

  { level: 'secondary', programme: 'bilingual', subject: 'Mathematics', title: 'Coursebook', description: 'Cambridge Lower Secondary Mathematics Stage 7–9', url: null, resource_type: 'portal', sort_order: 1 },
  { level: 'secondary', programme: 'bilingual', subject: 'Mathematics', title: 'Cambridge GO', description: 'Online portal for Cambridge Lower Secondary Mathematics', url: 'https://www.cambridge.org/go', resource_type: 'portal', sort_order: 2 },
  { level: 'secondary', programme: 'bilingual', subject: 'Mathematics', title: 'Study Map', description: null, url: null, resource_type: 'drive', sort_order: 3 },
  { level: 'secondary', programme: 'bilingual', subject: 'Mathematics', title: 'Unit Resources', description: null, url: null, resource_type: 'drive', sort_order: 4 },
  { level: 'secondary', programme: 'bilingual', subject: 'Mathematics', title: 'Unit Tests', description: null, url: null, resource_type: 'drive', sort_order: 5 },
  { level: 'secondary', programme: 'bilingual', subject: 'Mathematics', title: 'Examinations', description: null, url: null, resource_type: 'drive', sort_order: 6 },

  { level: 'secondary', programme: 'bilingual', subject: 'Science', title: 'Coursebook', description: 'Cambridge Lower Secondary Science Stage 7–9', url: null, resource_type: 'portal', sort_order: 1 },
  { level: 'secondary', programme: 'bilingual', subject: 'Science', title: 'Cambridge GO', description: 'Online portal for Cambridge Lower Secondary Science', url: 'https://www.cambridge.org/go', resource_type: 'portal', sort_order: 2 },
  { level: 'secondary', programme: 'bilingual', subject: 'Science', title: 'Study Map', description: null, url: null, resource_type: 'drive', sort_order: 3 },
  { level: 'secondary', programme: 'bilingual', subject: 'Science', title: 'Unit Resources', description: null, url: null, resource_type: 'drive', sort_order: 4 },
  { level: 'secondary', programme: 'bilingual', subject: 'Science', title: 'Unit Tests', description: null, url: null, resource_type: 'drive', sort_order: 5 },
  { level: 'secondary', programme: 'bilingual', subject: 'Science', title: 'Examinations', description: null, url: null, resource_type: 'drive', sort_order: 6 },

  // INTEGRATED SECONDARY
  { level: 'secondary', programme: 'integrated', subject: 'ESL', title: 'Coursebook', description: 'Think / Think 2', url: null, resource_type: 'portal', sort_order: 1 },
  { level: 'secondary', programme: 'integrated', subject: 'ESL', title: 'Cambridge One', description: 'Online portal for Think series', url: 'https://www.cambridgeone.org', resource_type: 'portal', sort_order: 2 },
  { level: 'secondary', programme: 'integrated', subject: 'ESL', title: 'Study Map', description: null, url: null, resource_type: 'drive', sort_order: 3 },
  { level: 'secondary', programme: 'integrated', subject: 'ESL', title: 'Unit Resources', description: null, url: null, resource_type: 'drive', sort_order: 4 },
  { level: 'secondary', programme: 'integrated', subject: 'ESL', title: 'Unit Tests', description: null, url: null, resource_type: 'drive', sort_order: 5 },
  { level: 'secondary', programme: 'integrated', subject: 'ESL', title: 'Examinations', description: null, url: null, resource_type: 'drive', sort_order: 6 },

  { level: 'secondary', programme: 'integrated', subject: 'Mathematics', title: 'Coursebook', description: 'Cambridge Mathematics Skills Builder Stage 6 – Lower Secondary Stage 8', url: null, resource_type: 'portal', sort_order: 1 },
  { level: 'secondary', programme: 'integrated', subject: 'Mathematics', title: 'Cambridge One', description: 'Online portal for Cambridge Mathematics', url: 'https://www.cambridgeone.org', resource_type: 'portal', sort_order: 2 },
  { level: 'secondary', programme: 'integrated', subject: 'Mathematics', title: 'Study Map', description: null, url: null, resource_type: 'drive', sort_order: 3 },
  { level: 'secondary', programme: 'integrated', subject: 'Mathematics', title: 'Unit Resources', description: null, url: null, resource_type: 'drive', sort_order: 4 },
  { level: 'secondary', programme: 'integrated', subject: 'Mathematics', title: 'Unit Tests', description: null, url: null, resource_type: 'drive', sort_order: 5 },
  { level: 'secondary', programme: 'integrated', subject: 'Mathematics', title: 'Examinations', description: null, url: null, resource_type: 'drive', sort_order: 6 },

  { level: 'secondary', programme: 'integrated', subject: 'Science', title: 'Coursebook', description: 'Cambridge Science Skills Builder Stage 6 – Lower Secondary Stage 8', url: null, resource_type: 'portal', sort_order: 1 },
  { level: 'secondary', programme: 'integrated', subject: 'Science', title: 'Cambridge One', description: 'Online portal for Cambridge Science', url: 'https://www.cambridgeone.org', resource_type: 'portal', sort_order: 2 },
  { level: 'secondary', programme: 'integrated', subject: 'Science', title: 'Study Map', description: null, url: null, resource_type: 'drive', sort_order: 3 },
  { level: 'secondary', programme: 'integrated', subject: 'Science', title: 'Unit Resources', description: null, url: null, resource_type: 'drive', sort_order: 4 },
  { level: 'secondary', programme: 'integrated', subject: 'Science', title: 'Unit Tests', description: null, url: null, resource_type: 'drive', sort_order: 5 },
  { level: 'secondary', programme: 'integrated', subject: 'Science', title: 'Examinations', description: null, url: null, resource_type: 'drive', sort_order: 6 },
]

export default function Resources() {
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ level: 'secondary', programme: 'bilingual', subject: 'ESL' })
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [showAddForm, setShowAddForm] = useState(false)
  const [newForm, setNewForm] = useState({ title: '', description: '', url: '', resource_type: 'other', sort_order: 99 })
  const [message, setMessage] = useState(null)
  const [seeding, setSeeding] = useState(false)

  useEffect(() => { fetchResources() }, [])

  const fetchResources = async () => {
    setLoading(true)
    const { data } = await supabase.from('resource_links').select('*').order('sort_order')
    setResources(data || [])
    setLoading(false)
  }

  const filtered = resources.filter(r =>
    r.level === filter.level &&
    r.programme === filter.programme &&
    r.subject === filter.subject
  )

  const seedDefaults = async () => {
    setSeeding(true)
    const { error } = await supabase.from('resource_links').insert(DEFAULT_RESOURCES)
    if (error) {
      setMessage({ type: 'error', text: 'Seed failed: ' + error.message })
    } else {
      setMessage({ type: 'success', text: 'Default resources seeded successfully.' })
      fetchResources()
    }
    setSeeding(false)
  }

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
    fetchResources()
  }

  const addResource = async () => {
    if (!newForm.title) return
    const { error } = await supabase.from('resource_links').insert({
      ...newForm,
      level: filter.level,
      programme: filter.programme,
      subject: filter.subject,
      url: newForm.url || null,
      description: newForm.description || null,
    })
    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'success', text: 'Resource added.' })
      setShowAddForm(false)
      setNewForm({ title: '', description: '', url: '', resource_type: 'other', sort_order: 99 })
      fetchResources()
    }
  }

  return (
    <Layout>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Teacher Resources</h2>
          <p className="text-gray-500 text-sm mt-1">Manage resource links by level, programme and subject. Changes apply to all matching classes.</p>
        </div>
        <div className="flex gap-2">
          {resources.length === 0 && (
            <button onClick={seedDefaults} disabled={seeding}
              className="px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600 disabled:bg-gray-300">
              {seeding ? 'Seeding...' : '⚡ Seed Defaults'}
            </button>
          )}
          <button onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: '#1f86c7' }}>
            {showAddForm ? 'Cancel' : '+ Add Resource'}
          </button>
        </div>
      </div>

      {message && (
        <div className={`mb-6 px-4 py-3 rounded-lg text-sm font-medium ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-4 opacity-50 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        {LEVELS.map(l => (
          <button key={l} onClick={() => setFilter(f => ({ ...f, level: l }))}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              filter.level === l ? 'text-white border-transparent' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
            style={filter.level === l ? { backgroundColor: '#d1232a' } : {}}>
            {LEVEL_LABEL[l]}
          </button>
        ))}
        <div className="w-px bg-gray-200 mx-1" />
        {PROGRAMMES.map(p => (
          <button key={p} onClick={() => setFilter(f => ({ ...f, programme: p }))}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              filter.programme === p ? 'text-white border-transparent' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
            style={filter.programme === p ? { backgroundColor: '#1f86c7' } : {}}>
            {PROGRAMME_LABEL[p]}
          </button>
        ))}
        <div className="w-px bg-gray-200 mx-1" />
        {SUBJECTS.map(s => (
          <button key={s} onClick={() => setFilter(f => ({ ...f, subject: s }))}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              filter.subject === s ? 'text-white border-transparent' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
            style={filter.subject === s ? { backgroundColor: '#ffc612', color: filter.subject === s ? '#1a1a1a' : undefined } : {}}>
            {s}
          </button>
        ))}
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">
            Add Resource — {LEVEL_LABEL[filter.level]} · {PROGRAMME_LABEL[filter.programme]} · {filter.subject}
          </h3>
          <div className="grid grid-cols-2 gap-4">
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
            <button onClick={addResource}
              className="px-5 py-2 text-white rounded-lg text-sm font-medium"
              style={{ backgroundColor: '#1f86c7' }}>
              Add Resource
            </button>
            <button onClick={() => setShowAddForm(false)}
              className="px-5 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Resource list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            No resources for this combination yet.
            {resources.length === 0 && (
              <p className="mt-2 text-sm">Click <strong>⚡ Seed Defaults</strong> to populate all combinations at once.</p>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Title</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Description</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">URL</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Type</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Order</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3">
                    {editingId === r.id ? (
                      <input type="text" value={editForm.title}
                        onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-40" />
                    ) : (
                      <span className="font-medium text-gray-900">{r.title}</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-gray-500">
                    {editingId === r.id ? (
                      <input type="text" value={editForm.description}
                        onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-56" />
                    ) : r.description || <span className="italic text-gray-300">—</span>}
                  </td>
                  <td className="px-6 py-3">
                    {editingId === r.id ? (
                      <input type="text" value={editForm.url}
                        onChange={e => setEditForm({ ...editForm, url: e.target.value })}
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-56" />
                    ) : r.url ? (
                      <a href={r.url} target="_blank" rel="noopener noreferrer"
                        className="text-blue-600 hover:underline truncate block max-w-xs">{r.url}</a>
                    ) : (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-400 rounded text-xs">Coming Soon</span>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    {editingId === r.id ? (
                      <select value={editForm.resource_type}
                        onChange={e => setEditForm({ ...editForm, resource_type: e.target.value })}
                        className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        {RESOURCE_TYPES.map(t => <option key={t} value={t}>{TYPE_ICON[t]} {t}</option>)}
                      </select>
                    ) : (
                      <span className="text-gray-500">{TYPE_ICON[r.resource_type]} {r.resource_type}</span>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    {editingId === r.id ? (
                      <input type="number" value={editForm.sort_order}
                        onChange={e => setEditForm({ ...editForm, sort_order: parseInt(e.target.value) })}
                        className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-16 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    ) : r.sort_order}
                  </td>
                  <td className="px-6 py-3">
                    {editingId === r.id ? (
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(r.id)}
                          className="px-3 py-1 text-white rounded-lg text-xs font-medium"
                          style={{ backgroundColor: '#1f86c7' }}>Save</button>
                        <button onClick={() => setEditingId(null)}
                          className="px-3 py-1 border border-gray-300 text-gray-600 rounded-lg text-xs hover:bg-gray-50">Cancel</button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(r)}
                          className="px-3 py-1 border border-gray-300 text-gray-600 rounded-lg text-xs hover:bg-gray-50">Edit</button>
                        <button onClick={() => deleteResource(r.id)}
                          className="px-3 py-1 border border-red-200 text-red-500 rounded-lg text-xs hover:bg-red-50">Delete</button>
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