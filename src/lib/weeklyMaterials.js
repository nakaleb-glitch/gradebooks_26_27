import { supabase } from './supabase'

export const WEEKLY_MATERIALS_BUCKET = 'weekly-material-files'
const MAX_FILE_BYTES = 25 * 1024 * 1024

const ALLOWED_EXTENSIONS = new Set(['pdf', 'ppt', 'pptx', 'doc', 'docx'])

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

export function isUuid(value) {
  const text = String(value || '').trim()
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
}

export function isWeeklyMaterialFileAllowed(file) {
  if (!file) return false
  const name = String(file.name || '')
  const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : ''
  const mimeType = String(file.type || '').toLowerCase()
  return ALLOWED_EXTENSIONS.has(ext) || ALLOWED_MIME_TYPES.has(mimeType)
}

export function validateWeeklyMaterialFile(file) {
  if (!file) return new Error('Please choose a file to upload.')
  if (!isWeeklyMaterialFileAllowed(file)) {
    return new Error('Only PDF, PPT/PPTX, and DOC/DOCX files are allowed.')
  }
  if (file.size > MAX_FILE_BYTES) {
    return new Error('File must be 25 MB or smaller.')
  }
  return null
}

export async function uploadWeeklyMaterialFile({ classId, week, lessonNumber, file }) {
  if (!isUuid(classId)) {
    return { path: null, displayName: null, error: new Error('Invalid class ID for upload path.') }
  }
  const validationError = validateWeeklyMaterialFile(file)
  if (validationError) return { path: null, displayName: null, error: validationError }

  const safeName = (file.name || 'material').replace(/[^a-zA-Z0-9._-]/g, '_')
  const lessonSegment = Number.isInteger(lessonNumber) ? `lesson-${lessonNumber}` : 'week'
  const path = `${classId}/${week}/${lessonSegment}/${Date.now()}-${safeName}`

  const { error } = await supabase.storage
    .from(WEEKLY_MATERIALS_BUCKET)
    .upload(path, file, {
      upsert: false,
      contentType: file.type || undefined,
    })

  if (error) return { path: null, displayName: null, error }
  return { path, displayName: file.name || 'material', error: null }
}

export async function getWeeklyMaterialSignedUrl(storagePath, expiresInSec = 3600) {
  if (!storagePath) return { url: null, error: null }
  const { data, error } = await supabase.storage
    .from(WEEKLY_MATERIALS_BUCKET)
    .createSignedUrl(storagePath, expiresInSec)
  if (error) return { url: null, error }
  return { url: data?.signedUrl || null, error: null }
}
