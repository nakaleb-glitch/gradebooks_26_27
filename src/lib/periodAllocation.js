/** @typedef {'bilingual' | 'integrated'} Programme */

/** v1 key kept for reference; v2 uses STORAGE_KEY_V2 */
export const STORAGE_KEY = 'period_allocation_v1'
export const STORAGE_KEY_V2 = 'period_allocation_v2'

/** Supabase singleton row id for `period_allocation_state` */
export const PERIOD_ALLOCATION_STATE_ID = 'default'

export const PRIMARY_MINUTES = 35
export const SECONDARY_MINUTES = 40
export const CONTRACT_HOURS_WEEK = 40

/** Recruitment placeholder subject options (aligned with Users.jsx) */
export const PLACEHOLDER_SUBJECT_OPTIONS = ['ESL/GP', 'Mathematics', 'Science', 'VN ESL']

const ALLOWED_PLACEHOLDER_SUBJECTS = new Set(PLACEHOLDER_SUBJECT_OPTIONS)

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
    placeholderTeachers: [],
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
 * @param {unknown} raw
 * @returns {{ id: string, name: string, level: string, subject: string } | null}
 */
function normalizePlaceholderTeacher(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : ''
  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  if (!id || !name) return null
  const level =
    raw.level === 'secondary'
      ? 'secondary'
      : raw.level === 'primary'
        ? 'primary'
        : ''
  const subject = normalizeUserSubject(raw.subject)
  if (!ALLOWED_PLACEHOLDER_SUBJECTS.has(subject)) return null
  return { id, name, level, subject }
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
  const placeholderTeachers = Array.isArray(data.placeholderTeachers)
    ? data.placeholderTeachers
        .map((p) => normalizePlaceholderTeacher(p))
        .filter(Boolean)
    : []
  return {
    version: 2,
    bilingual: { rows: bilingualRows },
    integrated: { rows: integratedRows },
    placeholderTeachers,
  }
}

/**
 * @param {{ id: string, name: string, level?: string, subject?: string }[]} [list]
 * @returns {Map<string, { id: string, name: string, level: string, subject: string }>}
 */
export function placeholderTeacherMapFromList(list) {
  const m = new Map()
  if (!Array.isArray(list)) return m
  for (const raw of list) {
    const p = normalizePlaceholderTeacher(raw)
    if (p) m.set(p.id, p)
  }
  return m
}

/**
 * @param {string} value
 * @returns {{ kind: 'user', id: string } | { kind: 'name', name: string } | { kind: 'placeholder', id: string } | null}
 */
export function parseAssignment(value) {
  if (!value || typeof value !== 'string') return null
  if (value.startsWith('user:')) {
    const id = value.slice(5).trim()
    return id ? { kind: 'user', id } : null
  }
  if (value.startsWith('ph:')) {
    const id = value.slice(3).trim()
    return id ? { kind: 'placeholder', id } : null
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

export function formatPlaceholderAssignment(id) {
  const t = String(id || '').trim()
  return t ? `ph:${t}` : ''
}

/**
 * Normalize `users.subject` for comparison (aligned with Users.jsx).
 * @param {string | null | undefined} value
 */
export function normalizeUserSubject(value) {
  const v = String(value || '').trim().toLowerCase()
  if (v === 'esl/gp' || v === 'esl / gp') return 'ESL/GP'
  if (v === 'mathematics' || v === 'math') return 'Mathematics'
  if (v === 'science') return 'Science'
  if (v === 'vn esl') return 'VN ESL'
  const t = String(value || '').trim()
  return t ? t : ''
}

/**
 * @param {string | null | undefined} value
 * @returns {'primary' | 'secondary' | ''}
 */
export function normalizeTeacherLevel(value) {
  const v = String(value || '').trim().toLowerCase()
  if (v === 'primary') return 'primary'
  if (v === 'secondary') return 'secondary'
  return ''
}

/**
 * Whether teacher profile subject matches the allocation column (ESL/GP, M/S, VN ESL).
 * @param {string} columnKey — esl | gp | math | science | vnEsl
 */
export function subjectColumnMatchesTeacherSubject(columnKey, userSubjectRaw) {
  const u = normalizeUserSubject(userSubjectRaw)
  switch (columnKey) {
    case 'esl':
    case 'gp':
      return u === 'ESL/GP'
    case 'math':
    case 'science':
      return u === 'Mathematics' || u === 'Science'
    case 'vnEsl':
      return u === 'VN ESL'
    default:
      return false
  }
}

/**
 * @param {{ id: string, name: string, level?: string, subject?: string }[]} placeholders
 * @param {'primary' | 'secondary'} rowDepartment
 * @param {string} columnKey
 */
export function placeholderOptionsForCell(placeholders, rowDepartment, columnKey) {
  const sub = (p) => subjectColumnMatchesTeacherSubject(columnKey, p.subject)
  const lvl = (p) => normalizeTeacherLevel(p.level)
  const match = placeholders.filter((p) => sub(p) && lvl(p) === rowDepartment)
  const unspec = placeholders.filter((p) => sub(p) && !lvl(p))
  return { match, unspec }
}

/**
 * Teacher appears in dropdown for this cell: subject matches, and level matches row or is unspecified.
 * @param {{ level?: string, subject?: string }} teacher
 * @param {'primary' | 'secondary'} rowDepartment
 * @param {string} columnKey
 */
export function teacherAllowedForCell(teacher, rowDepartment, columnKey) {
  if (!subjectColumnMatchesTeacherSubject(columnKey, teacher.subject)) return false
  const tl = normalizeTeacherLevel(teacher.level)
  if (!tl) return true
  return tl === rowDepartment
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
 * @param {{ kind: string, id?: string, name?: string }} parsed
 */
function teacherKeyFromParsed(parsed) {
  if (parsed.kind === 'user') return `user:${parsed.id}`
  if (parsed.kind === 'placeholder') return `ph:${parsed.id}`
  return `name:${parsed.name}`
}

/**
 * @param {{ kind: string, id?: string, name?: string }} parsed
 * @param {Map<string, { full_name?: string }>} teacherNames
 * @param {Map<string, { name?: string }>} [placeholderById]
 */
function displayNameFromParsed(parsed, teacherNames, placeholderById = new Map()) {
  if (parsed.kind === 'user') {
    const n = teacherNames.get(parsed.id)?.full_name
    return (n && String(n).trim()) || parsed.id
  }
  if (parsed.kind === 'placeholder') {
    const n = placeholderById.get(parsed.id)?.name
    return (n && String(n).trim()) || 'Placeholder (removed)'
  }
  return parsed.name
}

/**
 * Segment for prep dedup: same leading grade shares one prep series across homerooms;
 * different grades (e.g. 1B5 vs 5B5) get separate buckets. Unparseable class names use
 * normalized class string; empty uses row id.
 * @param {string | undefined} className
 * @param {string} rowId
 */
export function prepDedupSegment(className, rowId) {
  const s = String(className || '').trim()
  const m = s.match(/^(\d{1,2})(?=\D|$)/)
  if (m) return `g:${m[1]}`
  const lower = s.toLowerCase()
  if (lower) return `c:${lower}`
  return `row:${rowId}`
}

/**
 * @param {object[]} rows
 * @param {Programme} programme
 * @param {Map<string, { full_name?: string }>} [teacherNames]
 * @param {Map<string, { name?: string }>} [placeholderById]
 * @returns {TeacherSummaryRow[]}
 */
export function computeTeacherSummaries(
  rows,
  programme,
  teacherNames = new Map(),
  placeholderById = new Map(),
) {
  const cols = subjectColumns(programme)
  const colPeriods = Object.fromEntries(cols.map((c) => [c.key, c.periodsPerWeek]))
  const colLabel = Object.fromEntries(cols.map((c) => [c.key, c.label]))

  /** @type {Map<string, { primaryUnits: number, secondaryUnits: number, labels: Set<string> }>} */
  const acc = new Map()

  /** @type {Map<string, Set<string>>} teacherKey -> prep bucket keys */
  const prepBuckets = new Map()

  for (const row of rows) {
    const dept = row.department === 'secondary' ? 'secondary' : 'primary'
    for (const c of cols) {
      const raw = row[c.key] ?? ''
      const parsed = parseAssignment(raw)
      if (!parsed) continue
      const tkey = teacherKeyFromParsed(parsed)
      const units = colPeriods[c.key] ?? 0
      if (!acc.has(tkey)) {
        acc.set(tkey, {
          primaryUnits: 0,
          secondaryUnits: 0,
          labels: new Set(),
          displayName: displayNameFromParsed(parsed, teacherNames, placeholderById),
        })
      }
      const entry = acc.get(tkey)
      if (dept === 'primary') entry.primaryUnits += units
      else entry.secondaryUnits += units
      entry.labels.add(colLabel[c.key])

      const segment = prepDedupSegment(row.className, row.id)
      const prepKey = `${programme}|${dept}|${c.key}|${segment}`
      if (!prepBuckets.has(tkey)) prepBuckets.set(tkey, new Set())
      prepBuckets.get(tkey).add(prepKey)
    }
  }

  const out = []
  for (const [tkey, entry] of acc) {
    const periods = entry.primaryUnits + entry.secondaryUnits
    const teachingHours =
      (entry.primaryUnits * PRIMARY_MINUTES) / 60 +
      (entry.secondaryUnits * SECONDARY_MINUTES) / 60

    let lessonPreps = 0
    const buckets = prepBuckets.get(tkey)
    if (buckets) {
      for (const pk of buckets) {
        const parts = pk.split('|')
        const colKey = parts[2]
        const w = colPeriods[colKey] ?? 0
        lessonPreps += w / 2
      }
    }

    const prepTimeHours = lessonPreps * 1.5
    const adminHours = CONTRACT_HOURS_WEEK - teachingHours - prepTimeHours
    const subjectSummary =
      entry.labels.size <= 1
        ? [...entry.labels][0] || '—'
        : 'Multiple'

    out.push({
      teacherKey: tkey,
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

/**
 * Combined summary: merge bilingual + integrated per teacher.
 * @param {{ bilingual: { rows: object[] }, integrated: { rows: object[] }, placeholderTeachers?: object[] }} data
 * @param {Map<string, { full_name?: string }>} [teacherNames]
 * @returns {TeacherSummaryRow[]}
 */
export function computeCombinedTeacherSummaries(data, teacherNames = new Map()) {
  const placeholderById = placeholderTeacherMapFromList(data.placeholderTeachers)
  const b = computeTeacherSummaries(
    data.bilingual.rows,
    'bilingual',
    teacherNames,
    placeholderById,
  )
  const i = computeTeacherSummaries(
    data.integrated.rows,
    'integrated',
    teacherNames,
    placeholderById,
  )
  /** @type {Map<string, { teacherKey: string, displayName: string, periods: number, primaryPeriodUnits: number, secondaryPeriodUnits: number, lessonPreps: number, subjectParts: string[] }>} */
  const merged = new Map()

  function add(s) {
    const cur = merged.get(s.teacherKey)
    if (!cur) {
      merged.set(s.teacherKey, {
        teacherKey: s.teacherKey,
        displayName: s.displayName,
        periods: s.periods,
        primaryPeriodUnits: s.primaryPeriodUnits,
        secondaryPeriodUnits: s.secondaryPeriodUnits,
        lessonPreps: s.lessonPreps,
        subjectParts: [s.subjectSummary],
      })
      return
    }
    cur.periods += s.periods
    cur.primaryPeriodUnits += s.primaryPeriodUnits
    cur.secondaryPeriodUnits += s.secondaryPeriodUnits
    cur.lessonPreps += s.lessonPreps
    cur.subjectParts.push(s.subjectSummary)
  }

  for (const s of b) add(s)
  for (const s of i) add(s)

  const out = []
  for (const cur of merged.values()) {
    const uniq = new Set(cur.subjectParts.filter((x) => x && x !== '—'))
    const subjectSummary =
      uniq.size === 0 ? '—' : uniq.size === 1 ? [...uniq][0] : 'Multiple'
    const teachingHours =
      (cur.primaryPeriodUnits * PRIMARY_MINUTES) / 60 +
      (cur.secondaryPeriodUnits * SECONDARY_MINUTES) / 60
    const prepTimeHours = cur.lessonPreps * 1.5
    const adminHours = CONTRACT_HOURS_WEEK - teachingHours - prepTimeHours
    out.push({
      teacherKey: cur.teacherKey,
      displayName: cur.displayName,
      subjectSummary,
      periods: cur.periods,
      primaryPeriodUnits: cur.primaryPeriodUnits,
      secondaryPeriodUnits: cur.secondaryPeriodUnits,
      teachingHours,
      lessonPreps: cur.lessonPreps,
      prepTimeHours,
      adminHours,
    })
  }

  out.sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }),
  )
  return out
}

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
