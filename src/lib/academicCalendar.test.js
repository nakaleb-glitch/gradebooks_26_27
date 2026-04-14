import { describe, expect, it } from 'vitest'
import { getWeekIndexForDate } from './academicCalendar'

describe('getWeekIndexForDate', () => {
  it('returns week 0 before term start', () => {
    expect(getWeekIndexForDate(new Date('2026-08-01T00:00:00'))).toBe(0)
  })

  it('returns week 0 at term start', () => {
    expect(getWeekIndexForDate(new Date('2026-08-17T00:00:00'))).toBe(0)
  })

  it('returns expected week for in-term date', () => {
    expect(getWeekIndexForDate(new Date('2026-09-14T00:00:00'))).toBe(4)
  })

  it('caps to final supported week', () => {
    expect(getWeekIndexForDate(new Date('2027-12-31T00:00:00'))).toBe(39)
  })
})
