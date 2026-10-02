/** Duration as the YouTube player shows it: m:ss, or h:mm:ss from one hour. */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const ss = s.toString().padStart(2, '0')
  return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

const compact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 })

/** 1 673 747 → "1,7 M", 38 000 → "38 k". Intl keeps a no-break space, so "1,7" and "M" never part. */
export function formatCompactCount(n: number): string {
  return compact.format(n)
}

const longDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

/** "2025-03-12T..." → "12 mars 2025". */
export function formatLongDate(iso: string): string {
  return longDate.format(new Date(iso))
}

/**
 * When a note was last changed, as « Mes notes » says it (Figma 16:820): « il y a 2 h », « hier »,
 * « il y a 3 jours », « la semaine dernière », then the date. `now` is passed for the tests.
 */
export function formatRelativeDay(iso: string, now: Date = new Date()): string {
  const then = new Date(iso)
  const minutes = Math.floor((now.getTime() - then.getTime()) / 60_000)
  if (minutes < 1) return 'à l’instant'
  if (minutes < 60) return `il y a ${minutes} min`
  // Calendar days, not 24-hour slices: last night at 23:00 is « hier » at 08:00.
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((day(now) - day(then)) / 86_400_000)
  if (days === 0) return `il y a ${Math.floor(minutes / 60)} h`
  if (days === 1) return 'hier'
  if (days < 7) return `il y a ${days} jours`
  if (days < 14) return 'la semaine dernière'
  return `le ${formatLongDate(iso)}`
}

/** Chapter timestamp as the design shows it: "04:05", or "1:02:03" from one hour. */
export function formatTimestamp(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(seconds / 3600)
  const mm = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0')
  const ss = (seconds % 60).toString().padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/**
 * A playlist's total length (Figma « Fiche YouTube »: « 48 h au total »): minutes under an hour,
 * hours and minutes under ten hours, whole hours beyond.
 */
export function formatTotalDuration(totalSeconds: number): string {
  const minutes = Math.round(Math.max(0, totalSeconds) / 60)
  if (minutes < 60) return `${minutes} min`
  if (minutes < 600) return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`
  return `${Math.round(minutes / 60)} h`
}
