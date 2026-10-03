import { describe, expect, it } from 'vitest'
import { formatHoursMinutes, formatMinutes } from './statsFormat'

// The durations of Statistiques (YC-79). The no-break spaces are tested as such: the screen tests
// normalise every space, so they would not see « 5 » and « h » part at the end of a line.
const NB = ' '

describe('the durations of Statistiques (YC-79)', () => {
  it('the study time: hours and minutes, never parted', () => {
    expect(formatHoursMinutes(2400)).toBe(`0${NB}h${NB}40`)
    expect(formatHoursMinutes(15_120)).toBe(`4${NB}h${NB}12`)
    expect(formatHoursMinutes(59)).toBe(`0${NB}h${NB}00`)
  })

  it('a goal, or what is left: minutes under an hour, whole hours alone', () => {
    expect(formatMinutes(48)).toBe(`48${NB}min`)
    expect(formatMinutes(300)).toBe(`5${NB}h`)
    expect(formatMinutes(260)).toBe(`4${NB}h${NB}20`)
    // What is left is rounded up: 47.2 minutes to go is still 48.
    expect(formatMinutes(47.2)).toBe(`48${NB}min`)
  })
})
