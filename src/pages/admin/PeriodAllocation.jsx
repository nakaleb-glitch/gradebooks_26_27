import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Papa from 'papaparse'
import Layout from '../../components/Layout'
import { supabase } from '../../lib/supabase'
import {
  CONTRACT_HOURS_WEEK,
  PLACEHOLDER_PRESETS,
  PRIMARY_MINUTES,
  SECONDARY_MINUTES,
  STORAGE_KEY_V2,
  computeTeacherSummaries,
  createEmptyRow,
  createInitialStateV2,
  formatNameAssignment,
  formatUserAssignment,
  normalizePersistedStateV2,
  rowsFromCsvRecords,
  subjectColumns,
} from '../../lib/periodAllocation'

const SAVE_DEBOUNCE_MS = 400

export default function PeriodAllocation() {
  const navigate = useNavigate()
  const saveTimerRef = useRef(null)
  const [activeTab, setActiveTab] = useState(
    /** @type {'bilingual' | 'integrated'} */ ('bilingual'),
  )
  const [data, setData] = useState(() => createInitialStateV2())
  const [hydrated, setHydrated] = useState(false)
  const [teachers, setTeachers] = useState([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: rows } = await supabase
        .from('users')
        .select('id, full_name')
        .in('role', ['teacher', 'admin_teacher'])
        .order('full_name')
      if (!cancelled && rows) setTeachers(rows)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_V2)
      if (raw) {
        const parsed = JSON.parse(raw)
        const normalized = normalizePersistedStateV2(parsed)
        if (normalized) setData(normalized)
      }
    } catch (e) {
      console.warn('period allocation v2 load failed', e)
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(data))
      } catch (e) {
        console.warn('period allocation save failed', e)
      }
    }, SAVE_DEBOUNCE_MS)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [data, hydrated])

  const teacherMap = useMemo(() => {
    const m = new Map()
    for (const t of teachers) m.set(t.id, t)
    return m
  }, [teachers])

  const subjectCols = useMemo(() => subjectColumns(activeTab), [activeTab])
  const rows = data[activeTab].rows

  const summaries = useMemo(
    () => computeTeacherSummaries(rows, activeTab, teacherMap),
    [rows, activeTab, teacherMap],
  )

  const updateRowField = useCallback(
    (rowId, field, value) => {
      setData((prev) => ({
        ...prev,
        [activeTab]: {
          rows: prev[activeTab].rows.map((r) =>
            r.id === rowId ? { ...r, [field]: value } : r,
          ),
        },
      }))
    },
    [activeTab],
  )

  const addRow = useCallback(() => {
    setData((prev) => ({
      ...prev,
      [activeTab]: {
        rows: [...prev[activeTab].rows, createEmptyRow(activeTab)],
      },
    }))
  }, [activeTab])

  const removeRow = useCallback(
    (rowId) => {
      setData((prev) => ({
        ...prev,
        [activeTab]: {
          rows: prev[activeTab].rows.filter((r) => r.id !== rowId),
        },
      }))
    },
    [activeTab],
  )

  const handleResetTab = () => {
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
  }

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'period_allocation_v2.json'
    a.click()
    URL.revokeObjectURL(url)
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
  }

  const handleExportClassesCsv = () => {
    const programme = activeTab === 'bilingual' ? 'Bilingual' : 'Integrated'
    const csvRows = rows.map((r, i) => ({
      No: i + 1,
      Class: r.className,
      Department: r.department === 'primary' ? 'Primary' : 'Secondary',
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
  }

  const handleImportClassesCsv = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
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
            `Replace all ${activeTab} rows with ${imported.length} classes from CSV? Current assignments will be cleared for this tab.`,
          )
        ) {
          e.target.value = ''
          return
        }
        const newRows = imported.map(({ className, department }) => {
          const row = createEmptyRow(activeTab)
          row.className = className
          row.department = department
          return row
        })
        setData((prev) => ({
          ...prev,
          [activeTab]: { rows: newRows },
        }))
        e.target.value = ''
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
    activeTab === 'bilingual' ? 'Bilingual (G1 – G8)' : 'Integrated (G1 – G8) *Standard'

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
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Add row
            </button>
            <button
              type="button"
              onClick={handleExportJson}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
            >
              Download JSON
            </button>
            <label className="cursor-pointer px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600">
              Load JSON
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={handleImportJson}
              />
            </label>
            <button
              type="button"
              onClick={handleExportClassesCsv}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
            >
              Export classes CSV
            </button>
            <label className="cursor-pointer px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600">
              Import classes CSV
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleImportClassesCsv}
              />
            </label>
            <button
              type="button"
              onClick={handleResetTab}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
            >
              Reset tab
            </button>
          </div>
        </div>

        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-1">
          Period allocation
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Assign teachers per class and subject. Period counts in headers are weekly periods for that cell.
          Drafts save in this browser ({STORAGE_KEY_V2}). Admin time assumes a {CONTRACT_HOURS_WEEK} h week.
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
        </div>

        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-2">{tabTitle}</h2>

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
                    colSpan={5 + subjectCols.length}
                    className="px-3 py-6 text-center text-slate-500 dark:text-slate-400"
                  >
                    No classes yet. Click &quot;Add row&quot; or import a CSV (Class, Department).
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
                        onChange={(e) => updateRowField(row.id, 'className', e.target.value)}
                        placeholder="e.g. 1B1"
                        className="w-full min-w-[4.5rem] text-[11px] rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 py-1 px-1"
                      />
                    </td>
                    <td className="border-t border-slate-200 dark:border-slate-700 p-1 text-[11px] text-slate-600 dark:text-slate-400">
                      {activeTab === 'bilingual' ? 'Bilingual' : 'Integrated'}
                    </td>
                    {subjectCols.map((c) => (
                      <td
                        key={c.key}
                        className="border-t border-slate-200 dark:border-slate-700 p-0.5 align-middle"
                      >
                        <select
                          value={row[c.key] ?? ''}
                          onChange={(e) => updateRowField(row.id, c.key, e.target.value)}
                          className="w-[min(10rem,26vw)] max-w-[180px] text-[11px] leading-tight rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 py-1 px-0.5"
                        >
                          <option value="">—</option>
                          <optgroup label="Staff">
                            {teachers.map((t) => (
                              <option key={t.id} value={formatUserAssignment(t.id)}>
                                {t.full_name || t.id}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="Placeholders">
                            {PLACEHOLDER_PRESETS.map((name) => (
                              <option key={name} value={formatNameAssignment(name)}>
                                {name}
                              </option>
                            ))}
                          </optgroup>
                        </select>
                      </td>
                    ))}
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

        <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
          Teacher hour allocations — {activeTab === 'bilingual' ? 'Bilingual' : 'Integrated'}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
          Periods = sum of weekly period counts for each assigned class/subject. Teaching hours: Primary{' '}
          {PRIMARY_MINUTES} min/period, Secondary {SECONDARY_MINUTES} min/period. Preps = periods ÷ 2. Prep time =
          preps × 1.5 h. Admin = {CONTRACT_HOURS_WEEK} − teaching − prep.
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
              {summaries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-4 text-center text-slate-500">
                    No teacher assignments yet for this tab.
                  </td>
                </tr>
              ) : (
                summaries.map((s, i) => (
                  <tr
                    key={s.teacherKey}
                    className="border-t border-slate-200 dark:border-slate-700 odd:bg-white even:bg-slate-50/80 dark:odd:bg-slate-900 dark:even:bg-slate-900/70"
                  >
                    <td className="px-2 py-2 tabular-nums">{i + 1}</td>
                    <td className="px-2 py-2">{s.displayName}</td>
                    <td className="px-2 py-2 text-slate-600 dark:text-slate-400">{s.subjectSummary}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{s.periods}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{fmt2(s.teachingHours)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{fmt1(s.lessonPreps)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{fmt2(s.prepTimeHours)} h</td>
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
    </Layout>
  )
}
