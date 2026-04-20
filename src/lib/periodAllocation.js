/** @typedef {'bilingualG1G8' | 'integratedG1G8' | 'bilingualG9G10' | 'integratedG9G11'} Programme */
/** @typedef {'primary' | 'secondary'} TaLevel */
/** @typedef {'bilingual' | 'integrated'} TaProgramme */

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
export const TA_PROGRAMME_OPTIONS = [
  { key: 'bilingual', label: 'Bilingual' },
  { key: 'integrated', label: 'Integrated' },
]

const ALLOWED_PLACEHOLDER_SUBJECTS = new Set(PLACEHOLDER_SUBJECT_OPTIONS)

/** One column per subject; `periodsPerWeek` is the bracket number in headers. */
export const BILINGUAL_G1_G8_SUBJECTS = [
  { key: 'esl', label: 'ESL', periodsPerWeek: 8 },
  { key: 'math', label: 'Mathematics', periodsPerWeek: 5 },
  { key: 'science', label: 'Science', periodsPerWeek: 5 },
  { key: 'gp', label: 'GP', periodsPerWeek: 2 },
]

export const INTEGRATED_G1_G8_SUBJECTS = [
  { key: 'esl', label: 'ESL', periodsPerWeek: 6 },
  { key: 'vnEsl', label: 'VN ESL', periodsPerWeek: 6 },
  { key: 'math', label: 'Mathematics', periodsPerWeek: 4 },
  { key: 'science', label: 'Science', periodsPerWeek: 4 },
]

export const BILINGUAL_G9_G10_SUBJECTS = [
  { key: 'esl', label: 'ESL', periodsPerWeek: 6 },
  { key: 'math', label: 'Math', periodsPerWeek: 4 },
  { key: 'physics', label: 'Physics', periodsPerWeek: 2 },
  { key: 'chemistry', label: 'Chemistry', periodsPerWeek: 2 },
  { key: 'biology', label: 'Biology', periodsPerWeek: 2 },
  { key: 'business', label: 'Business', periodsPerWeek: 4 },
  { key: 'globalPerspectives', label: 'Global Perspectives', periodsPerWeek: 4 },
]

export const INTEGRATED_G9_G11_SUBJECTS = [
  { key: 'ieltsReading', label: 'IELTS Reading', periodsPerWeek: 5 },
  { key: 'ieltsWriting', label: 'IELTS Writing', periodsPerWeek: 5 },
  { key: 'ieltsListening', label: 'IELTS Listening', periodsPerWeek: 5 },
  { key: 'ieltsSpeaking', label: 'IELTS Speaking', periodsPerWeek: 5 },
]

/**
 * @param {Programme} programme
 */
export function subjectColumns(programme) {
  switch (programme) {
    case 'bilingualG1G8':
      return BILINGUAL_G1_G8_SUBJECTS
    case 'integratedG1G8':
      return INTEGRATED_G1_G8_SUBJECTS
    case 'bilingualG9G10':
      return BILINGUAL_G9_G10_SUBJECTS
    case 'integratedG9G11':
      return INTEGRATED_G9_G11_SUBJECTS
    default:
      return BILINGUAL_G1_G8_SUBJECTS
  }
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
    bilingualG1G8: { rows: [] },
    integratedG1G8: { rows: [] },
    bilingualG9G10: { rows: [] },
    integratedG9G11: { rows: [] },
    placeholderTeachers: [],
    taStaff: [],
    taCounselorAllocation: { rows: [] },
  }
}

export function createEmptyTaAllocationRow() {
  return {
    id: newRowId(),
    level: /** @type {TaLevel} */ ('primary'),
    className: '',
    programme: /** @type {TaProgramme} */ ('bilingual'),
    assignment: '',
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
 * @param {unknown} raw
 * @returns {{ id: string, name: string } | null}
 */
function normalizeTaStaff(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : ''
  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  if (!id || !name) return null
  return { id, name }
}

/**
 * @param {unknown} raw
 */
function normalizeTaAllocationRow(raw) {
  const id =
    raw && typeof raw === 'object' && typeof raw.id === 'string' && raw.id.trim()
      ? raw.id.trim()
      : newRowId()
  const level = raw && raw.level === 'secondary' ? 'secondary' : 'primary'
  const className = raw && typeof raw.className === 'string' ? raw.className : ''
  const programme = raw && raw.programme === 'integrated' ? 'integrated' : 'bilingual'
  const assignment = raw && typeof raw.assignment === 'string' ? raw.assignment : ''
  return { id, level, className, programme, assignment }
}

/**
 * @param {unknown} data
 */
export function normalizePersistedStateV2(data) {
  if (!data || typeof data !== 'object') return null
  if (data.version !== 2) return null
  const legacyBilingualRows = Array.isArray(data.bilingual?.rows) ? data.bilingual.rows : []
  const legacyIntegratedRows = Array.isArray(data.integrated?.rows) ? data.integrated.rows : []
  const bilingualG1G8Rows = Array.isArray(data.bilingualG1G8?.rows)
    ? data.bilingualG1G8.rows.map((r) => normalizeRow(r, 'bilingualG1G8'))
    : legacyBilingualRows.map((r) => normalizeRow(r, 'bilingualG1G8'))
  const integratedG1G8Rows = Array.isArray(data.integratedG1G8?.rows)
    ? data.integratedG1G8.rows.map((r) => normalizeRow(r, 'integratedG1G8'))
    : legacyIntegratedRows.map((r) => normalizeRow(r, 'integratedG1G8'))
  const bilingualG9G10Rows = Array.isArray(data.bilingualG9G10?.rows)
    ? data.bilingualG9G10.rows.map((r) => normalizeRow(r, 'bilingualG9G10'))
    : []
  const integratedG9G11Rows = Array.isArray(data.integratedG9G11?.rows)
    ? data.integratedG9G11.rows.map((r) => normalizeRow(r, 'integratedG9G11'))
    : []
  const placeholderTeachers = Array.isArray(data.placeholderTeachers)
    ? data.placeholderTeachers
        .map((p) => normalizePlaceholderTeacher(p))
        .filter(Boolean)
    : []
  const taStaff = Array.isArray(data.taStaff)
    ? data.taStaff.map((s) => normalizeTaStaff(s)).filter(Boolean)
    : []
  const taRows = Array.isArray(data.taCounselorAllocation?.rows)
    ? data.taCounselorAllocation.rows.map((r) => normalizeTaAllocationRow(r))
    : []
  return {
    version: 2,
    bilingualG1G8: { rows: bilingualG1G8Rows },
    integratedG1G8: { rows: integratedG1G8Rows },
    bilingualG9G10: { rows: bilingualG9G10Rows },
    integratedG9G11: { rows: integratedG9G11Rows },
    placeholderTeachers,
    taStaff,
    taCounselorAllocation: { rows: taRows },
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

export function formatTaAssignment(staffId) {
  const t = String(staffId || '').trim()
  return t ? `ta:${t}` : ''
}

/**
 * @param {string | null | undefined} value
 * @returns {{ id: string } | null}
 */
export function parseTaAssignment(value) {
  if (!value || typeof value !== 'string') return null
  if (!value.startsWith('ta:')) return null
  const id = value.slice(3).trim()
  return id ? { id } : null
}

/**
 * @param {TaLevel} level
 * @param {TaProgramme} programme
 */
export function taSupportPeriods(level, programme) {
  if (level === 'primary' && programme === 'bilingual') return 20
  if (level === 'primary' && programme === 'integrated') return 14
  return 12
}

/**
 * @param {{ rows?: Array<{ id?: string, level?: TaLevel, className?: string, programme?: TaProgramme, assignment?: string }> }} taAllocation
 * @param {Array<{ id: string, name: string }>} taStaff
 */
export function computeTaCounselorSummaries(taAllocation, taStaff = []) {
  const rows = Array.isArray(taAllocation?.rows) ? taAllocation.rows : []
  const staffById = new Map(taStaff.map((s) => [s.id, s]))
  /** @type {Map<string, { displayName: string, periods: number, primaryUnits: number, secondaryUnits: number }>} */
  const acc = new Map()

  for (const row of rows) {
    const parsed = parseTaAssignment(row.assignment)
    if (!parsed) continue
    const periods = taSupportPeriods(row.level === 'secondary' ? 'secondary' : 'primary', row.programme === 'integrated' ? 'integrated' : 'bilingual')
    const level = row.level === 'secondary' ? 'secondary' : 'primary'
    const key = parsed.id
    const displayName = staffById.get(parsed.id)?.name || 'TA/Counselor (removed)'
    if (!acc.has(key)) {
      acc.set(key, { displayName, periods: 0, primaryUnits: 0, secondaryUnits: 0 })
    }
    const entry = acc.get(key)
    entry.periods += periods
    if (level === 'primary') entry.primaryUnits += periods
    else entry.secondaryUnits += periods
  }

  const out = []
  for (const [staffId, s] of acc.entries()) {
    const hours = (s.primaryUnits * PRIMARY_MINUTES + s.secondaryUnits * SECONDARY_MINUTES) / 60
    out.push({
      staffId,
      displayName: s.displayName,
      totalPeriods: s.periods,
      totalHours: hours,
    })
  }
  out.sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }))
  return out
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
 * Whether teacher profile subject matches the allocation column.
 * @param {string} columnKey
 */
export function subjectColumnMatchesTeacherSubject(columnKey, userSubjectRaw) {
  const u = normalizeUserSubject(userSubjectRaw)
  switch (columnKey) {
    case 'esl':
    case 'gp':
    case 'business':
    case 'globalPerspectives':
      return u === 'ESL/GP'
    case 'math':
    case 'physics':
    case 'chemistry':
    case 'biology':
    case 'science':
      return u === 'Mathematics' || u === 'Science'
    case 'ieltsReading':
    case 'ieltsWriting':
    case 'ieltsListening':
    case 'ieltsSpeaking':
      return u === 'ESL/GP' || u === 'VN ESL'
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
 * @property {string[]} subjectLabels — column labels (ESL, GP, Mathematics, …) for this row
 * @property {number} periods
 * @property {number} primaryPeriodUnits
 * @property {number} secondaryPeriodUnits
 * @property {'primary' | 'secondary' | 'mixed' | ''} levelKey
 * @property {string} levelLabel
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
 * Human-readable grade hint from class code (leading 1–2 digits), else class text or em dash.
 * @param {string | undefined} className
 * @param {string} [rowId]
 */
export function gradeLabelFromClassName(className) {
  const s = String(className || '').trim()
  const m = s.match(/^(\d{1,2})(?=\D|$)/)
  if (m) return `G${m[1]}`
  if (s) return `class: ${s}`
  return '—'
}

/**
 * Summary tab sort: ESL/GP first, then Mathematics, then Science, then other (e.g. VN ESL).
 * @param {string[]} labels
 */
export function combinedSummarySortRank(labels) {
  const set = new Set(labels)
  if (set.has('ESL') || set.has('GP')) return 0
  if (set.has('Mathematics') || set.has('Math')) return 1
  if (set.has('Science') || set.has('Physics') || set.has('Chemistry') || set.has('Biology'))
    return 2
  return 3
}

/**
 * @param {'primary' | 'secondary' | 'mixed' | ''} levelKey
 */
function summaryLevelSortRank(levelKey) {
  if (levelKey === 'primary') return 0
  if (levelKey === 'secondary') return 1
  if (levelKey === 'mixed') return 2
  return 3
}

/**
 * @param {number} primaryPeriodUnits
 * @param {number} secondaryPeriodUnits
 * @returns {'primary' | 'secondary' | 'mixed' | ''}
 */
function levelKeyFromPeriodUnits(primaryPeriodUnits, secondaryPeriodUnits) {
  const hasPrimary = primaryPeriodUnits > 0
  const hasSecondary = secondaryPeriodUnits > 0
  if (hasPrimary && hasSecondary) return 'mixed'
  if (hasPrimary) return 'primary'
  if (hasSecondary) return 'secondary'
  return ''
}

/**
 * @param {'primary' | 'secondary' | 'mixed' | ''} levelKey
 */
function levelLabelFromLevelKey(levelKey) {
  if (levelKey === 'primary') return 'Primary'
  if (levelKey === 'secondary') return 'Secondary'
  if (levelKey === 'mixed') return 'Primary + Secondary'
  return '—'
}

/**
 * Where each placeholder id appears in all programme grids (deduped lines).
 * @param {{ bilingualG1G8: { rows: object[] }, integratedG1G8: { rows: object[] }, bilingualG9G10: { rows: object[] }, integratedG9G11: { rows: object[] } }} data
 * @returns {Map<string, string[]>}
 */
export function summarizePlaceholderAssignments(data) {
  /** @type {Map<string, Set<string>>} */
  const acc = new Map()
  const programmes = /** @type {const} */ ([
    'bilingualG1G8',
    'integratedG1G8',
    'bilingualG9G10',
    'integratedG9G11',
  ])

  function addLine(id, line) {
    if (!acc.has(id)) acc.set(id, new Set())
    acc.get(id).add(line)
  }

  for (const prog of programmes) {
    const rows = data[prog]?.rows
    if (!Array.isArray(rows)) continue
    const cols = subjectColumns(prog)
    const progLabelByKey = {
      bilingualG1G8: 'Bilingual (G1-G8)',
      integratedG1G8: 'Integrated (G1-G8)',
      bilingualG9G10: 'Bilingual (G9-G10)',
      integratedG9G11: 'Integrated (G9-G11)',
    }
    const progLabel = progLabelByKey[prog] || prog
    for (const row of rows) {
      const grade = gradeLabelFromClassName(row.className)
      for (const c of cols) {
        const raw = row[c.key] ?? ''
        const parsed = parseAssignment(raw)
        if (parsed?.kind !== 'placeholder') continue
        const id = parsed.id
        addLine(id, `${progLabel} · ${c.label} · ${grade}`)
      }
    }
  }

  /** @type {Map<string, string[]>} */
  const out = new Map()
  for (const [id, set] of acc) {
    out.set(
      id,
      [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
    )
  }
  return out
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
    const subjectLabels = [...entry.labels].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    )
    const subjectSummary = subjectLabels.length > 0 ? subjectLabels.join(', ') : '—'
    const levelKey = levelKeyFromPeriodUnits(entry.primaryUnits, entry.secondaryUnits)
    const levelLabel = levelLabelFromLevelKey(levelKey)

    out.push({
      teacherKey: tkey,
      displayName: entry.displayName,
      subjectSummary,
      subjectLabels,
      periods,
      primaryPeriodUnits: entry.primaryUnits,
      secondaryPeriodUnits: entry.secondaryUnits,
      levelKey,
      levelLabel,
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
 * Combined summary: merge all programme grids per teacher.
 * @param {{ bilingualG1G8: { rows: object[] }, integratedG1G8: { rows: object[] }, bilingualG9G10: { rows: object[] }, integratedG9G11: { rows: object[] }, placeholderTeachers?: object[] }} data
 * @param {Map<string, { full_name?: string }>} [teacherNames]
 * @returns {TeacherSummaryRow[]}
 */
export function computeCombinedTeacherSummaries(data, teacherNames = new Map()) {
  const placeholderById = placeholderTeacherMapFromList(data.placeholderTeachers)
  const b1 = computeTeacherSummaries(
    data.bilingualG1G8.rows,
    'bilingualG1G8',
    teacherNames,
    placeholderById,
  )
  const i1 = computeTeacherSummaries(
    data.integratedG1G8.rows,
    'integratedG1G8',
    teacherNames,
    placeholderById,
  )
  const b2 = computeTeacherSummaries(
    data.bilingualG9G10.rows,
    'bilingualG9G10',
    teacherNames,
    placeholderById,
  )
  const i2 = computeTeacherSummaries(
    data.integratedG9G11.rows,
    'integratedG9G11',
    teacherNames,
    placeholderById,
  )
  /** @type {Map<string, { teacherKey: string, displayName: string, periods: number, primaryPeriodUnits: number, secondaryPeriodUnits: number, lessonPreps: number, subjectLabels: string[] }>} */
  const merged = new Map()

  function add(s) {
    const cur = merged.get(s.teacherKey)
    const labels = s.subjectLabels ?? []
    if (!cur) {
      merged.set(s.teacherKey, {
        teacherKey: s.teacherKey,
        displayName: s.displayName,
        periods: s.periods,
        primaryPeriodUnits: s.primaryPeriodUnits,
        secondaryPeriodUnits: s.secondaryPeriodUnits,
        lessonPreps: s.lessonPreps,
        subjectLabels: [...labels],
      })
      return
    }
    cur.periods += s.periods
    cur.primaryPeriodUnits += s.primaryPeriodUnits
    cur.secondaryPeriodUnits += s.secondaryPeriodUnits
    cur.lessonPreps += s.lessonPreps
    cur.subjectLabels = [...new Set([...cur.subjectLabels, ...labels])].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    )
  }

  for (const s of b1) add(s)
  for (const s of i1) add(s)
  for (const s of b2) add(s)
  for (const s of i2) add(s)

  const out = []
  for (const cur of merged.values()) {
    const subjectSummary =
      cur.subjectLabels.length > 0 ? cur.subjectLabels.join(', ') : '—'
    const levelKey = levelKeyFromPeriodUnits(cur.primaryPeriodUnits, cur.secondaryPeriodUnits)
    const levelLabel = levelLabelFromLevelKey(levelKey)
    const teachingHours =
      (cur.primaryPeriodUnits * PRIMARY_MINUTES) / 60 +
      (cur.secondaryPeriodUnits * SECONDARY_MINUTES) / 60
    const prepTimeHours = cur.lessonPreps * 1.5
    const adminHours = CONTRACT_HOURS_WEEK - teachingHours - prepTimeHours
    out.push({
      teacherKey: cur.teacherKey,
      displayName: cur.displayName,
      subjectSummary,
      subjectLabels: cur.subjectLabels,
      periods: cur.periods,
      primaryPeriodUnits: cur.primaryPeriodUnits,
      secondaryPeriodUnits: cur.secondaryPeriodUnits,
      levelKey,
      levelLabel,
      teachingHours,
      lessonPreps: cur.lessonPreps,
      prepTimeHours,
      adminHours,
    })
  }

  out.sort((a, b) => {
    const ra = combinedSummarySortRank(a.subjectLabels)
    const rb = combinedSummarySortRank(b.subjectLabels)
    if (ra !== rb) return ra - rb
    const la = summaryLevelSortRank(a.levelKey)
    const lb = summaryLevelSortRank(b.levelKey)
    if (la !== lb) return la - lb
    return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' })
  })
  return out
}

/**
 * Build teacher -> assignment lines for summary hover popups.
 * @param {{ bilingualG1G8: { rows: object[] }, integratedG1G8: { rows: object[] }, bilingualG9G10: { rows: object[] }, integratedG9G11: { rows: object[] } }} data
 * @returns {Map<string, string[]>}
 */
export function buildCombinedTeacherAssignmentLines(data) {
  /** @type {Map<string, Set<string>>} */
  const acc = new Map()
  const programmes = /** @type {const} */ ([
    'bilingualG1G8',
    'integratedG1G8',
    'bilingualG9G10',
    'integratedG9G11',
  ])

  function addLine(teacherKey, line) {
    if (!acc.has(teacherKey)) acc.set(teacherKey, new Set())
    acc.get(teacherKey).add(line)
  }

  for (const prog of programmes) {
    const rows = data[prog]?.rows
    if (!Array.isArray(rows)) continue
    const cols = subjectColumns(prog)
    for (const row of rows) {
      const className = String(row.className || '').trim() || '(No class)'
      for (const c of cols) {
        const raw = row[c.key] ?? ''
        const parsed = parseAssignment(raw)
        if (!parsed) continue
        const tkey = teacherKeyFromParsed(parsed)
        addLine(tkey, `${className} ${c.label}`)
      }
    }
  }

  /** @type {Map<string, string[]>} */
  const out = new Map()
  for (const [teacherKey, set] of acc) {
    out.set(
      teacherKey,
      [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
    )
  }
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
