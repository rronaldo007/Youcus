import { Link } from 'react-router-dom'
import { BUTTON_BASE, buttonClass } from '@/components/ui/buttonStyles'
import { formatCompactCount, formatDuration } from '@/lib/format'
import { useVideo } from '@/features/player/useVideo'

interface PlayerTitleProps {
  videoId: string
  /** « 4. » in a playlist; nothing for a video on its own. */
  number?: number
  title: string
  completed: boolean
  /** False when the video cannot be played: nothing to mark (YC-13). */
  playable: boolean
  onToggleSeen: () => void
  pending: boolean
  prevTo?: string | null
  nextTo?: string | null
}

/**
 * The title line of the player (Figma « Lecteur » 11:475): « 4. useEffect en profondeur », the
 * channel, length and views, and « Précédente · Marquer comme vue · Suivante ». On a phone the arrows
 * keep only their sign (12:462).
 */
export function PlayerTitle({ videoId, number, title, completed, playable, onToggleSeen, pending, prevTo, nextTo }: PlayerTitleProps) {
  const { data: video } = useVideo(videoId)
  const meta = [video?.channel?.title, video && video.durationSeconds > 0 && formatDuration(video.durationSeconds), video?.viewCount != null && `${formatCompactCount(video.viewCount)} vues`]
    .filter(Boolean)
    .join(' · ')
  const arrow = 'w-11 px-0 md:w-auto md:px-6'

  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="break-words font-serif text-title-24 text-content md:text-title-34">
          {number !== undefined && `${number}. `}
          {title}
        </h1>
        {meta && <p className="text-small-13 font-medium text-content-muted">{meta}</p>}
      </div>
      <div className="flex items-center gap-2.5">
        {prevTo ? (
          <Link to={prevTo} aria-label="Vidéo précédente" className={buttonClass('secondary', arrow)}>
            ←<span className="hidden md:inline"> Précédente</span>
          </Link>
        ) : null}
        <button
          type="button"
          onClick={onToggleSeen}
          disabled={pending || !playable}
          aria-pressed={completed}
          className={`${BUTTON_BASE} min-w-0 flex-1 md:flex-none ${completed ? 'bg-accent/40 text-content' : 'bg-accent text-on-accent hover:bg-accent-hover'}`}
        >
          {completed ? '✓ Vue' : '✓ Marquer comme vue'}
        </button>
        {nextTo ? (
          <Link to={nextTo} aria-label="Vidéo suivante" className={buttonClass('secondary', arrow)}>
            <span className="hidden md:inline">Suivante </span>→
          </Link>
        ) : null}
      </div>
    </div>
  )
}
