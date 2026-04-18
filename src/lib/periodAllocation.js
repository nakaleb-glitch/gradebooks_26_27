/** @typedef {'bilingual' | 'integrated'} Programme */

/** v1 key kept for reference; v2 uses STORAGE_KEY_V2 */
export const STORAGE_KEY = 'period_allocation_v1'
export const STORAGE_KEY_V2 = 'period_allocation_v2'

export const PRIMARY_MINUTES = 35
export const SECONDARY_MINUTES = 40
export const CONTRACT_HOURS_WEEK = 40

/** One column per subject; `periodsPerWeek` is the bracket number in headers. */
export const BILINGUAL_SUBJECTS = [
  { key: 'esl', label: 'ESL', periodsPerWeek: 8 },
  { key: 'math', label: 'Mathematics', periodsPerWeek: 5 },
  { key: 'science', label: 'Science', periodsPerWeek: 5 },
  { key: 'gp', label: 'GP', periodsPerWeek: 2 },
]

export const INTEGRATED_SUBJECTS = [
  { key: 'esl', label: 'ESL', periodsPerWeek: 6 },
  { key: 'vnEsl', label: 'VN ESL', periodsPerWeek: 6 },
  { key: 'math', label: 'Mathematics', periodsPerWeek: 4 },
  { key: 'science', label: 'Science', periodsPerWeek: 4 },
]

/**
 * @param {Programme} programme
 */
export function subjectColumns(programme) {
  return programme === 'bilingual' ? BILINGUAL_SUBJECTS : INTEGRATED_SUBJECTS
}

function newRowId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * @param {Programme} programme
 */
export function createEmptyRow(programme) {
  const row = {
    id: newRowId(),
    department: /** @type {'primary' | 'secondary'} */ ('primary'),
    className: '',
  }
  for (const c of subjectColumns(programme)) {
    row[c.key] = ''
  }
  return row
}

export function createInitialStateV2() {
  return {
    version: 2,
    bilingual: { rows: [] },
    integrated: { rows: [] },
  }
}

/**
 * @param {unknown} row
 * @param {Programme} programme
 */
function normalizeRow(row, programme) {
  const cols = subjectColumns(programme)
  const id =
    row && typeof row === 'object' && typeof row.id === 'string' && row.id.trim()
      ? row.id.trim()
      : newRowId()
  const department =
    row && row.department === 'secondary' ? 'secondary' : 'primary'
  const className =
    row && typeof row.className === 'string' ? row.className : ''
  const out = { id, department, className }
  for (const c of cols) {
    const v = row && typeof row[c.key] === 'string' ? row[c.key] : ''
    out[c.key] = v
  }
  return out
}

/**
 * @param {unknown} data
 */
export function normalizePersistedStateV2(data) {
  if (!data || typeof data !== 'object') return null
  if (data.version !== 2) return null
  const bilingualRows = Array.isArray(data.bilingual?.rows)
    ? data.bilingual.rows.map((r) => normalizeRow(r, 'bilingual'))
    : []
  const integratedRows = Array.isArray(data.integrated?.rows)
    ? data.integrated.rows.map((r) => normalizeRow(r, 'integrated'))
    : []
  return {
    version: 2,
    bilingual: { rows: bilingualRows },
    integrated: { rows: integratedRows },
  }
}

/**
 * @param {string} value
 * @returns {{ kind: 'user', id: string } | { kind: 'name', name: string } | null}
 */
export function parseAssignment(value) {
  if (!value || typeof value !== 'string') return null
  if (value.startsWith('user:')) {
    const id = value.slice(5).trim()
    return id ? { kind: 'user', id } : null
  }
  if (value.startsWith('name:')) {
    const rest = value.slice(5)
    try {
      const name = decodeURIComponent(rest).trim()
      return name ? { kind: 'name', name } : null
    } catch {
      const name = rest.trim()
      return name ? { kind: 'name', name } : null
    }
  }
  return null
}

export function formatUserAssignment(userId) {
  return `user:${userId}`
}

export function formatNameAssignment(name) {
  const t = String(name || '').trim()
  return t ? `name:${encodeURIComponent(t)}` : ''
}

/**
 * @typedef {object} TeacherSummaryRow
 * @property {string} teacherKey
 * @property {string} displayName
 * @property {string} subjectSummary
 * @property {number} periods
 * @property {number} primaryPeriodUnits
 * @property {number} secondaryPeriodUnits
 * @property {number} teachingHours
 * @property {number} lessonPreps
 * @property {number} prepTimeHours
 * @property {number} adminHours
 */

/**
 * @param {object[]} rows
 * @param {Programme} programme
 * @param {Map<string, { full_name?: string }>} [teacherNames] user id -> profile
 * @returns {TeacherSummaryRow[]}
 */
export function computeTeacherSummaries(rows, programme, teacherNames = new Map()) {
  const cols = subjectColumns(programme)
  const colPeriods = Object.fromEntries(cols.map((c) => [c.key, c.periodsPerWeek]))
  const colLabel = Object.fromEntries(cols.map((c) => [c.key, c.label]))

  /** @type {Map<string, { primaryUnits: number, secondaryUnits: number, labels: Set<string> }>} */
  const acc = new Map()

  function teacherKey(parsed) {
    return parsed.kind === 'user' ? `user:${parsed.id}` : `name:${parsed.name}`
  }

  function displayName(parsed) {
    if (parsed.kind === 'user') {
      const n = teacherNames.get(parsed.id)?.full_name
      return (n && String(n).trim()) || parsed.id
    }
    return parsed.name
  }

  for (const row of rows) {
    const dept = row.department === 'secondary' ? 'secondary' : 'primary'
    for (const c of cols) {
      const raw = row[c.key] ?? ''
      const parsed = parseAssignment(raw)
      if (!parsed) continue
      const key = teacherKey(parsed)
      const units = colPeriods[c.key] ?? 0
      if (!acc.has(key)) {
        acc.set(key, {
          primaryUnits: 0,
          secondaryUnits: 0,
          labels: new Set(),
          displayName: displayName(parsed),
        })
      }
      const entry = acc.get(key)
      if (dept === 'primary') entry.primaryUnits += units
      else entry.secondaryUnits += units
      entry.labels.add(colLabel[c.key])
    }
  }

  const out = []
  for (const [teacherKey, entry] of acc) {
    const periods = entry.primaryUnits + entry.secondaryUnits
    const teachingHours =
      (entry.primaryUnits * PRIMARY_MINUTES) / 60 +
      (entry.secondaryUnits * SECONDARY_MINUTES) / 60
    const lessonPreps = periods / 2
    const prepTimeHours = lessonPreps * 1.5
    const adminHours = CONTRACT_HOURS_WEEK - teachingHours - prepTimeHours
    const subjectSummary =
      entry.labels.size <= 1
        ? [...entry.labels][0] || '—'
        : 'Multiple'

    out.push({
      teacherKey,
      displayName: entry.displayName,
      subjectSummary,
      periods,
      primaryPeriodUnits: entry.primaryUnits,
      secondaryPeriodUnits: entry.secondaryUnits,
      teachingHours,
      lessonPreps,
      prepTimeHours,
      adminHours,
    })
  }

  out.sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }),
  )
  return out
}

/** Preset placeholder labels for quick assignment (stored as name:…) */
export const PLACEHOLDER_PRESETS = [
  'NEW ESL Teacher #1',
  'NEW ESL Teacher #2',
  'NEW ESL Teacher #3',
  'NEW ESL Teacher #4',
  'New Mathematics Teacher #1',
  'NEW ESL Subject Head',
]

/**
 * Map CSV rows (objects) to { className, department } for building allocation rows.
 * @param {Record<string, string>[]} records from PapaParse data
 */
export function rowsFromCsvRecords(records) {
  const out = []
  if (!Array.isArray(records)) return out
  for (const row of records) {
    if (!row || typeof row !== 'object') continue
    const className = pickCsvField(row, [
      'Class',
      'class',
      'CLASS',
      'Class Name',
      'class_name',
      'Homeroom',
    ])
    if (!className) continue
    const deptRaw = pickCsvField(row, ['Department', 'department', 'DEPT', 'Level'])
    const department = parseDepartment(deptRaw)
    out.push({ className: className.trim(), department })
  }
  return out
}

function pickCsvField(row, keys) {
  for (const k of keys) {
    if (row[k] != null && String(row[k]).trim()) return String(row[k]).trim()
  }
  return ''
}

function parseDepartment(raw) {
  const v = String(raw || '')
    .trim()
    .toLowerCase()
  if (v.startsWith('sec')) return 'secondary'
  if (v === 's' || v === 'sec' || v === 'secondary') return 'secondary'
  return 'primary'
}
