import { useState } from 'react'
import { getWeeklyMaterialSignedUrl } from '../lib/weeklyMaterials'

export default function WeeklyMaterialFileButton({ storagePath, fileName, className = '' }) {
  const [busy, setBusy] = useState(false)
  if (!storagePath) return null

  const handleClick = async () => {
    setBusy(true)
    const { url, error } = await getWeeklyMaterialSignedUrl(storagePath)
    setBusy(false)
    if (error || !url) {
      window.alert(error?.message || 'Could not open the file.')
      return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className={
        className ||
        'text-sm text-blue-600 hover:underline disabled:opacity-60'
      }
    >
      {busy ? 'Opening...' : (fileName?.trim() || 'Open file')}
    </button>
  )
}
