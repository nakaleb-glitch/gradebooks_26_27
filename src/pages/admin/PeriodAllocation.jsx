import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import Papa from 'papaparse'
import Layout from '../../components/Layout'
import { supabase } from '../../lib/supabase'
import {
  buildCombinedTeacherAssignmentLines,
  computeTaCounselorSummaries,
  CONTRACT_HOURS_WEEK,
  PERIOD_ALLOCATION_STATE_ID,
  PLACEHOLDER_SUBJECT_OPTIONS,
  PRIMARY_MINUTES,
  SECONDARY_MINUTES,
  STORAGE_KEY_V2,
  TA_PROGRAMME_OPTIONS,
  computeCombinedTeacherSummaries,
  createEmptyTaAllocationRow,
  createEmptyRow,
  createInitialStateV2,
  formatTaAssignment,
  formatPlaceholderAssignment,
  formatUserAssignment,
  normalizePersistedStateV2,
  normalizeTeacherLevel,
  parseTaAssignment,
  parseAssignment,
  placeholderOptionsForCell,
  rowsFromCsvRecords,
  subjectColumnMatchesTeacherSubject,
  subjectColumns,
  summarizePlaceholderAssignments,
  taSupportPeriods,
} from '../../lib/periodAllocation'

const SAVE_DEBOUNCE_MS = 400

function AssignmentHoverCard({ anchorRect, lines, visible }) {
  if (!visible || !anchorRect || typeof document === 'undefined') return null
  const top = Math.min(anchorRect.bottom + 8, window.innerHeight - 16)
  const left = Math.min(anchorRect.left, window.innerWidth - 360)
  return createPortal(
    <div
      className="pointer-events-none fixed z-[80] min-w-[15rem] max-w-[22rem] rounded-lg border border-gray-200 bg-white p-2 text-xs text-gray-700 shadow-xl dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
      style={{ top, left }}
      role="tooltip"
    >
      {lines.length === 0 ? (
        <p>No class assignments found.</p>
      ) : (
        <ul className="space-y-1">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
    </div>,
    document.body,
  )
}

/** @typedef {'summary' | 'bilingualG1G8' | 'integratedG1G8' | 'bilingualG9G10' | 'integratedG9G11' | 'taCounselor'} MainTab */

function staffOptionsForCell(teachers, rowDepartment, columnKey) {
  const sub = (t) => subjectColumnMatchesTeacherSubject(columnKey, t.subject)
  const lvl = (t) => normalizeTeacherLevel(t.level)
  const match = teachers.filter((t) => sub(t) && lvl(t) === rowDepartment)
  const unspec = teachers.filter((t) => sub(t) && !lvl(t))
  return { match, unspec }
}

export default function PeriodAllocation() {
  const navigate = useNavigate()
  const saveTimerRef = useRef(null)
  const actionsMenuRef = useRef(null)
  const jsonImportRef = useRef(null)
  const csvImportRef = useRef(null)

  const [activeTab, setActiveTab] = useState(
    /** @type {MainTab} */ ('summary'),
  )
  const [data, setData] = useState(() => createInitialStateV2())
  const [placeholderModalOpen, setPlaceholderModalOpen] = useState(false)
  const [editingPlaceholderId, setEditingPlaceholderId] = useState(null)
  const [taStaffModalOpen, setTaStaffModalOpen] = useState(false)
  const [editingTaStaffId, setEditingTaStaffId] = useState(null)
  const [recruitmentExpanded, setRecruitmentExpanded] = useState(false)
  const [teacherSummaryExpanded, setTeacherSummaryExpanded] = useState(false)
  const [taSummaryExpanded, setTaSummaryExpanded] = useState(false)
  const [taStaffExpanded, setTaStaffExpanded] = useState(false)
  const [phFormName, setPhFormName] = useState('')
  const [taStaffFormName, setTaStaffFormName] = useState('')
  const [phFormLevel, setPhFormLevel] = useState('')
  const [phFormSubject, setPhFormSubject] = useState(PLACEHOLDER_SUBJECT_OPTIONS[0])
  const [hydrated, setHydrated] = useState(false)
  const [teachers, setTeachers] = useState([])
  const [actionsOpen, setActionsOpen] = useState(false)
  const [saveStatus, setSaveStatus] = useState(
    /** @type {'idle' | 'saving' | 'saved' | 'error'} */ ('idle'),
  )
  const [saveError, setSaveError] = useState(null)
  const [denseMode, setDenseMode] = useState(true)
  const [hoverCard, setHoverCard] = useState({
    visible: false,
    anchorRect: null,
    lines: [],
  })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: rows } = await supabase
        .from('users')
        .select('id, full_name, level, subject')
        .in('role', ['teacher', 'admin_teacher'])
        .order('full_name')
      if (!cancelled && rows) setTeachers(rows)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: row, error: fetchError } = await supabase
        .from('period_allocation_state')
        .select('payload')
        .eq('id', PERIOD_ALLOCATION_STATE_ID)
        .maybeSingle()

      if (cancelled) return

      if (!fetchError && row?.payload) {
        const normalized = normalizePersistedStateV2(row.payload)
        if (normalized) {
          setData(normalized)
          try {
            localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(normalized))
          } catch (e) {
            console.warn('localStorage mirror failed', e)
          }
          setHydrated(true)
          return
        }
      }

      if (fetchError) {
        console.warn('period_allocation_state fetch:', fetchError.message)
        setSaveError(
          'Could not load from server (table may need migration). Using browser backup if available.',
        )
      }

      try {
        const raw = localStorage.getItem(STORAGE_KEY_V2)
        if (raw) {
          const parsed = JSON.parse(raw)
          const normalized = normalizePersistedStateV2(parsed)
          if (normalized) {
            setData(normalized)
            const { error: upErr } = await supabase.from('period_allocation_state').upsert(
              {
                id: PERIOD_ALLOCATION_STATE_ID,
                payload: normalized,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'id' },
            )
            if (upErr) {
              setSaveError(
                (prev) =>
                  prev ||
                  'Could not sync browser backup to server. Edits still save in this browser.',
              )
            }
          }
        }
      } catch (e) {
        console.warn('period allocation local load failed', e)
      }
      setHydrated(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const payload = data
      ;(async () => {
        try {
          localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(payload))
        } catch (e) {
          console.warn('localStorage save failed', e)
        }
        setSaveStatus('saving')
        setSaveError(null)
        const { error } = await supabase.from('period_allocation_state').upsert(
          {
            id: PERIOD_ALLOCATION_STATE_ID,
            payload,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' },
        )
        if (error) {
          console.warn('period_allocation_state upsert:', error.message)
          setSaveStatus('error')
          setSaveError(
            `Not saved to server: ${error.message}. A copy remains in this browser.`,
          )
        } else {
          setSaveStatus('saved')
          setTimeout(() => setSaveStatus((s) => (s === 'saved' ? 'idle' : s)), 2500)
        }
      })()
    }, SAVE_DEBOUNCE_MS)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [data, hydrated])

  useEffect(() => {
    if (!actionsOpen) return
    const onDoc = (e) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target)) {
        setActionsOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [actionsOpen])

  useEffect(() => {
    if (!hoverCard.visible) return
    const close = () => setHoverCard((prev) => ({ ...prev, visible: false }))
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [hoverCard.visible])

  const teacherMap = useMemo(() => {
    const m = new Map()
    for (const t of teachers) m.set(t.id, t)
    return m
  }, [teachers])

  const gridTab =
    activeTab === 'summary' || activeTab === 'taCounselor' ? 'bilingualG1G8' : activeTab
  const subjectCols = useMemo(() => subjectColumns(gridTab), [gridTab])
  const rows = data[gridTab].rows

  const combinedSummaries = useMemo(
    () => computeCombinedTeacherSummaries(data, teacherMap),
    [data, teacherMap],
  )
  const teacherAssignmentLines = useMemo(() => buildCombinedTeacherAssignmentLines(data), [data])

  const placeholderAssignmentLines = useMemo(
    () => summarizePlaceholderAssignments(data),
    [data],
  )

  const placeholders = data.placeholderTeachers ?? []
  const taStaff = data.taStaff ?? []
  const taRows = data.taCounselorAllocation?.rows ?? []
  const taSummaries = useMemo(
    () => computeTaCounselorSummaries(data.taCounselorAllocation, taStaff),
    [data.taCounselorAllocation, taStaff],
  )
  const taRecruitmentAssignmentLines = useMemo(() => {
    /** @type {Map<string, Set<string>>} */
    const acc = new Map()
    for (const row of taRows) {
      const parsed = parseTaAssignment(row.assignment)
      if (!parsed) continue
      if (!acc.has(parsed.id)) acc.set(parsed.id, new Set())
      const levelLabel = row.level === 'secondary' ? 'Secondary' : 'Primary'
      const programmeLabel = row.programme === 'integrated' ? 'Integrated' : 'Bilingual'
      const classLabel = String(row.className || '').trim() || '(No class)'
      acc.get(parsed.id).add(`${classLabel} · ${levelLabel} · ${programmeLabel}`)
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
  }, [taRows])
  const newTaCounselorNeeds = useMemo(
    () =>
      taStaff.filter((s) =>
        String(s.name || '')
          .trim()
          .toUpperCase()
          .startsWith('NEW'),
      ),
    [taStaff],
  )

  const openPlaceholderModal = useCallback(() => {
    setEditingPlaceholderId(null)
    setPhFormName('')
    setPhFormLevel('')
    setPhFormSubject(PLACEHOLDER_SUBJECT_OPTIONS[0])
    setPlaceholderModalOpen(true)
  }, [])

  const openTaStaffModal = useCallback(() => {
    setEditingTaStaffId(null)
    setTaStaffFormName('')
    setTaStaffModalOpen(true)
  }, [])

  const openPlaceholderEditModal = useCallback((placeholder) => {
    setEditingPlaceholderId(placeholder.id)
    setPhFormName(placeholder.name || '')
    setPhFormLevel(normalizeTeacherLevel(placeholder.level))
    setPhFormSubject(
      PLACEHOLDER_SUBJECT_OPTIONS.includes(placeholder.subject)
        ? placeholder.subject
        : PLACEHOLDER_SUBJECT_OPTIONS[0],
    )
    setPlaceholderModalOpen(true)
  }, [])

  const openTaStaffEditModal = useCallback((staff) => {
    setEditingTaStaffId(staff.id)
    setTaStaffFormName(staff.name || '')
    setTaStaffModalOpen(true)
  }, [])

  const handleAddPlaceholderSubmit = useCallback(
    (e) => {
      e.preventDefault()
      const name = phFormName.trim()
      if (!name) {
        window.alert('Enter a name.')
        return
      }
      if (!PLACEHOLDER_SUBJECT_OPTIONS.includes(phFormSubject)) return
      if (editingPlaceholderId) {
        setData((prev) => ({
          ...prev,
          placeholderTeachers: (prev.placeholderTeachers ?? []).map((p) =>
            p.id === editingPlaceholderId
              ? { ...p, name, level: phFormLevel, subject: phFormSubject }
              : p,
          ),
        }))
      } else {
        const id =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `ph-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
        setData((prev) => ({
          ...prev,
          placeholderTeachers: [
            ...(prev.placeholderTeachers ?? []),
            { id, name, level: phFormLevel, subject: phFormSubject },
          ],
        }))
      }
      setPlaceholderModalOpen(false)
      setEditingPlaceholderId(null)
      setPhFormName('')
      setPhFormLevel('')
      setPhFormSubject(PLACEHOLDER_SUBJECT_OPTIONS[0])
    },
    [editingPlaceholderId, phFormName, phFormLevel, phFormSubject],
  )

  const removePlaceholder = useCallback((id) => {
    const p = placeholders.find((x) => x.id === id)
    if (!p) return
    if (
      !window.confirm(
        `Remove placeholder “${p.name}”? Cells still reference this id until you change them; summaries will show “Placeholder (removed)” for those cells.`,
      )
    ) {
      return
    }
    setData((prev) => ({
      ...prev,
      placeholderTeachers: (prev.placeholderTeachers ?? []).filter((x) => x.id !== id),
    }))
  }, [placeholders])

  const handleTaStaffSubmit = useCallback(
    (e) => {
      e.preventDefault()
      const name = taStaffFormName.trim()
      if (!name) {
        window.alert('Enter a name.')
        return
      }
      if (editingTaStaffId) {
        setData((prev) => ({
          ...prev,
          taStaff: (prev.taStaff ?? []).map((s) =>
            s.id === editingTaStaffId ? { ...s, name } : s,
          ),
        }))
      } else {
        const id =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `ta-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
        setData((prev) => ({
          ...prev,
          taStaff: [...(prev.taStaff ?? []), { id, name }],
        }))
      }
      setEditingTaStaffId(null)
      setTaStaffFormName('')
      setTaStaffModalOpen(false)
    },
    [editingTaStaffId, taStaffFormName],
  )

  const removeTaStaff = useCallback(
    (id) => {
      const staff = taStaff.find((s) => s.id === id)
      if (!staff) return
      if (
        !window.confirm(
          `Remove TA/Counselor “${staff.name}”? Existing rows keep a reference until reassigned.`,
        )
      ) {
        return
      }
      setData((prev) => ({
        ...prev,
        taStaff: (prev.taStaff ?? []).filter((s) => s.id !== id),
      }))
    },
    [taStaff],
  )

  const updateRowField = useCallback(
    (rowId, field, value) => {
      setData((prev) => ({
        ...prev,
        [gridTab]: {
          rows: prev[gridTab].rows.map((r) =>
            r.id === rowId ? { ...r, [field]: value } : r,
          ),
        },
      }))
    },
    [gridTab],
  )

  const addRow = useCallback(() => {
    if (activeTab === 'taCounselor') {
      setData((prev) => ({
        ...prev,
        taCounselorAllocation: {
          rows: [...(prev.taCounselorAllocation?.rows ?? []), createEmptyTaAllocationRow()],
        },
      }))
      return
    }
    const prog = activeTab === 'summary' ? 'bilingualG1G8' : activeTab
    if (activeTab === 'summary') setActiveTab('bilingualG1G8')
    setData((prev) => ({
      ...prev,
      [prog]: {
        rows: [...prev[prog].rows, createEmptyRow(prog)],
      },
    }))
  }, [activeTab])

  const updateTaRowField = useCallback((rowId, field, value) => {
    setData((prev) => ({
      ...prev,
      taCounselorAllocation: {
        rows: (prev.taCounselorAllocation?.rows ?? []).map((r) =>
          r.id === rowId ? { ...r, [field]: value } : r,
        ),
      },
    }))
  }, [])

  const removeTaRow = useCallback((rowId) => {
    setData((prev) => ({
      ...prev,
      taCounselorAllocation: {
        rows: (prev.taCounselorAllocation?.rows ?? []).filter((r) => r.id !== rowId),
      },
    }))
  }, [])

  const removeRow = useCallback(
    (rowId) => {
      setData((prev) => ({
        ...prev,
        [gridTab]: {
          rows: prev[gridTab].rows.filter((r) => r.id !== rowId),
        },
      }))
    },
    [gridTab],
  )

  const handleResetTab = () => {
    if (activeTab === 'summary') return
    if (
      !window.confirm(
        `Clear all class rows and assignments for ${
          activeTab === 'bilingualG1G8'
            ? 'Bilingual (G1-G8)'
            : activeTab === 'integratedG1G8'
              ? 'Integrated (G1-G8)'
              : activeTab === 'bilingualG9G10'
                ? 'Bilingual (G9-G10)'
                : 'Integrated (G9-G11)'
        }?`,
      )
    ) {
      return
    }
    setData((prev) => ({
      ...prev,
      [activeTab]: { rows: [] },
    }))
    setActionsOpen(false)
  }

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'period_allocation_v2.json'
    a.click()
    URL.revokeObjectURL(url)
    setActionsOpen(false)
  }

  const handleImportJson = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const normalized = normalizePersistedStateV2(parsed)
      if (normalized) setData(normalized)
      else window.alert('Expected period_allocation v2 JSON (version: 2).')
    } catch (err) {
      console.error(err)
      window.alert('Import failed: invalid JSON.')
    }
    e.target.value = ''
    setActionsOpen(false)
  }

  const handleExportClassesCsv = () => {
    if (activeTab === 'summary') return
    const programme =
      activeTab === 'bilingualG1G8'
        ? 'Bilingual (G1-G8)'
        : activeTab === 'integratedG1G8'
          ? 'Integrated (G1-G8)'
          : activeTab === 'bilingualG9G10'
            ? 'Bilingual (G9-G10)'
            : 'Integrated (G9-G11)'
    const r = data[activeTab].rows
    const csvRows = r.map((row, i) => ({
      No: i + 1,
      Class: row.className,
      Department: row.department === 'primary' ? 'Primary' : 'Secondary',
      Programme: programme,
    }))
    const csv = Papa.unparse(csvRows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `period_allocation_classes_${activeTab}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setActionsOpen(false)
  }

  const handleImportClassesCsv = (e) => {
    if (activeTab === 'summary') return
    const file = e.target.files?.[0]
    if (!file) return
    const tab = activeTab
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const imported = rowsFromCsvRecords(results.data)
        if (imported.length === 0) {
          window.alert('No valid rows found. Use columns Class (required) and Department (Primary/Secondary).')
          e.target.value = ''
          return
        }
        if (
          !window.confirm(
            `Replace all ${tab} rows with ${imported.length} classes from CSV? Current assignments will be cleared for this tab.`,
          )
        ) {
          e.target.value = ''
          return
        }
        const newRows = imported.map(({ className, department }) => {
          const row = createEmptyRow(tab)
          row.className = className
          row.department = department
          return row
        })
        setData((prev) => ({
          ...prev,
          [tab]: { rows: newRows },
        }))
        e.target.value = ''
        setActionsOpen(false)
      },
      error: (err) => {
        console.error(err)
        window.alert('CSV parse failed.')
        e.target.value = ''
      },
    })
  }

  const fmt2 = (n) => n.toFixed(2)
  const fmt1 = (n) => n.toFixed(1)
  const denseCellClass = denseMode ? 'p-0.5' : 'p-1'
  const denseInputClass = denseMode ? 'py-1 px-1 text-[11px]' : 'py-1.5 px-2 text-xs'

  const openHoverCard = (event, lines) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setHoverCard({ visible: true, anchorRect: rect, lines })
  }

  const closeHoverCard = () => {
    setHoverCard((prev) => ({ ...prev, visible: false }))
  }

  const tabTitle =
    gridTab === 'bilingualG1G8'
      ? 'Bilingual (G1-G8)'
      : gridTab === 'integratedG1G8'
        ? 'Integrated (G1-G8)'
        : gridTab === 'bilingualG9G10'
          ? 'Bilingual (G9-G10)'
          : activeTab === 'taCounselor'
            ? 'TA / Counselor Allocation'
            : 'Integrated (G9-G11)'

  const gridDisabled = activeTab === 'summary' || activeTab === 'taCounselor'

  return (
    <Layout>
      <div className="mb-6">
        <div className="sticky top-0 z-40 bg-[var(--app-bg)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--app-bg)]/80 py-2">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="text-white px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity text-sm"
            style={{ backgroundColor: '#1f86c7' }}
          >
            ← Go Back
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={addRow}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
            >
              {activeTab === 'taCounselor' ? 'Add row' : 'Add class'}
            </button>
            <div className="relative" ref={actionsMenuRef}>
              <button
                type="button"
                onClick={() => setActionsOpen((o) => !o)}
                aria-expanded={actionsOpen}
                aria-haspopup="true"
                className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 flex items-center gap-1"
              >
                Actions
                <span className="text-xs opacity-70" aria-hidden>
                  ▾
                </span>
              </button>
              {actionsOpen && (
                <div
                  className="absolute right-0 mt-1 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg z-30"
                  role="menu"
                >
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
                    onClick={() => {
                      handleExportJson()
                    }}
                  >
                    Download JSON backup
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
                    onClick={() => jsonImportRef.current?.click()}
                  >
                    Load JSON backup
                  </button>
                  <hr className="my-1 border-gray-200" />
                  <button
                    type="button"
                    role="menuitem"
                    disabled={gridDisabled}
                    title={gridDisabled ? 'Switch to a programme tab' : undefined}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                    onClick={() => !gridDisabled && handleExportClassesCsv()}
                  >
                    Export classes CSV
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={gridDisabled}
                    title={gridDisabled ? 'Switch to a programme tab' : undefined}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                    onClick={() => !gridDisabled && csvImportRef.current?.click()}
                  >
                    Import classes CSV
                  </button>
                  <hr className="my-1 border-gray-200" />
                  <button
                    type="button"
                    role="menuitem"
                    disabled={gridDisabled}
                    className="w-full text-left px-3 py-2 text-sm text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40 disabled:opacity-40"
                    onClick={() => !gridDisabled && handleResetTab()}
                  >
                    Reset current programme
                  </button>
                </div>
              )}
              <input
                ref={jsonImportRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={handleImportJson}
              />
              <input
                ref={csvImportRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleImportClassesCsv}
              />
            </div>
          </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <button
              type="button"
              onClick={() => setDenseMode((v) => !v)}
              className="px-2.5 py-1 rounded-md text-xs font-medium border border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
            >
              {denseMode ? 'Dense view: On' : 'Dense view: Off'}
            </button>
          </div>
          <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('summary')}
              className={`shrink-0 px-4 py-2 text-sm font-medium rounded-t-md border-b-2 -mb-px transition-colors ${
                activeTab === 'summary'
                  ? 'border-indigo-600 text-indigo-700 dark:text-indigo-300'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              Summary
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('bilingualG1G8')}
              className={`shrink-0 px-4 py-2 text-sm font-medium rounded-t-md border-b-2 -mb-px transition-colors ${
                activeTab === 'bilingualG1G8'
                  ? 'border-purple-600 text-purple-700 dark:text-purple-300'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              Bilingual (G1-G8)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('integratedG1G8')}
              className={`shrink-0 px-4 py-2 text-sm font-medium rounded-t-md border-b-2 -mb-px transition-colors ${
                activeTab === 'integratedG1G8'
                  ? 'border-teal-600 text-teal-700 dark:text-teal-300'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              Integrated (G1-G8)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('bilingualG9G10')}
              className={`shrink-0 px-4 py-2 text-sm font-medium rounded-t-md border-b-2 -mb-px transition-colors ${
                activeTab === 'bilingualG9G10'
                  ? 'border-fuchsia-600 text-fuchsia-700 dark:text-fuchsia-300'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              Bilingual (G9-G10)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('integratedG9G11')}
              className={`shrink-0 px-4 py-2 text-sm font-medium rounded-t-md border-b-2 -mb-px transition-colors ${
                activeTab === 'integratedG9G11'
                  ? 'border-cyan-600 text-cyan-700 dark:text-cyan-300'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              Integrated (G9-G11)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('taCounselor')}
              className={`shrink-0 px-4 py-2 text-sm font-medium rounded-t-md border-b-2 -mb-px transition-colors ${
                activeTab === 'taCounselor'
                  ? 'border-emerald-600 text-emerald-700 dark:text-emerald-300'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              TA / Counselor
            </button>
          </div>
        </div>

        <h1 className="text-2xl font-semibold text-gray-900 mb-1">
          Period &amp; Subject Allocations
        </h1>
        <p className="text-sm text-gray-600 mb-2">
          Plan and manage allocations.
        </p>
        <p className="text-xs mb-4 min-h-[1.25rem]" aria-live="polite">
          {saveStatus === 'saving' && (
            <span className="text-gray-500">Saving to server…</span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-emerald-700 dark:text-emerald-400">Saved to server.</span>
          )}
          {saveError && (
            <span className="text-amber-800 dark:text-amber-300">{saveError}</span>
          )}
        </p>

        {activeTab !== 'summary' && activeTab !== 'taCounselor' && (
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-2">
              {tabTitle}
            </h2>
            <p className="text-xs text-gray-500 mb-2">
              Teaching hours: Primary {PRIMARY_MINUTES} min/period, Secondary {SECONDARY_MINUTES}{' '}
              min/period. Preps count once per subject column within the same department and
              programme (shared lessons across classes).
            </p>
            <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm mb-8 bg-white">
              <table className="min-w-max w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="sticky top-0 left-0 z-30 px-2 py-2 text-left text-gray-600 font-medium border-b border-r border-gray-200 bg-gray-50">
                      No.
                    </th>
                    <th className="sticky top-0 left-[2.5rem] z-20 px-2 py-2 text-left text-gray-600 font-medium border-b border-r border-gray-200 bg-gray-50">
                      Department
                    </th>
                    <th className="sticky top-0 left-[9.5rem] z-20 px-2 py-2 text-left text-gray-600 font-medium border-b border-r border-gray-200 bg-gray-50 min-w-[5rem]">
                      Class
                    </th>
                    <th className="sticky top-0 z-10 px-2 py-2 text-left text-gray-600 font-medium border-b border-gray-200 bg-gray-50">
                      Programme
                    </th>
                    {subjectCols.map((c) => (
                      <th
                        key={c.key}
                        className="px-1 py-2 text-center text-gray-600 font-medium border-b border-gray-200 whitespace-nowrap"
                      >
                        {c.label} [{c.periodsPerWeek}]
                      </th>
                    ))}
                    <th className="px-1 py-2 border-b border-gray-200 w-16" />
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6 + subjectCols.length}
                        className="px-3 py-6 text-center text-gray-500"
                      >
                        No classes yet. Click &quot;Add class&quot; or use Actions → Import classes CSV.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, idx) => (
                      <tr
                        key={row.id}
                        className="odd:bg-white even:bg-gray-50 dark:odd:bg-gray-900 dark:even:bg-gray-800 border-t border-gray-200"
                      >
                        <th className="sticky left-0 z-20 px-2 py-1 text-left font-medium text-gray-900 border-t border-r border-gray-200 bg-inherit">
                          {idx + 1}
                        </th>
                        <td className={`sticky left-[2.5rem] z-10 border-t border-r border-gray-200 ${denseCellClass} bg-inherit`}>
                          <select
                            value={row.department}
                            onChange={(e) =>
                              updateRowField(row.id, 'department', e.target.value)
                            }
                            className={`w-full min-w-[6.5rem] rounded border ${denseInputClass} ${
                              row.department === 'primary'
                                ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-700'
                                : 'border-sky-300 bg-sky-50 dark:bg-sky-950/40 dark:border-sky-700'
                            }`}
                          >
                            <option value="primary">Primary</option>
                            <option value="secondary">Secondary</option>
                          </select>
                        </td>
                        <td className={`sticky left-[9.5rem] z-10 border-t border-r border-gray-200 ${denseCellClass} bg-inherit`}>
                          <input
                            type="text"
                            value={row.className}
                            onChange={(e) =>
                              updateRowField(row.id, 'className', e.target.value)
                            }
                            placeholder="e.g. 1B1"
                            className={`w-full min-w-[4.5rem] rounded border border-gray-300 bg-white ${denseInputClass}`}
                          />
                        </td>
                        <td className={`border-t border-gray-200 ${denseCellClass} text-[11px] text-gray-600`}>
                          {gridTab === 'bilingualG1G8'
                            ? 'Bilingual (G1-G8)'
                            : gridTab === 'integratedG1G8'
                              ? 'Integrated (G1-G8)'
                              : gridTab === 'bilingualG9G10'
                                ? 'Bilingual (G9-G10)'
                                : 'Integrated (G9-G11)'}
                        </td>
                        {subjectCols.map((c) => {
                          const { match, unspec } = staffOptionsForCell(
                            teachers,
                            row.department,
                            c.key,
                          )
                          const { match: phMatch, unspec: phUnspec } =
                            placeholderOptionsForCell(placeholders, row.department, c.key)
                          const raw = row[c.key] ?? ''
                          const parsed = parseAssignment(raw)
                          const assignedUserId =
                            parsed?.kind === 'user' ? parsed.id : null
                          const assignedPhId =
                            parsed?.kind === 'placeholder' ? parsed.id : null
                          const idsInGroups = new Set([
                            ...match.map((t) => t.id),
                            ...unspec.map((t) => t.id),
                          ])
                          const userOrphan =
                            assignedUserId && !idsInGroups.has(assignedUserId)
                              ? assignedUserId
                              : null
                          const orphanTeacher = userOrphan
                            ? teachers.find((t) => t.id === userOrphan)
                            : null
                          const phIdsInGroups = new Set([
                            ...phMatch.map((p) => p.id),
                            ...phUnspec.map((p) => p.id),
                          ])
                          const phOrphan =
                            assignedPhId && !phIdsInGroups.has(assignedPhId)
                              ? assignedPhId
                              : null
                          const phOrphanMeta = phOrphan
                            ? placeholders.find((p) => p.id === phOrphan)
                            : null
                          const nameLegacy = parsed?.kind === 'name'
                          const showCurrentGroup =
                            userOrphan || phOrphan || nameLegacy
                          return (
                            <td
                              key={c.key}
                              className={`border-t border-gray-200 ${denseCellClass} align-middle`}
                            >
                              <select
                                value={raw}
                                onChange={(e) =>
                                  updateRowField(row.id, c.key, e.target.value)
                                }
                              className={`w-[min(10rem,26vw)] max-w-[180px] leading-tight rounded border border-gray-300 bg-white ${denseInputClass}`}
                              >
                                <option value="">—</option>
                                {showCurrentGroup && (
                                  <optgroup label="Current assignment">
                                    {userOrphan && (
                                      <option value={formatUserAssignment(userOrphan)}>
                                        {orphanTeacher
                                          ? orphanTeacher.full_name || userOrphan
                                          : `Staff (${userOrphan.slice(0, 8)}…)`}
                                      </option>
                                    )}
                                    {phOrphan && (
                                      <option value={formatPlaceholderAssignment(phOrphan)}>
                                        {phOrphanMeta?.name || 'Placeholder (removed)'}
                                      </option>
                                    )}
                                    {nameLegacy && parsed && (
                                      <option value={raw}>{parsed.name}</option>
                                    )}
                                  </optgroup>
                                )}
                                {match.length > 0 && (
                                  <optgroup
                                    label={
                                      row.department === 'primary' ? 'Primary' : 'Secondary'
                                    }
                                  >
                                    {match.map((t) => (
                                      <option
                                        key={t.id}
                                        value={formatUserAssignment(t.id)}
                                      >
                                        {t.full_name || t.id}
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                                {unspec.length > 0 && (
                                  <optgroup label="Unspecified level">
                                    {unspec.map((t) => (
                                      <option
                                        key={t.id}
                                        value={formatUserAssignment(t.id)}
                                      >
                                        {t.full_name || t.id}
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                                {phMatch.length > 0 && (
                                  <optgroup
                                    label={`Placeholders — ${
                                      row.department === 'primary' ? 'Primary' : 'Secondary'
                                    }`}
                                  >
                                    {phMatch.map((p) => (
                                      <option
                                        key={p.id}
                                        value={formatPlaceholderAssignment(p.id)}
                                      >
                                        {p.name}
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                                {phUnspec.length > 0 && (
                                  <optgroup label="Placeholders — Unspecified level">
                                    {phUnspec.map((p) => (
                                      <option
                                        key={p.id}
                                        value={formatPlaceholderAssignment(p.id)}
                                      >
                                        {p.name}
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                              </select>
                            </td>
                          )
                        })}
                        <td className={`border-t border-gray-200 ${denseCellClass}`}>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm('Remove this row?')) removeRow(row.id)
                            }}
                            className="text-red-600 hover:underline dark:text-red-400 text-[11px]"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'taCounselor' && (
          <div className="mb-4">
            <h2 className="text-base font-semibold text-gray-900 mb-2">{tabTitle}</h2>
            <p className="text-xs text-gray-500 mb-3">
              Support periods are auto-calculated from level and programme.
            </p>

            <div className="rounded-xl border border-gray-200 bg-white dark:bg-gray-900 p-3 mb-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h3 className="text-sm font-semibold text-gray-900">TA/Counselor Staff List</h3>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setTaStaffExpanded((v) => !v)}
                    className="text-xs font-medium text-gray-700 hover:underline dark:text-gray-300"
                    aria-expanded={taStaffExpanded}
                  >
                    {taStaffExpanded ? 'Collapse' : 'Expand'}
                  </button>
                  <button
                    type="button"
                    onClick={openTaStaffModal}
                    className="text-xs font-medium text-violet-700 hover:underline dark:text-violet-300"
                  >
                    Add…
                  </button>
                </div>
              </div>
              {taStaffExpanded &&
                (taStaff.length === 0 ? (
                  <p className="text-xs text-gray-500">
                    No TA/Counselor names yet. Add names to use in allocation rows.
                  </p>
                ) : (
                  <ul className="text-xs space-y-2">
                    {taStaff.map((s) => (
                      <li
                        key={s.id}
                        className="py-1 border-b border-gray-200 last:border-0 flex items-center justify-between gap-2"
                      >
                        <span className="font-medium text-gray-900">{s.name}</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openTaStaffEditModal(s)}
                            className="rounded px-2 py-0.5 text-[11px] font-medium text-blue-700 border border-blue-200 bg-blue-50 hover:bg-blue-100 dark:text-blue-300 dark:border-blue-700 dark:bg-blue-900/30"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => removeTaStaff(s.id)}
                            className="text-red-600 hover:underline dark:text-red-400"
                          >
                            Remove
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ))}
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm mb-8 bg-white">
              <table className="min-w-max w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="sticky top-0 left-0 z-30 px-2 py-2 text-left text-gray-600 font-medium border-b border-r border-gray-200 bg-gray-50">
                      No.
                    </th>
                    <th className="sticky top-0 left-[2.5rem] z-20 px-2 py-2 text-left text-gray-600 font-medium border-b border-r border-gray-200 bg-gray-50">
                      Level
                    </th>
                    <th className="sticky top-0 left-[9.5rem] z-20 px-2 py-2 text-left text-gray-600 font-medium border-b border-r border-gray-200 min-w-[5rem] bg-gray-50">
                      Class
                    </th>
                    <th className="px-2 py-2 text-left text-gray-600 font-medium border-b border-gray-200">
                      Programme
                    </th>
                    <th className="px-2 py-2 text-right text-gray-600 font-medium border-b border-gray-200">
                      No. of Support Periods
                    </th>
                    <th className="px-2 py-2 text-left text-gray-600 font-medium border-b border-gray-200">
                      TA/Counselor in Charge
                    </th>
                    <th className="px-1 py-2 border-b border-gray-200 w-16" />
                  </tr>
                </thead>
                <tbody>
                  {taRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                        No TA/Counselor rows yet. Click &quot;Add row&quot;.
                      </td>
                    </tr>
                  ) : (
                    taRows.map((row, idx) => {
                      const parsed = parseTaAssignment(row.assignment)
                      const assignedId = parsed?.id || null
                      const staffIds = new Set(taStaff.map((s) => s.id))
                      const orphan = assignedId && !staffIds.has(assignedId) ? assignedId : null
                      const orphanName = orphan ? 'TA/Counselor (removed)' : null
                      const periods = taSupportPeriods(row.level, row.programme, row.className)
                      return (
                        <tr
                          key={row.id}
                          className="odd:bg-white even:bg-gray-50 dark:odd:bg-gray-900 dark:even:bg-gray-800 border-t border-gray-200"
                        >
                          <th className="sticky left-0 z-20 px-2 py-1 text-left font-medium text-gray-900 border-t border-r border-gray-200 bg-inherit">
                            {idx + 1}
                          </th>
                          <td className={`sticky left-[2.5rem] z-10 border-t border-r border-gray-200 ${denseCellClass} bg-inherit`}>
                            <select
                              value={row.level}
                              onChange={(e) => updateTaRowField(row.id, 'level', e.target.value)}
                              className={`w-full min-w-[6.5rem] rounded border ${denseInputClass} ${
                                row.level === 'primary'
                                  ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-700'
                                  : 'border-sky-300 bg-sky-50 dark:bg-sky-950/40 dark:border-sky-700'
                              }`}
                            >
                              <option value="primary">Primary</option>
                              <option value="secondary">Secondary</option>
                            </select>
                          </td>
                          <td className={`sticky left-[9.5rem] z-10 border-t border-r border-gray-200 ${denseCellClass} bg-inherit`}>
                            <input
                              type="text"
                              value={row.className}
                              onChange={(e) => updateTaRowField(row.id, 'className', e.target.value)}
                              placeholder="e.g. 1B1"
                              className={`w-full min-w-[4.5rem] rounded border border-gray-300 bg-white ${denseInputClass}`}
                            />
                          </td>
                          <td className={`border-t border-gray-200 ${denseCellClass}`}>
                            <select
                              value={row.programme}
                              onChange={(e) =>
                                updateTaRowField(row.id, 'programme', e.target.value)
                              }
                              className={`w-full min-w-[7rem] rounded border border-gray-300 bg-white ${denseInputClass}`}
                            >
                              {TA_PROGRAMME_OPTIONS.map((p) => (
                                <option key={p.key} value={p.key}>
                                  {p.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className={`border-t border-gray-200 ${denseCellClass} text-right tabular-nums text-gray-700`}>
                            {periods}
                          </td>
                          <td className={`border-t border-gray-200 ${denseCellClass}`}>
                            <select
                              value={row.assignment ?? ''}
                              onChange={(e) =>
                                updateTaRowField(row.id, 'assignment', e.target.value)
                              }
                              className={`w-[min(12rem,28vw)] max-w-[210px] leading-tight rounded border border-gray-300 bg-white ${denseInputClass}`}
                            >
                              <option value="">—</option>
                              {orphan && (
                                <optgroup label="Current assignment">
                                  <option value={formatTaAssignment(orphan)}>{orphanName}</option>
                                </optgroup>
                              )}
                              {taStaff.length > 0 && (
                                <optgroup label="TA/Counselor list">
                                  {taStaff.map((s) => (
                                    <option key={s.id} value={formatTaAssignment(s.id)}>
                                      {s.name}
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                            </select>
                          </td>
                          <td className={`border-t border-gray-200 ${denseCellClass}`}>
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm('Remove this row?')) removeTaRow(row.id)
                              }}
                              className="text-red-600 hover:underline dark:text-red-400 text-[11px]"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'summary' && (
          <div className="mb-4">
            <h2 className="text-base font-semibold text-gray-900 mb-2">
              Teacher Hour Allocation Summary
            </h2>
            <p className="text-xs text-gray-500 mb-3">
              Periods and teaching hours across all programmes and levels.
            </p>

            <div className="rounded-xl border border-gray-200 bg-white dark:bg-gray-900 p-3 mb-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h3 className="text-sm font-semibold text-gray-900">Recruitment Needs (SY26/27)</h3>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setRecruitmentExpanded((v) => !v)}
                    className="text-xs font-medium text-gray-700 hover:underline dark:text-gray-300"
                    aria-expanded={recruitmentExpanded}
                  >
                    {recruitmentExpanded ? 'Collapse' : 'Expand'}
                  </button>
                  <button
                    type="button"
                    onClick={openPlaceholderModal}
                    className="text-xs font-medium text-violet-700 hover:underline dark:text-violet-300"
                  >
                    Add…
                  </button>
                </div>
              </div>
              {recruitmentExpanded &&
                (placeholders.length === 0 && newTaCounselorNeeds.length === 0 ? (
                  <p className="text-xs text-gray-500">
                    None defined. Use <strong>Add…</strong> above to create recruitment placeholders;
                    they appear in all programme grids by level and subject.
                  </p>
                ) : (
                  <ul className="text-xs space-y-2">
                    {placeholders.map((p) => {
                      const lines = placeholderAssignmentLines.get(p.id) ?? []
                      return (
                        <li key={p.id} className="py-1 border-b border-gray-200 last:border-0">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <span>
                              <span className="font-medium text-gray-900">{p.name}</span>
                              <span className="text-gray-500">
                                {' '}
                                — {p.subject}
                                {normalizeTeacherLevel(p.level)
                                  ? ` · ${normalizeTeacherLevel(p.level) === 'primary' ? 'Primary' : 'Secondary'}`
                                  : ' · Level unspecified'}
                              </span>
                            </span>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => openPlaceholderEditModal(p)}
                                className="rounded px-2 py-0.5 text-[11px] font-medium text-blue-700 border border-blue-200 bg-blue-50 hover:bg-blue-100 dark:text-blue-300 dark:border-blue-700 dark:bg-blue-900/30"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => removePlaceholder(p.id)}
                                className="text-red-600 hover:underline dark:text-red-400"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                          <p className="mt-1 text-[11px] text-gray-500 leading-snug">
                            {lines.length === 0 ? (
                              <>Not assigned in any grid yet.</>
                            ) : (
                              <>
                                <span className="font-medium text-gray-600">Assigned: </span>
                                {lines.join(' · ')}
                              </>
                            )}
                          </p>
                        </li>
                      )
                    })}
                    {newTaCounselorNeeds.map((s) => {
                      const lines = taRecruitmentAssignmentLines.get(s.id) ?? []
                      return (
                        <li key={`ta-need-${s.id}`} className="py-1 border-b border-gray-200 last:border-0">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <span>
                              <span className="font-medium text-gray-900">{s.name}</span>
                              <span className="text-gray-500"> — TA/Counselor</span>
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-gray-500 leading-snug">
                            {lines.length === 0 ? (
                              <>Marked as new in TA/Counselor staff list. Not assigned yet.</>
                            ) : (
                              <>
                                <span className="font-medium text-gray-600">Assigned: </span>
                                {lines.join(' · ')}
                              </>
                            )}
                          </p>
                        </li>
                      )
                    })}
                  </ul>
                ))}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-3 mb-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h3 className="text-sm font-semibold text-gray-900">Teacher Summary</h3>
                <button
                  type="button"
                  onClick={() => setTeacherSummaryExpanded((v) => !v)}
                  className="text-xs font-medium text-gray-700 hover:underline dark:text-gray-300"
                  aria-expanded={teacherSummaryExpanded}
                >
                  {teacherSummaryExpanded ? 'Collapse' : 'Expand'}
                </button>
              </div>
              {teacherSummaryExpanded && (
                <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                  <table className="min-w-[640px] w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-left">
                        <th className="px-2 py-2 text-gray-600 font-medium">No.</th>
                        <th className="px-2 py-2 text-gray-600 font-medium">Teacher</th>
                        <th className="px-2 py-2 text-gray-600 font-medium">Level</th>
                        <th className="px-2 py-2 text-gray-600 font-medium">Subject(s)</th>
                        <th className="px-2 py-2 text-gray-600 font-medium text-right">Periods</th>
                        <th className="px-2 py-2 text-gray-600 font-medium text-right">
                          Teaching hours
                        </th>
                        <th className="px-2 py-2 text-gray-600 font-medium text-right"># of preps</th>
                        <th className="px-2 py-2 text-gray-600 font-medium text-right">Prep time</th>
                        <th className="px-2 py-2 text-gray-600 font-medium text-right">Admin hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {combinedSummaries.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-3 py-4 text-center text-gray-400">
                            No teacher assignments in programme grids yet.
                          </td>
                        </tr>
                      ) : (
                        combinedSummaries.map((s, i) => {
                          const assignmentLines = teacherAssignmentLines.get(s.teacherKey) ?? []
                          return (
                            <tr
                              key={s.teacherKey}
                              className="border-t border-gray-200 odd:bg-white even:bg-gray-50 dark:odd:bg-gray-900 dark:even:bg-gray-800"
                            >
                              <td className="px-2 py-2 tabular-nums text-gray-900">{i + 1}</td>
                              <td className="px-2 py-2 text-gray-900">
                                <button
                                  type="button"
                                  className="text-left hover:underline focus-visible:underline focus-visible:outline-none"
                                  aria-label={`Show allocated classes for ${s.displayName}`}
                                  onMouseEnter={(e) => openHoverCard(e, assignmentLines)}
                                  onMouseLeave={closeHoverCard}
                                  onFocus={(e) => openHoverCard(e, assignmentLines)}
                                  onBlur={closeHoverCard}
                                >
                                  {s.displayName}
                                </button>
                              </td>
                              <td className="px-2 py-2 text-gray-600">{s.levelLabel}</td>
                              <td className="px-2 py-2 text-gray-600">{s.subjectSummary}</td>
                              <td className="px-2 py-2 text-right tabular-nums text-gray-900">
                                {s.periods}
                              </td>
                              <td className="px-2 py-2 text-right tabular-nums text-gray-900">
                                {fmt2(s.teachingHours)}
                              </td>
                              <td className="px-2 py-2 text-right tabular-nums text-gray-900">
                                {fmt1(s.lessonPreps)}
                              </td>
                              <td className="px-2 py-2 text-right tabular-nums text-gray-900">
                                {fmt2(s.prepTimeHours)} h
                              </td>
                              <td
                                className={`px-2 py-2 text-right tabular-nums ${
                                  s.adminHours < 0
                                    ? 'text-amber-700 dark:text-amber-400'
                                    : 'text-gray-900'
                                }`}
                              >
                                {fmt2(s.adminHours)} h
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-3 mb-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h3 className="text-sm font-semibold text-gray-900">TA/Counselor Summary</h3>
                <button
                  type="button"
                  onClick={() => setTaSummaryExpanded((v) => !v)}
                  className="text-xs font-medium text-gray-700 hover:underline dark:text-gray-300"
                  aria-expanded={taSummaryExpanded}
                >
                  {taSummaryExpanded ? 'Collapse' : 'Expand'}
                </button>
              </div>
              {taSummaryExpanded && (
                <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                  <table className="w-auto text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-left">
                        <th className="px-1.5 py-2 text-gray-600 font-medium">No.</th>
                        <th className="px-1.5 py-2 text-gray-600 font-medium">TA/Counselor Name</th>
                        <th className="px-1.5 py-2 text-gray-600 font-medium text-right">
                          Total Periods
                        </th>
                        <th className="px-1.5 py-2 text-gray-600 font-medium text-right">Total Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {taSummaries.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-2 py-4 text-center text-gray-400">
                            No TA/Counselor assignments yet.
                          </td>
                        </tr>
                      ) : (
                        taSummaries.map((s, i) => (
                          <tr
                            key={s.staffId}
                            className="border-t border-gray-200 odd:bg-white even:bg-gray-50 dark:odd:bg-gray-900 dark:even:bg-gray-800"
                          >
                            <td className="px-1.5 py-2 tabular-nums text-gray-900">{i + 1}</td>
                            <td className="px-1.5 py-2 text-gray-900">{s.displayName}</td>
                            <td className="px-1.5 py-2 text-right tabular-nums text-gray-900">
                              {s.totalPeriods}
                            </td>
                            <td className="px-1.5 py-2 text-right tabular-nums text-gray-900">
                              {fmt2(s.totalHours)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <AssignmentHoverCard
        visible={hoverCard.visible}
        anchorRect={hoverCard.anchorRect}
        lines={hoverCard.lines}
      />

      {taStaffModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ta-staff-modal-title"
        >
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-xl">
            <h2 id="ta-staff-modal-title" className="text-lg font-semibold text-gray-900 mb-3">
              {editingTaStaffId ? 'Edit TA/Counselor name' : 'Add TA/Counselor name'}
            </h2>
            <form onSubmit={handleTaStaffSubmit} className="space-y-3">
              <div>
                <label
                  htmlFor="ta-staff-name"
                  className="block text-xs font-medium text-gray-600 mb-1"
                >
                  Name
                </label>
                <input
                  id="ta-staff-name"
                  type="text"
                  value={taStaffFormName}
                  onChange={(e) => setTaStaffFormName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  placeholder="e.g. NEW TA #1"
                  autoComplete="off"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setTaStaffModalOpen(false)
                    setEditingTaStaffId(null)
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700"
                >
                  {editingTaStaffId ? 'Save' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {placeholderModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ph-modal-title"
        >
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-xl">
            <h2
              id="ph-modal-title"
              className="text-lg font-semibold text-gray-900 mb-3"
            >
              {editingPlaceholderId ? 'Edit placeholder teacher' : 'Add placeholder teacher'}
            </h2>
            <form onSubmit={handleAddPlaceholderSubmit} className="space-y-3">
              <div>
                <label htmlFor="ph-name" className="block text-xs font-medium text-gray-600 mb-1">
                  Name
                </label>
                <input
                  id="ph-name"
                  type="text"
                  value={phFormName}
                  onChange={(e) => setPhFormName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  placeholder="e.g. Vacancy — ESL"
                  autoComplete="off"
                />
              </div>
              <div>
                <label htmlFor="ph-level" className="block text-xs font-medium text-gray-600 mb-1">
                  Level
                </label>
                <select
                  id="ph-level"
                  value={phFormLevel}
                  onChange={(e) => setPhFormLevel(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Unspecified (appears in both Primary and Secondary rows)</option>
                  <option value="primary">Primary</option>
                  <option value="secondary">Secondary</option>
                </select>
              </div>
              <div>
                <label htmlFor="ph-subject" className="block text-xs font-medium text-gray-600 mb-1">
                  Subject
                </label>
                <select
                  id="ph-subject"
                  value={phFormSubject}
                  onChange={(e) => setPhFormSubject(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  {PLACEHOLDER_SUBJECT_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setPlaceholderModalOpen(false)
                    setEditingPlaceholderId(null)
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700"
                >
                  {editingPlaceholderId ? 'Save' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}
