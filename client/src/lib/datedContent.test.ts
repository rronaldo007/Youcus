import { describe, expect, it } from 'vitest'
import { datedContentYears } from './datedContent'

const now = new Date(2026, 9, 1, 12)

describe('datedContentYears (YC-15)', () => {
  it('flags a Science & Technology video published five years ago', () => {
    expect(datedContentYears(new Date(2021, 2, 12).toISOString(), '28', now)).toBe(5)
  })

  it('flags an Education video from exactly three years ago, not the day before its anniversary', () => {
    expect(datedContentYears(new Date(2023, 9, 1).toISOString(), '27', now)).toBe(3)
    expect(datedContentYears(new Date(2023, 9, 2).toISOString(), '27', now)).toBeNull()
  })

  it('ignores the other categories, even very old', () => {
    expect(datedContentYears(new Date(2010, 0, 1).toISOString(), '10', now)).toBeNull()
    expect(datedContentYears(new Date(2010, 0, 1).toISOString(), '24', now)).toBeNull()
  })

  it('needs both a date and a category', () => {
    expect(datedContentYears(null, '28', now)).toBeNull()
    expect(datedContentYears(new Date(2010, 0, 1).toISOString(), null, now)).toBeNull()
    expect(datedContentYears('not a date', '28', now)).toBeNull()
  })
})
