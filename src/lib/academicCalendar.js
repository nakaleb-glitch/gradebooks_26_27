const ACADEMIC_YEAR_START = new Date('2026-08-17T00:00:00')
const ACADEMIC_WEEK_COUNT = 40

export const getWeekIndexForDate = (date = new Date()) => {
  const targetDate = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(targetDate.getTime())) return 0
  if (targetDate < ACADEMIC_YEAR_START) return 0

  const diffMs = targetDate.getTime() - ACADEMIC_YEAR_START.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const weekIndex = Math.floor(diffDays / 7)
  return Math.max(0, Math.min(ACADEMIC_WEEK_COUNT - 1, weekIndex))
}

export const getCurrentWeekIndexWithOverride = (allWeeksLength) => {
  const maxWeeks = Number(allWeeksLength) || ACADEMIC_WEEK_COUNT
  const override = sessionStorage.getItem('debug_week_override')
  if (override !== null) {
    const idx = Number(override)
    if (idx >= 0 && idx < maxWeeks) return idx
  }
  return Math.max(0, Math.min(maxWeeks - 1, getWeekIndexForDate(new Date())))
}
