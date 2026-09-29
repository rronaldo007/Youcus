import { describe, expect, it } from 'vitest'
import { formatCompactCount, formatDuration, formatLongDate } from './format'

// Intl separates the number and its unit with a no-break space; compare on plain spaces.
const plain = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ')

describe('format', () => {
  it('formats durations like the YouTube player, hours included', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(872)).toBe('14:32')
    expect(formatDuration(3723)).toBe('1:02:03')
    // The 47-hour course of the real playlist: no more "2849:21".
    expect(formatDuration(170961)).toBe('47:29:21')
  })

  it('formats counters in French compact notation', () => {
    expect(plain(formatCompactCount(1673747))).toBe('1,7 M')
    expect(plain(formatCompactCount(38000))).toBe('38 k')
    expect(plain(formatCompactCount(950))).toBe('950')
  })

  it('keeps the number and its unit together (no-break space)', () => {
    expect(formatCompactCount(38000)).not.toContain(' ')
  })

  it('formats a publication date in long French form', () => {
    expect(formatLongDate('2025-03-12T12:00:00Z')).toBe('12 mars 2025')
  })
})
