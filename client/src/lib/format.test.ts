import { describe, expect, it } from 'vitest'
import { formatCompactCount, formatDuration, formatLongDate, formatRelativeDay, quotaResetTime } from './format'

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

describe('formatRelativeDay (YC-78)', () => {
  const now = new Date(2026, 9, 2, 22, 30)
  const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).toISOString()
  it('says it as « Mes notes » does', () => {
    expect(formatRelativeDay(at(2, 22, 30), now)).toBe('à l’instant')
    expect(formatRelativeDay(at(2, 22, 5), now)).toBe('il y a 25 min')
    expect(formatRelativeDay(at(2, 20, 15), now)).toBe('il y a 2 h')
    // Calendar days: yesterday at 23:59 is « hier », even under 24 hours.
    expect(formatRelativeDay(at(1, 23, 59), now)).toBe('hier')
    expect(formatRelativeDay(new Date(2026, 8, 29, 8).toISOString(), now)).toBe('il y a 3 jours')
    expect(formatRelativeDay(new Date(2026, 8, 24, 8).toISOString(), now)).toBe('la semaine dernière')
    expect(formatRelativeDay(new Date(2026, 8, 1, 10).toISOString(), now)).toBe('le 1 septembre 2026')
  })
})

describe('quotaResetTime (YC-81)', () => {
  it('midnight in Los Angeles, said in Paris time', () => {
    // Both on summer time, then both on winter time: 09:00.
    expect(quotaResetTime(new Date('2026-10-02T21:00:00Z'))).toBe('09:00')
    expect(quotaResetTime(new Date('2026-01-15T12:00:00Z'))).toBe('09:00')
    // The US changed (8 March), Europe not yet (29 March): 08:00.
    expect(quotaResetTime(new Date('2026-03-20T12:00:00Z'))).toBe('08:00')
    // Europe changed back (25 October), the US not yet (1 November): 08:00.
    expect(quotaResetTime(new Date('2026-10-28T12:00:00Z'))).toBe('08:00')
  })

  it('late at night in Paris, still the coming reset, not the one after', () => {
    // 01:30 in Paris on 3 October is 16:30 on 2 October in Los Angeles: the reset is at 09:00 the same morning.
    expect(quotaResetTime(new Date('2026-10-02T23:30:00Z'))).toBe('09:00')
  })
})
