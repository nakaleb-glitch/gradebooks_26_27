import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Papa from 'papaparse'
import Layout from '../../components/Layout'
import { supabase } from '../../lib/supabase'
import {
  CONTRACT_HOURS_WEEK,
  PERIOD_ALLOCATION_STATE_ID,
  PLACEHOLDER_PRESETS,
  PRIMARY_MINUTES,
  SECONDARY_MINUTES,
  STORAGE_KEY_V2,
  computeCombinedTeacherSummaries,
  createEmptyRow,
  createInitialStateV2,
  formatNameAssignment,
  formatUserAssignment,
  normalizePersistedStateV2,
  normalizeTeacherLevel,
  normalizeUserSubject,
  parseAssignment,
  rowsFromCsvRecords,
  subjectColumnMatchesTeacherSubject,
  subjectColumns,
} from '../../lib/periodAllocation'

const SAVE_DEBOUNCE_MS = 400

/** @typedef {'bilingual' | 'integrated' | 'summary'} MainTab */

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
    /** @type {MainTab} */ ('bilingual'),
  )
  const [data, setData] = useState(() => createInitialStateV2())
  const [hydrated, setHydrated] = useState(false)
  const [teachers, setTeachers] = useState([])
  const [actionsOpen, setActionsOpen] = useState(false)
  const [saveStatus, setSaveStatus] = useState(
    /** @type {'idle' | 'saving' | 'saved' | 'error'} */ ('idle'),
  )
  const [saveError, setSaveError] = useState(null)

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

  const teacherMap = useMemo(() => {
    const m = new Map()
    for (const t of teachers) m.set(t.id, t)
    return m
  }, [teachers])

  const gridTab = activeTab === 'summary' ? 'bilingual' : activeTab
  const subjectCols = useMemo(() => subjectColumns(gridTab), [gridTab])
  const rows = data[gridTab].rows

  const combinedSummaries = useMemo(
    () => computeCombinedTeacherSummaries(data, teacherMap),
    [data, teacherMap],
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
    const prog = activeTab === 'summary' ? 'bilingual' : activeTab
    if (activeTab === 'summary') setActiveTab('bilingual')
    setData((prev) => ({
      ...prev,
      [prog]: {
        rows: [...prev[prog].rows, createEmptyRow(prog)],
      },
    }))
  }, [activeTab])

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
        `Clear all class rows and assignments for ${activeTab === 'bilingual' ? 'Bilingual' : 'Integrated'}?`,
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
    const programme = activeTab === 'bilingual' ? 'Bilingual' : 'Integrated'
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

  const tabTitle =
    gridTab === 'bilingual' ? 'Bilingual (G1 – G8)' : 'Integrated (G1 – G8) *Standard'

  const gridDisabled = activeTab === 'summary'

  return (
    <Layout>
      <div className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
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
              Add class
            </button>
            <div className="relative" ref={actionsMenuRef}>
              <button
                type="button"
                onClick={() => setActionsOpen((o) => !o)}
                aria-expanded={actionsOpen}
                aria-haspopup="true"
                className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 flex items-center gap-1"
              >
                Actions
                <span className="text-xs opacity-70" aria-hidden>
                  ▾
                </span>
              </button>
              {actionsOpen && (
                <div
                  className="absolute right-0 mt-1 w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-lg z-30 dark:border-slate-600 dark:bg-slate-900"
                  role="menu"
                >
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                    onClick={() => {
                      handleExportJson()
                    }}
                  >
                    Download JSON backup
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                    onClick={() => jsonImportRef.current?.click()}
                  >
                    Load JSON backup
                  </button>
                  <hr className="my-1 border-slate-200 dark:border-slate-600" />
                  <button
                    type="button"
                    role="menuitem"
                    disabled={gridDisabled}
                    title={gridDisabled ? 'Switch to Bilingual or Integrated' : undefined}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                    onClick={() => !gridDisabled && handleExportClassesCsv()}
                  >
                    Export classes CSV
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={gridDisabled}
                    title={gridDisabled ? 'Switch to Bilingual or Integrated' : undefined}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                    onClick={() => !gridDisabled && csvImportRef.current?.click()}
                  >
                    Import classes CSV
                  </button>
                  <hr className="my-1 border-slate-200 dark:border-slate-600" />
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

        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-1">
          Period allocation
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
          Staff dropdowns match Teacher Management <strong>Level</strong> and <strong>Subject</strong>{' '}
          (ESL/GP, Mathematics, Science, VN ESL). Preps dedupe by <strong>grade</strong> (from class
          code) per subject column so parallel classes in the same grade share prep; different grades do
          not. Combined summary adds both programmes. Data syncs to the database; {STORAGE_KEY_V2} is a
          local backup.
        </p>
        <p className="text-xs mb-4 min-h-[1.25rem]" aria-live="polite">
          {saveStatus === 'saving' && (
            <span className="text-slate-500 dark:text-slate-400">Saving to server…</span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-emerald-700 dark:text-emerald-400">Saved to server.</span>
          )}
          {saveError && (
            <span className="text-amber-800 dark:text-amber-300">{saveError}</span>
          )}
        </p>

        <div className="flex gap-2 mb-4 border-b border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setActiveTab('bilingual')}
            className={`px-4 py-2 text-sm font-medium rounded-t-md border-b-2 -mb-px transition-colors ${
              activeTab === 'bilingual'
                ? 'border-purple-600 text-purple-700 dark:text-purple-300'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Bilingual
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('integrated')}
            className={`px-4 py-2 text-sm font-medium rounded-t-md border-b-2 -mb-px transition-colors ${
              activeTab === 'integrated'
                ? 'border-teal-600 text-teal-700 dark:text-teal-300'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Integrated
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('summary')}
            className={`px-4 py-2 text-sm font-medium rounded-t-md border-b-2 -mb-px transition-colors ${
              activeTab === 'summary'
                ? 'border-indigo-600 text-indigo-700 dark:text-indigo-300'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Summary (combined)
          </button>
        </div>

        {activeTab !== 'summary' && (
          <>
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-2">
              {tabTitle}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
              Teaching hours: Primary {PRIMARY_MINUTES} min/period, Secondary {SECONDARY_MINUTES}{' '}
              min/period. Preps count once per subject column within the same department and
              programme (shared lessons across classes).
            </p>
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm mb-8">
              <table className="min-w-max w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800">
                    <th className="sticky left-0 z-20 px-2 py-2 text-left font-semibold border-b border-r border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-800">
                      No.
                    </th>
                    <th className="px-2 py-2 text-left font-semibold border-b border-slate-200 dark:border-slate-600">
                      Department
                    </th>
                    <th className="px-2 py-2 text-left font-semibold border-b border-slate-200 dark:border-slate-600 min-w-[5rem]">
                      Class
                    </th>
                    <th className="px-2 py-2 text-left font-semibold border-b border-slate-200 dark:border-slate-600">
                      Programme
                    </th>
                    {subjectCols.map((c) => (
                      <th
                        key={c.key}
                        className="px-1 py-2 text-center font-semibold border-b border-slate-200 dark:border-slate-600 whitespace-nowrap"
                      >
                        {c.label} [{c.periodsPerWeek}]
                      </th>
                    ))}
                    <th className="px-1 py-2 border-b border-slate-200 dark:border-slate-600 w-16" />
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6 + subjectCols.length}
                        className="px-3 py-6 text-center text-slate-500 dark:text-slate-400"
                      >
                        No classes yet. Click &quot;Add class&quot; or use Actions → Import classes
                        CSV.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, idx) => (
                      <tr
                        key={row.id}
                        className="odd:bg-white even:bg-slate-50/80 dark:odd:bg-slate-900 dark:even:bg-slate-900/70"
                      >
                        <th className="sticky left-0 z-10 px-2 py-1 text-left font-medium border-t border-r border-slate-200 dark:border-slate-600 bg-inherit">
                          {idx + 1}
                        </th>
                        <td className="border-t border-slate-200 dark:border-slate-700 p-1">
                          <select
                            value={row.department}
                            onChange={(e) =>
                              updateRowField(row.id, 'department', e.target.value)
                            }
                            className={`w-full min-w-[6.5rem] text-[11px] rounded border py-1 px-1 ${
                              row.department === 'primary'
                                ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-700'
                                : 'border-sky-300 bg-sky-50 dark:bg-sky-950/40 dark:border-sky-700'
                            }`}
                          >
                            <option value="primary">Primary</option>
                            <option value="secondary">Secondary</option>
                          </select>
                        </td>
                        <td className="border-t border-slate-200 dark:border-slate-700 p-1">
                          <input
                            type="text"
                            value={row.className}
                            onChange={(e) =>
                              updateRowField(row.id, 'className', e.target.value)
                            }
                            placeholder="e.g. 1B1"
                            className="w-full min-w-[4.5rem] text-[11px] rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 py-1 px-1"
                          />
                        </td>
                        <td className="border-t border-slate-200 dark:border-slate-700 p-1 text-[11px] text-slate-600 dark:text-slate-400">
                          {gridTab === 'bilingual' ? 'Bilingual' : 'Integrated'}
                        </td>
                        {subjectCols.map((c) => {
                          const { match, unspec } = staffOptionsForCell(
                            teachers,
                            row.department,
                            c.key,
                          )
                          const raw = row[c.key] ?? ''
                          const parsed = parseAssignment(raw)
                          const assignedUserId =
                            parsed?.kind === 'user' ? parsed.id : null
                          const idsInGroups = new Set([
                            ...match.map((t) => t.id),
                            ...unspec.map((t) => t.id),
                          ])
                          const orphanId =
                            assignedUserId && !idsInGroups.has(assignedUserId)
                              ? assignedUserId
                              : null
                          const orphanTeacher = orphanId
                            ? teachers.find((t) => t.id === orphanId)
                            : null
                          return (
                            <td
                              key={c.key}
                              className="border-t border-slate-200 dark:border-slate-700 p-0.5 align-middle"
                            >
                              <select
                                value={raw}
                                onChange={(e) =>
                                  updateRowField(row.id, c.key, e.target.value)
                                }
                                className="w-[min(10rem,26vw)] max-w-[180px] text-[11px] leading-tight rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 py-1 px-0.5"
                              >
                                <option value="">—</option>
                                {orphanId && (
                                  <optgroup label="Current assignment (adjust if needed)">
                                    <option value={formatUserAssignment(orphanId)}>
                                      {orphanTeacher
                                        ? `${orphanTeacher.full_name || orphanId}${
                                            orphanTeacher.subject
                                              ? ` (${normalizeUserSubject(orphanTeacher.subject)})`
                                              : ''
                                          }`
                                        : `Staff (${orphanId.slice(0, 8)}…)`}
                                    </option>
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
                                        {t.subject
                                          ? ` (${normalizeUserSubject(t.subject)})`
                                          : ''}
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
                                        {t.subject
                                          ? ` (${normalizeUserSubject(t.subject)})`
                                          : ''}
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                                <optgroup label="Placeholders">
                                  {PLACEHOLDER_PRESETS.map((name) => (
                                    <option key={name} value={formatNameAssignment(name)}>
                                      {name}
                                    </option>
                                  ))}
                                </optgroup>
                              </select>
                            </td>
                          )
                        })}
                        <td className="border-t border-slate-200 dark:border-slate-700 p-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm('Remove this row?')) removeRow(row.id)
                            }}
                            className="text-red-600 hover:underline text-[11px]"
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
          </>
        )}

        {activeTab === 'summary' && (
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-2">
              Teacher hour allocations (Bilingual + Integrated)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Periods and teaching hours sum both programmes. # of preps sums each programme’s
              deduped prep counts (shared lessons per department/subject column). Admin ={' '}
              {CONTRACT_HOURS_WEEK} h − teaching − prep.
            </p>
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="min-w-[640px] w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-left">
                    <th className="px-2 py-2 font-semibold">No.</th>
                    <th className="px-2 py-2 font-semibold">Teacher</th>
                    <th className="px-2 py-2 font-semibold">Subject(s)</th>
                    <th className="px-2 py-2 font-semibold text-right">Periods</th>
                    <th className="px-2 py-2 font-semibold text-right">Teaching hours</th>
                    <th className="px-2 py-2 font-semibold text-right"># of preps</th>
                    <th className="px-2 py-2 font-semibold text-right">Prep time</th>
                    <th className="px-2 py-2 font-semibold text-right">Admin hours</th>
                  </tr>
                </thead>
                <tbody>
                  {combinedSummaries.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-4 text-center text-slate-500">
                        No teacher assignments in Bilingual or Integrated grids yet.
                      </td>
                    </tr>
                  ) : (
                    combinedSummaries.map((s, i) => (
                      <tr
                        key={s.teacherKey}
                        className="border-t border-slate-200 dark:border-slate-700 odd:bg-white even:bg-slate-50/80 dark:odd:bg-slate-900 dark:even:bg-slate-900/70"
                      >
                        <td className="px-2 py-2 tabular-nums">{i + 1}</td>
                        <td className="px-2 py-2">{s.displayName}</td>
                        <td className="px-2 py-2 text-slate-600 dark:text-slate-400">
                          {s.subjectSummary}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">{s.periods}</td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {fmt2(s.teachingHours)}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {fmt1(s.lessonPreps)}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {fmt2(s.prepTimeHours)} h
                        </td>
                        <td
                          className={`px-2 py-2 text-right tabular-nums ${
                            s.adminHours < 0 ? 'text-amber-700 dark:text-amber-400' : ''
                          }`}
                        >
                          {fmt2(s.adminHours)} h
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
