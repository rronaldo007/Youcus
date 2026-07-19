/** Squelettes de chargement (cf. Figma SkeletonPlaylistCard 28:2 / SkeletonVideoCard 28:9). */

export function SkeletonPlaylistCard() {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface" aria-hidden="true">
      <div className="aspect-video w-full animate-pulse bg-surface-2" />
      <div className="flex flex-col gap-2 px-3.5 pb-3.5 pt-3">
        <div className="h-4 w-3/4 animate-pulse rounded bg-surface-2" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-surface-2" />
      </div>
    </div>
  )
}

export function SkeletonVideoCard() {
  return (
    <div className="flex flex-col gap-2.5" aria-hidden="true">
      <div className="aspect-video w-full animate-pulse rounded-card bg-surface-2" />
      <div className="h-4 w-4/5 animate-pulse rounded bg-surface-2" />
    </div>
  )
}

/** Grille de squelettes réutilisable. */
export function SkeletonGrid({ count = 6, variant = 'playlist' }: { count?: number; variant?: 'playlist' | 'video' }) {
  const Item = variant === 'playlist' ? SkeletonPlaylistCard : SkeletonVideoCard
  return (
    <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <Item key={i} />
      ))}
    </div>
  )
}
