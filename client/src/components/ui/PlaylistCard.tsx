import type { ReactNode } from 'react'
import { Icon } from '@/components/ui/Icon'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { StatusPill } from '@/components/ui/StatusPill'
import type { Playlist } from '@/types'

interface PlaylistCardProps {
  playlist: Playlist
  /** The YouTube channel, under the title. */
  channel?: string | null
  /** The « Actions » menu button, top right of the thumbnail: always visible, never on hover only. */
  actions?: ReactNode
}

/**
 * Figma « Carte de playlist » 5:395: 300 wide in a grid of 4. Survol = ink hairline, no shadow
 * (« gris + ombre délave »). The progress says what is LEFT.
 */
export function PlaylistCard({ playlist, channel, actions }: PlaylistCardProps) {
  // Counted on playable videos only: a deleted video never blocks the end (YC-13).
  const total = playlist.availableCount ?? playlist.videoCount
  const done = Math.min(playlist.completedCount ?? 0, total)
  const finished = total > 0 && done >= total

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-yc-lg border border-line bg-surface transition-colors hover:border-line-strong">
      <div className="relative h-[168px] w-full shrink-0 bg-stage">
        {playlist.thumbnailUrl && <img src={playlist.thumbnailUrl} alt="" className="absolute inset-0 size-full object-cover" />}
        <span aria-hidden="true" className="absolute left-1/2 top-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent text-on-accent">
          <Icon name="play" />
        </span>
        {actions && <div className="absolute right-1.5 top-2">{actions}</div>}
      </div>
      <div className="flex flex-col items-start gap-2 px-4 pb-4 pt-3.5">
        {finished ? (
          <StatusPill tone="mark" dot={false}>
            ★ Terminée
          </StatusPill>
        ) : done > 0 ? (
          <StatusPill tone="accent" dot={false}>
            ● En cours
          </StatusPill>
        ) : (
          <StatusPill tone="outline" dot={false}>
            ○ À voir
          </StatusPill>
        )}
        <p className="w-full truncate font-serif text-title-24 text-content">{playlist.title}</p>
        {channel && <p className="w-full truncate text-small-13 font-medium text-content-muted">{channel}</p>}
        {total > 0 ? (
          <ProgressBar done={done} total={total} label={`Progression de ${playlist.title}`} />
        ) : (
          <p className="font-mono text-mono-12 text-content-muted">Aucune vidéo</p>
        )}
      </div>
    </div>
  )
}

/** The white round « Actions » button the card expects in its `actions` slot. */
export const CARD_ACTIONS_CLASS = 'border border-line bg-surface hover:bg-sunken'
