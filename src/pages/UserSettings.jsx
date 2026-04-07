import { useMemo, useState } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

export default function UserSettings() {
  const navigate = useNavigate()
  const { user, profile, refreshProfile } = useAuth()
  const [uploading, setUploading] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState(null)

  const avatarUrl = useMemo(() => {
    return user?.user_metadata?.avatar_url || null
  }, [user])

  const initials = useMemo(() => {
    const fullName = profile?.full_name || user?.email || 'U'
    return String(fullName)
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('')
  }, [profile?.full_name, user?.email])

  const formatDisplayText = (value) =>
    String(value || '')
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase())

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Please upload an image file only.' })
      e.target.value = ''
      return
    }

    if (!user?.id) {
      setMessage({ type: 'error', text: 'No active user session found.' })
      e.target.value = ''
      return
    }

    try {
      setUploading(true)
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const filePath = `${user.id}/${Date.now()}-${safeName}`

      const { error: uploadError } = await supabase
        .storage
        .from('profile-images')
        .upload(filePath, file, { upsert: false })

      if (uploadError) {
        throw uploadError
      }

      const { data } = supabase
        .storage
        .from('profile-images')
        .getPublicUrl(filePath)

      const publicUrl = data?.publicUrl
      if (!publicUrl) {
        throw new Error('Could not retrieve uploaded image URL.')
      }

      const { error: authError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl },
      })

      if (authError) throw authError

      await refreshProfile()
      setMessage({ type: 'success', text: 'Profile picture updated successfully.' })
    } catch (error) {
      setMessage({
        type: 'error',
        text: `Upload failed: ${error.message}. Ensure storage bucket "profile-images" exists and is public.`,
      })
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handlePasswordUpdate = async (e) => {
    e.preventDefault()
    setMessage(null)

    if (password.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters.' })
      return
    }
    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' })
      return
    }

    try {
      setSavingPassword(true)
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error

      setPassword('')
      setConfirmPassword('')
      setMessage({ type: 'success', text: 'Password updated successfully.' })
    } catch (error) {
      setMessage({ type: 'error', text: `Password update failed: ${error.message}` })
    } finally {
      setSavingPassword(false)
    }
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
        <h2 className="text-2xl font-bold text-gray-900">User Settings</h2>
        <p className="text-gray-500 text-sm mt-1">Review your user profile information, upload a profil picture and reset your password.</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Profile Information</h3>
          <div className="flex items-center gap-4 mb-5">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile" className="w-16 h-16 rounded-full object-cover border border-gray-200" />
            ) : (
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-white font-semibold" style={{ backgroundColor: '#1f86c7' }}>
                {initials}
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-gray-900">{profile?.full_name || 'No name'}</p>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
          </div>

          <label
            className={`inline-block cursor-pointer px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              uploading ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : ''
            }`}
            style={uploading ? {} : { backgroundColor: '#ffc612', color: '#1a1a1a' }}
          >
            {uploading ? 'Uploading...' : 'Upload Profile Picture'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
              disabled={uploading}
            />
          </label>
          <p className="text-xs text-gray-400 mt-2">Optional. Recommended square image, JPG or PNG.</p>

          <div className="mt-5 border-t border-gray-100 pt-4 space-y-2 text-sm">
            <div><span className="text-gray-500">Staff ID:</span> <span className="text-gray-900">{profile?.staff_id || '—'}</span></div>
            <div><span className="text-gray-500">Role:</span> <span className="text-gray-900">{profile?.role ? formatDisplayText(profile.role) : '—'}</span></div>
            <div><span className="text-gray-500">Level:</span> <span className="text-gray-900">{profile?.level ? formatDisplayText(profile.level) : '—'}</span></div>
            <div><span className="text-gray-500">Subject:</span> <span className="text-gray-900">{profile?.subject ? formatDisplayText(profile.subject) : '—'}</span></div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Reset Password</h3>
          <form onSubmit={handlePasswordUpdate} className="space-y-3">
            <input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={savingPassword}
              className="w-full rounded-lg text-white py-2 text-sm font-medium disabled:bg-gray-300"
              style={{ backgroundColor: '#1f86c7' }}
            >
              {savingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </form>
          <p className="text-xs text-gray-400 mt-2">Use at least 8 characters.</p>
        </div>
      </div>
    </Layout>
  )
}
