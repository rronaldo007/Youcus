import { Link } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { StatusPill } from '@/components/ui/StatusPill'
import { buttonClass } from '@/components/ui/buttonStyles'

export interface CatalogItem {
  kind: 'playlist' | 'video'
  title: string
  channel: string
  /** « 27 vidéos · français ». */
  detail: string
  /** On the thumbnail: the whole playlist, or the video (« 6 h 07 », « 11:43 »). */
  duration: string
  thumbnailUrl: string
}

/**
 * Figma « Carte de catalogue » 71:89, « À ajouter »: an item of the public catalogue. For a
 * visitor, « + Ajouter à mes playlists » leads to the sign-in.
 */
export function CatalogCard({ item, addTo, thumbClassName = 'aspect-video' }: { item: CatalogItem; addTo: string; thumbClassName?: string }) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-yc-lg border border-line bg-surface">
      {/* 16:9 by default: a real YouTube thumbnail carries text, and a fixed height would crop it. */}
      <div className={`relative shrink-0 bg-stage ${thumbClassName}`}>
        <img src={item.thumbnailUrl} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
        <span aria-hidden="true" className="absolute left-1/2 top-1/2 flex size-[52px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent text-on-accent">
          <Icon name="play" />
        </span>
        <span className="absolute left-3 top-3">
          <StatusPill>{item.kind === 'playlist' ? 'Playlist' : 'Vidéo'}</StatusPill>
        </span>
        <span className="absolute bottom-3 right-2.5 rounded-yc-sm bg-[color:var(--yc-text-on-stage)] px-2 py-[3px] font-mono text-[12px] text-[color:var(--yc-bg-stage)]">
          <span className="sr-only">Durée : </span>
          {item.duration}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 px-[18px] pb-[18px] pt-4">
        <h3 title={item.title} className="line-clamp-2 text-[18px] font-semibold leading-snug text-content">{item.title}</h3>
        <p className="text-label-14 font-normal text-content-muted">{item.channel}</p>
        <p className="font-mono text-[12px] text-content-muted">{item.detail}</p>
        <Link to={addTo} className={buttonClass('secondary', 'mt-auto w-full')}>
          + Ajouter à mes playlists
        </Link>
      </div>
    </article>
  )
}
