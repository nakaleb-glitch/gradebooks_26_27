import { supabase } from './supabase'

export const ANNOUNCEMENT_FILES_BUCKET = 'announcement-files'
const MAX_PDF_BYTES = 10 * 1024 * 1024

export function normalizeLinkUrl(raw) {
  const t = String(raw || '').trim()
  if (!t) return null
  if (/^https?:\/\//i.test(t)) return t
  return `https://${t}`
}

export async function uploadTeacherAnnouncementPdf(announcementId, file) {
  if (!file) return { path: null, displayName: null, error: null }
  if (file.type !== 'application/pdf') {
    return { path: null, displayName: null, error: new Error('Please attach a PDF file only.') }
  }
  if (file.size > MAX_PDF_BYTES) {
    return { path: null, displayName: null, error: new Error('PDF must be 10 MB or smaller.') }
  }
  const safeName = (file.name || 'document.pdf').replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${announcementId}/${Date.now()}-${safeName}`
  const { error } = await supabase.storage
    .from(ANNOUNCEMENT_FILES_BUCKET)
    .upload(path, file, { upsert: false, contentType: 'application/pdf' })
  if (error) return { path: null, displayName: null, error }
  return { path, displayName: file.name || 'document.pdf', error: null }
}

export async function getAnnouncementPdfSignedUrl(storagePath, expiresInSec = 3600) {
  if (!storagePath) return { url: null, error: null }
  const { data, error } = await supabase.storage
    .from(ANNOUNCEMENT_FILES_BUCKET)
    .createSignedUrl(storagePath, expiresInSec)
  if (error) return { url: null, error }
  return { url: data?.signedUrl || null, error: null }
}
