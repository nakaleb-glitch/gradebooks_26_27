import { useState } from 'react'
import { getAnnouncementPdfSignedUrl } from '../lib/announcementAttachments'

export default function AnnouncementPdfButton({ storagePath, fileName, className = '' }) {
  const [busy, setBusy] = useState(false)
  if (!storagePath) return null

  const handleClick = async () => {
    setBusy(true)
    const { url, error } = await getAnnouncementPdfSignedUrl(storagePath)
    setBusy(false)
    if (error || !url) {
      window.alert(error?.message || 'Could not open the PDF.')
      return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const label = fileName?.trim() || 'Open PDF'

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
      {busy ? 'Opening…' : label}
    </button>
  )
}
