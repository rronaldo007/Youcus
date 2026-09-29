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

/** Chapter timestamp as the design shows it: "04:05", or "1:02:03" from one hour. */
export function formatTimestamp(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(seconds / 3600)
  const mm = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0')
  const ss = (seconds % 60).toString().padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}
