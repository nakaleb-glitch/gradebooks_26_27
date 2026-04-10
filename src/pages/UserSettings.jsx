import { useMemo, useState } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

export default function UserSettings() {
  const CROP_PREVIEW_SIZE = 256
  const CROP_OUTPUT_SIZE = 512
  const navigate = useNavigate()
  const { user, profile, refreshProfile } = useAuth()
  const [uploading, setUploading] = useState(false)
  const [showCropModal, setShowCropModal] = useState(false)
  const [rawImageUrl, setRawImageUrl] = useState(null)
  const [pendingFileName, setPendingFileName] = useState('')
  const [sourceImage, setSourceImage] = useState(null)
  const [zoom, setZoom] = useState(1.1)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
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

  const uploadAvatarBlob = async (blob, sourceName = 'avatar.png') => {
    if (!user?.id) {
      setMessage({ type: 'error', text: 'No active user session found.' })
      return
    }

    const safeName = sourceName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filePath = `${user.id}/${Date.now()}-${safeName}`

    const { error: uploadError } = await supabase
      .storage
      .from('profile-images')
      .upload(filePath, blob, { upsert: false, contentType: 'image/png' })

    if (uploadError) throw uploadError

    const { data } = supabase
      .storage
      .from('profile-images')
      .getPublicUrl(filePath)

    const publicUrl = data?.publicUrl
    if (!publicUrl) throw new Error('Could not retrieve uploaded image URL.')

    const { error: authError } = await supabase.auth.updateUser({
      data: { avatar_url: publicUrl },
    })

    if (authError) throw authError

    // For student users: also save avatar_url directly to students table (single source of truth)
    if (profile?.role === 'student' && profile?.student_id_ref) {
      await supabase
        .from('students')
        .update({ avatar_url: publicUrl })
        .eq('id', profile.student_id_ref)
    }
    
    // For teacher/admin users: also save avatar_url directly to users table
    if ((profile?.role === 'teacher' || profile?.role === 'admin') && user?.id) {
      await supabase
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id)
    }
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Please upload an image file only.' })
      e.target.value = ''
      return
    }

    try {
      const objectUrl = URL.createObjectURL(file)
      const img = new Image()
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        img.src = objectUrl
      })
      setSourceImage(img)
      setRawImageUrl(objectUrl)
      setPendingFileName(file.name || 'avatar.png')
      setZoom(1.1)
      setOffsetX(0)
      setOffsetY(0)
      setShowCropModal(true)
    } catch (error) {
      setMessage({
        type: 'error',
        text: `Image load failed: ${error.message}.`,
      })
    }
    e.target.value = ''
  }

  const closeCropModal = () => {
    setShowCropModal(false)
    if (rawImageUrl) URL.revokeObjectURL(rawImageUrl)
    setRawImageUrl(null)
    setSourceImage(null)
    setPendingFileName('')
  }

  const previewBaseScale = useMemo(() => {
    if (!sourceImage?.width || !sourceImage?.height) return 1
    return Math.min(CROP_PREVIEW_SIZE / sourceImage.width, CROP_PREVIEW_SIZE / sourceImage.height)
  }, [sourceImage])

  const minCoverZoom = useMemo(() => {
    if (!sourceImage?.width || !sourceImage?.height || !previewBaseScale) return 1
    const fittedW = sourceImage.width * previewBaseScale
    const fittedH = sourceImage.height * previewBaseScale
    return Math.max(1, CROP_PREVIEW_SIZE / fittedW, CROP_PREVIEW_SIZE / fittedH)
  }, [sourceImage, previewBaseScale, CROP_PREVIEW_SIZE])

  const maxOffsetX = useMemo(() => {
    if (!sourceImage?.width || !previewBaseScale) return 0
    const visibleW = sourceImage.width * previewBaseScale * zoom
    return Math.max(0, (visibleW - CROP_PREVIEW_SIZE) / 2)
  }, [sourceImage, previewBaseScale, zoom, CROP_PREVIEW_SIZE])

  const maxOffsetY = useMemo(() => {
    if (!sourceImage?.height || !previewBaseScale) return 0
    const visibleH = sourceImage.height * previewBaseScale * zoom
    return Math.max(0, (visibleH - CROP_PREVIEW_SIZE) / 2)
  }, [sourceImage, previewBaseScale, zoom, CROP_PREVIEW_SIZE])

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

  const handleAutoFit = () => {
    setZoom(minCoverZoom)
    setOffsetX(0)
    setOffsetY(0)
  }

  const handleCropAndUpload = async () => {
    if (!sourceImage) return

    try {
      setUploading(true)
      const canvas = document.createElement('canvas')
      const outputSize = CROP_OUTPUT_SIZE
      canvas.width = outputSize
      canvas.height = outputSize
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Could not initialize image editor.')

      // Start from "fit" scale to avoid over-zooming by default.
      const baseScale = Math.min(outputSize / sourceImage.width, outputSize / sourceImage.height)
      const finalScale = baseScale * zoom
      const drawW = sourceImage.width * finalScale
      const drawH = sourceImage.height * finalScale
      const drawX = (outputSize - drawW) / 2 + offsetX
      const drawY = (outputSize - drawH) / 2 + offsetY

      ctx.clearRect(0, 0, outputSize, outputSize)
      ctx.drawImage(sourceImage, drawX, drawY, drawW, drawH)

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 0.95))
      if (!blob) throw new Error('Could not generate cropped image.')

      await uploadAvatarBlob(blob, pendingFileName || 'avatar.png')
      await refreshProfile()
      setMessage({ type: 'success', text: 'Profile picture updated successfully.' })
      closeCropModal()
    } catch (error) {
      setMessage({
        type: 'error',
        text: `Upload failed: ${error.message}. Ensure storage bucket "profile-images" exists and is public.`,
      })
    } finally {
      setUploading(false)
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
        <p className="text-gray-500 text-sm mt-1">Review your user profile information, upload a profile picture and reset your password.</p>
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

      {showCropModal && rawImageUrl && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4">
          <div className="w-full max-w-xl bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-lg font-semibold text-gray-900">Adjust Profile Photo</h3>
            <p className="text-sm text-gray-500 mt-1">Drag the image area with sliders to choose what appears in the circle.</p>

            <div className="mt-4 flex justify-center">
              <div className="w-64 h-64 rounded-full overflow-hidden border-2 border-gray-200 bg-gray-100 relative">
                <img
                  src={rawImageUrl}
                  alt="Crop preview"
                  className="absolute top-1/2 left-1/2 max-w-none"
                  style={{
                    transform: `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px)) scale(${zoom})`,
                    transformOrigin: 'center center',
                    width: `${sourceImage ? sourceImage.width * previewBaseScale : CROP_PREVIEW_SIZE}px`,
                    height: `${sourceImage ? sourceImage.height * previewBaseScale : CROP_PREVIEW_SIZE}px`,
                  }}
                />
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500">Zoom</label>
                <input
                  type="range"
                  min={Math.max(1, minCoverZoom).toFixed(2)}
                  max="4"
                  step="0.01"
                  value={zoom}
                  onChange={(e) => {
                    const nextZoom = parseFloat(e.target.value)
                    setZoom(nextZoom)
                    // Re-clamp offsets as zoom changes.
                    const nextMaxX = Math.max(0, ((sourceImage?.width || 0) * previewBaseScale * nextZoom - CROP_PREVIEW_SIZE) / 2)
                    const nextMaxY = Math.max(0, ((sourceImage?.height || 0) * previewBaseScale * nextZoom - CROP_PREVIEW_SIZE) / 2)
                    setOffsetX((prev) => clamp(prev, -nextMaxX, nextMaxX))
                    setOffsetY((prev) => clamp(prev, -nextMaxY, nextMaxY))
                  }}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Move Left / Right</label>
                <input
                  type="range"
                  min={-Math.round(maxOffsetX)}
                  max={Math.round(maxOffsetX)}
                  step="1"
                  value={offsetX}
                  onChange={(e) => setOffsetX(parseInt(e.target.value, 10))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Move Up / Down</label>
                <input
                  type="range"
                  min={-Math.round(maxOffsetY)}
                  max={Math.round(maxOffsetY)}
                  step="1"
                  value={offsetY}
                  onChange={(e) => setOffsetY(parseInt(e.target.value, 10))}
                  className="w-full"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleAutoFit}
                className="px-4 py-2 border border-blue-200 text-blue-700 rounded-lg text-sm hover:bg-blue-50"
                disabled={uploading}
              >
                Auto Fit
              </button>
              <button
                type="button"
                onClick={closeCropModal}
                className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50"
                disabled={uploading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCropAndUpload}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:bg-gray-300"
                disabled={uploading}
              >
                {uploading ? 'Saving...' : 'Save Photo'}
              </button>
            </div>
          </div>
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
