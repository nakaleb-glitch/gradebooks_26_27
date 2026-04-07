import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import { supabase } from '../../lib/supabase'

const TYPE_LABEL = {
  event: 'Event',
  deadline: 'Admin Deadline',
}

export default function EventsDeadlines() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [message, setMessage] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [form, setForm] = useState({
    item_type: 'event',
    event_date: '',
    title: '',
    venue: '',
    description: '',
    plan_url: '',
  })

  useEffect(() => { fetchItems() }, [])

  const fetchItems = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('events_deadlines')
      .select('*')
      .order('event_date', { ascending: true })
      .order('created_at', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  const resetForm = () => {
    setForm({
      item_type: 'event',
      event_date: '',
      title: '',
      venue: '',
      description: '',
      plan_url: '',
    })
    setEditingId(null)
    setShowForm(false)
  }

  const startEdit = (item) => {
    setEditingId(item.id)
    setShowForm(true)
    setForm({
      item_type: item.item_type || 'event',
      event_date: item.event_date || '',
      title: item.title || '',
      venue: item.venue || '',
      description: item.description || '',
      plan_url: item.plan_url || '',
    })
  }

  const saveItem = async () => {
    if (!form.event_date || !form.title || !form.venue || !form.description) {
      setMessage({ type: 'error', text: 'Please complete date, title, venue, and description.' })
      return
    }

    setSaving(true)
    const payload = {
      item_type: form.item_type,
      event_date: form.event_date,
      title: form.title.trim(),
      venue: form.venue.trim(),
      description: form.description.trim(),
      plan_url: form.plan_url.trim() || null,
    }

    const query = editingId
      ? supabase.from('events_deadlines').update(payload).eq('id', editingId)
      : supabase.from('events_deadlines').insert(payload)

    const { error } = await query

    if (error) {
      setMessage({ type: 'error', text: error.message })
      setSaving(false)
      return
    }

    setMessage({ type: 'success', text: editingId ? 'Item updated.' : 'Item created.' })
    setSaving(false)
    resetForm()
    fetchItems()
  }

  const deleteItem = async (id) => {
    const { error } = await supabase.from('events_deadlines').delete().eq('id', id)
    if (error) {
      setMessage({ type: 'error', text: error.message })
      return
    }
    setConfirmDelete(null)
    setMessage({ type: 'success', text: 'Item deleted.' })
    fetchItems()
  }

  return (
    <Layout>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Event & Admin Deadline Management</h2>
          <p className="text-gray-500 text-sm mt-1">Create, update or remove teacher-facing events and admin deadlines.</p>
        </div>
        <button
          onClick={() => {
            if (showForm && editingId) {
              resetForm()
            } else {
              setShowForm(!showForm)
              if (showForm) resetForm()
            }
          }}
          className="w-56 px-4 py-2 text-white rounded-lg text-sm font-medium text-center"
          style={{ backgroundColor: '#1f86c7' }}
          onMouseOver={e => e.currentTarget.style.backgroundColor = '#166a9b'}
          onMouseOut={e => e.currentTarget.style.backgroundColor = '#1f86c7'}
        >
          {showForm ? 'Cancel' : 'New Event / Deadline'}
        </button>
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

      {confirmDelete && (
        <div className="mb-6 px-4 py-4 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm font-medium text-red-700 mb-3">
            Are you sure you want to delete <strong>{confirmDelete.title}</strong>? This cannot be undone.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => deleteItem(confirmDelete.id)}
              className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
            >
              Yes, delete item
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

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">{editingId ? 'Edit Item' : 'Add New Item'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Type</label>
              <select
                value={form.item_type}
                onChange={e => setForm(prev => ({ ...prev, item_type: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="event">Event</option>
                <option value="deadline">Admin Deadline</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Date</label>
              <input
                type="date"
                value={form.event_date}
                onChange={e => setForm(prev => ({ ...prev, event_date: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Event / Deadline Name</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Location / Venue</label>
              <input
                type="text"
                value={form.venue}
                onChange={e => setForm(prev => ({ ...prev, venue: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-gray-500 block mb-1">Brief Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-gray-500 block mb-1">Planning Link (optional)</label>
              <input
                type="url"
                placeholder="https://..."
                value={form.plan_url}
                onChange={e => setForm(prev => ({ ...prev, plan_url: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={saveItem}
              disabled={saving}
              className="px-4 py-2 text-white rounded-lg text-sm font-medium disabled:bg-gray-300"
              style={{ backgroundColor: '#16a34a' }}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No events or deadlines yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Type</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Date</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Name</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Location / Venue</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Description</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Planning Link</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      item.item_type === 'deadline' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {TYPE_LABEL[item.item_type] || 'Event'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{item.event_date}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{item.title}</td>
                  <td className="px-4 py-3 text-gray-700">{item.venue}</td>
                  <td className="px-4 py-3 text-gray-600">{item.description}</td>
                  <td className="px-4 py-3">
                    {item.plan_url ? (
                      <a href={item.plan_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        Open Link
                      </a>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(item)}
                        className="px-3 py-1 border rounded-lg text-xs font-medium text-white"
                        style={{ backgroundColor: '#1f86c7', borderColor: '#1f86c7' }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setConfirmDelete(item)}
                        className="px-3 py-1 border border-red-200 text-red-500 rounded-lg text-xs hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
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
