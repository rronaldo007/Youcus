/**
 * « 4 h 12 », « 0 h 38 »: the study time as Figma « Statistiques » writes it (YC-79). No-break spaces:
 * « 5 » and « h » never part at the end of a line (seen at 390 px).
 */
const NBSP = '\u00a0'

export function formatHoursMinutes(seconds: number): string {
  const minutes = Math.floor(Math.max(0, seconds) / 60)
  return `${Math.floor(minutes / 60)}${NBSP}h${NBSP}${String(minutes % 60).padStart(2, '0')}`
}

/** « 48 min », « 5 h », « 1 h 30 »: a goal, or what is left of it. */
export function formatMinutes(total: number): string {
  const minutes = Math.max(0, Math.ceil(total))
  if (minutes < 60) return `${minutes}${NBSP}min`
  const rest = minutes % 60
  return rest === 0 ? `${minutes / 60}${NBSP}h` : `${Math.floor(minutes / 60)}${NBSP}h${NBSP}${String(rest).padStart(2, '0')}`
}

const longDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
const shortDay = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' })

/** « samedi 3 octobre », for the screen readers of the chart. */
export function formatLongDay(iso: string): string {
  return longDay.format(new Date(`${iso}T00:00:00Z`))
}

/** « 3 octobre ». */
export function formatShortDay(iso: string): string {
  return shortDay.format(new Date(`${iso}T00:00:00Z`))
}
