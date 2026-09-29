import { useLayoutEffect, useRef, useState } from 'react'
import { formatCompactCount, formatDuration, formatLongDate } from '@/lib/format'
import { LinkifiedText } from './LinkifiedText'
import { VideoChapters } from './VideoChapters'
import { useVideo } from './useVideo'

const pill = 'rounded-xl bg-surface-2 px-2.5 py-1 text-xs font-medium text-content'

/**
 * "À propos" card under the player (YC-5, Figma « Focus + Description », 150:1073): metadata
 * pills, a link to YouTube, and the description folded to three lines.
 */
export function VideoAbout({
  videoId,
  currentSeconds = 0,
  onSeek,
}: {
  videoId: string
  /** Current player position, to highlight the chapter playing (YC-6). */
  currentSeconds?: number
  /** Moves the player; chapters and description timestamps use it (YC-6). */
  onSeek?: (seconds: number) => void
}) {
  const { data: video } = useVideo(videoId)
  const [expanded, setExpanded] = useState(false)
  const [overflows, setOverflows] = useState(false)
  const descriptionRef = useRef<HTMLParagraphElement>(null)

  // Fold back when another video opens.
  useLayoutEffect(() => setExpanded(false), [videoId])

  // "Afficher plus" only when the three clamped lines really hide something.
  useLayoutEffect(() => {
    const el = descriptionRef.current
    if (!el || expanded) return
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1)
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(el)
    return () => observer?.disconnect()
  }, [video?.description, expanded])

  // The rest of the player works without this card: nothing is shown while loading or on error.
  if (!video) return null

  const snapshot = video.syncedAt ? `Chiffres relevés le ${formatLongDate(video.syncedAt)}` : undefined

  return (
    <section
      aria-label="À propos de la vidéo"
      className="mt-4 flex flex-col gap-3 rounded-xl border border-line bg-surface px-[18px] py-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        {video.viewCount !== null && (
          <span className={pill} title={snapshot}>
            {formatCompactCount(video.viewCount)} de vues
          </span>
        )}
        {video.publishedAt && <span className={pill}>Publiée le {formatLongDate(video.publishedAt)}</span>}
        {video.durationSeconds > 0 && <span className={pill}>{formatDuration(video.durationSeconds)}</span>}
        {video.likeCount !== null && (
          <span className={pill} title={snapshot}>
            {formatCompactCount(video.likeCount)} <span aria-label="j'aime">♥</span>
          </span>
        )}
        <a
          href={`https://www.youtube.com/watch?v=${encodeURIComponent(video.youtubeId)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold text-brand-purple hover:underline"
        >
          Ouvrir sur YouTube ↗
        </a>
      </div>

      {video.description && (
        <div className="flex flex-col items-start gap-3">
          <p
            ref={descriptionRef}
            className={`whitespace-pre-line break-words text-[13px] leading-5 text-content ${
              expanded ? '' : 'line-clamp-3'
            }`}
          >
            <LinkifiedText text={video.description} onSeek={onSeek} maxSeconds={video.durationSeconds || undefined} />
          </p>
          {(overflows || expanded) && (
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
              className="text-[13px] font-semibold text-brand-purple hover:underline"
            >
              {expanded ? 'Afficher moins' : 'Afficher plus'}
            </button>
          )}
        </div>
      )}

      {onSeek && <VideoChapters chapters={video.chapters} currentSeconds={currentSeconds} onSeek={onSeek} />}
    </section>
  )
}
