/**
 * Figma « Barre de progression › Simple » 22:1425, for cards and playlists: « la légende dit ce qui
 * RESTE ». A 6 px track, the red signal for what is done, a mono caption under it.
 */
export function ProgressBar({ done, total, label, unit }: { done: number; total: number; label: string; unit?: string }) {
  const value = total > 0 ? Math.min(done, total) : 0
  const pct = total > 0 ? (value / total) * 100 : 0
  const left = total - value
  return (
    <div className="flex w-full flex-col gap-2">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={value}
        className="h-1.5 w-full overflow-hidden rounded-[3px] bg-sunken"
      >
        <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between gap-2 whitespace-nowrap font-mono text-mono-12 text-content-muted">
        <span>{left === 0 ? 'Terminée' : `${left} restante${left > 1 ? 's' : ''}`}</span>
        <span>
          {value}/{total}
          {unit && ` ${unit}`}
        </span>
      </div>
    </div>
  )
}
