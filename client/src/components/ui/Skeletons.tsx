/**
 * Figma « Squelette » 96:140: « Remplace le contenu pendant le chargement (jamais un écran blanc,
 * jamais un spinner seul). Pulsation d'opacité 1 → 0,55, 1,2 s, aucune si prefers-reduced-motion. »
 */

export type SkeletonKind = 'playlist-card' | 'video-row' | 'tile' | 'paragraph' | 'player'

/** One bone of a skeleton. */
function Bone({ className }: { className: string }) {
  return <div className={`animate-yc-pulse bg-sunken motion-reduce:animate-none ${className}`} />
}

export function Skeleton({ kind }: { kind: SkeletonKind }) {
  switch (kind) {
    case 'playlist-card':
      return (
        <div aria-hidden="true" className="flex flex-col gap-3 overflow-hidden rounded-yc-lg border border-line bg-surface px-[18px] pb-[18px]">
          <Bone className="h-[168px] w-full" />
          <div className="h-0.5" />
          <Bone className="h-6 w-[90px] rounded-full" />
          <Bone className="h-5 w-2/3 rounded-yc-sm" />
          <Bone className="h-3.5 w-1/2 rounded-yc-sm" />
          <Bone className="h-1.5 w-full rounded-[3px]" />
        </div>
      )
    case 'video-row':
      return (
        <div aria-hidden="true" className="flex items-center gap-4 py-2.5">
          <Bone className="h-[54px] w-24 shrink-0 rounded-lg" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Bone className="h-4 w-4/5 max-w-[320px] rounded-yc-sm" />
            <Bone className="h-3 w-[120px] max-w-full rounded-yc-sm" />
          </div>
          <Bone className="hidden h-3.5 w-12 shrink-0 rounded-yc-sm sm:block" />
          <Bone className="h-7 w-[72px] shrink-0 rounded-full" />
        </div>
      )
    case 'tile':
      return (
        <div aria-hidden="true" className="flex flex-col gap-2.5 rounded-yc-lg border border-line bg-surface px-6 py-5">
          <Bone className="h-3 w-20 rounded-yc-sm" />
          <Bone className="h-11 w-[110px] rounded-lg" />
          <Bone className="h-3 w-[150px] max-w-full rounded-yc-sm" />
        </div>
      )
    case 'paragraph':
      return (
        <div aria-hidden="true" className="flex w-full max-w-[520px] flex-col gap-2.5">
          <Bone className="h-3.5 w-full rounded-yc-sm" />
          <Bone className="h-3.5 w-[92%] rounded-yc-sm" />
          <Bone className="h-3.5 w-[69%] rounded-yc-sm" />
        </div>
      )
    case 'player':
      return (
        <div aria-hidden="true" className="relative aspect-video w-full overflow-hidden rounded-yc-lg">
          <Bone className="absolute inset-0" />
          <span className="absolute left-1/2 top-1/2 size-[52px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-line" />
        </div>
      )
  }
}

/** Kept for the pages not moved yet: the design's playlist card skeleton. */
export function SkeletonPlaylistCard() {
  return <Skeleton kind="playlist-card" />
}

export function SkeletonVideoCard() {
  return (
    <div className="flex flex-col gap-2.5" aria-hidden="true">
      <Bone className="aspect-video w-full rounded-yc-lg" />
      <Bone className="h-4 w-4/5 rounded-yc-sm" />
    </div>
  )
}

/** Grille de squelettes réutilisable. */
export function SkeletonGrid({ count = 6, variant = 'playlist' }: { count?: number; variant?: 'playlist' | 'video' }) {
  const Item = variant === 'playlist' ? SkeletonPlaylistCard : SkeletonVideoCard
  return (
    <div aria-busy="true" aria-label="Chargement" className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <Item key={i} />
      ))}
    </div>
  )
}
