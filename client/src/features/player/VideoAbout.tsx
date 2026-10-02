import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { buttonClass } from '@/components/ui/buttonStyles'
import { ChannelAvatar } from '@/components/ui/ChannelAvatar'
import { datedContentYears } from '@/lib/datedContent'
import { formatCompactCount, formatDuration, formatLongDate } from '@/lib/format'
import { youtubeCategory } from '@/lib/youtubeCategory'
import clockIcon from './icons/clock-16.svg'
import { LinkifiedText } from './LinkifiedText'
import { useVideo } from './useVideo'

// The icon is a mask painted with currentColor, so it follows the text colour in both themes.
const clockMask = {
  WebkitMaskImage: `url("${clockIcon}")`,
  maskImage: `url("${clockIcon}")`,
  WebkitMaskSize: '100% 100%',
  maskSize: '100% 100%',
} as CSSProperties

function Fact({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <li title={title} className="whitespace-nowrap rounded-full bg-sunken px-2.5 py-[5px] font-mono text-mono-12 text-content">
      {children}
    </li>
  )
}

/**
 * « À propos de la vidéo » under the player (Figma « Lecteur » 11:475, « Fiche YouTube » 24:68): only
 * what the YouTube Data API gave and Youcus keeps. Comments, tags, language, licence and the topics
 * of the frame are not stored, so they are not shown (the rule of YC-75). The chapters left the card
 * for their own list under the title (YC-76).
 */
export function VideoAbout({
  videoId,
  onSeek,
  creatorNote,
  playlistChannel,
}: {
  videoId: string
  /** The playlist author's note on this video (YC-14); hidden when empty. */
  creatorNote?: string | null
  /** Who wrote that note: the channel that owns the playlist. */
  playlistChannel?: string | null
  /** Moves the player; the description's timestamps use it (YC-6). */
  onSeek?: (seconds: number) => void
}) {
  const { data: video } = useVideo(videoId)
  const [expanded, setExpanded] = useState(false)
  const [overflows, setOverflows] = useState(false)
  const descriptionRef = useRef<HTMLParagraphElement>(null)

  // Fold back when another video opens.
  useLayoutEffect(() => setExpanded(false), [videoId])

  // « Afficher toute la description » only when the three clamped lines really hide something.
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
  const datedYears = datedContentYears(video.publishedAt, video.categoryId)
  const category = youtubeCategory(video.categoryId)
  const chapters = video.chapters.length

  return (
    <section aria-label="À propos de la vidéo" className="flex w-full flex-col gap-4 rounded-yc-xl border border-line bg-surface p-4 md:p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-serif text-title-24 text-content">À propos de la vidéo</h2>
        <a
          href={`https://www.youtube.com/watch?v=${encodeURIComponent(video.youtubeId)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass('ghost', 'px-3')}
        >
          Voir sur YouTube
        </a>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:gap-8">
        <div className="flex flex-col gap-4 md:w-[320px] md:shrink-0">
          {video.channel && (
            <p className="flex items-center gap-2.5 text-label-14 font-semibold text-content">
              <ChannelAvatar key={video.channel.avatarUrl} url={video.channel.avatarUrl} />
              {video.channel.title}
            </p>
          )}
          {datedYears !== null && (
            // Figma « Fiche YouTube » (24:68), Alerte ancienne: an Info message, never blocking (YC-15).
            <p className="flex items-center gap-2 text-small-13 font-medium text-content-muted">
              <span aria-hidden="true" className="size-4 shrink-0 bg-current" style={clockMask} />
              Publiée il y a {datedYears} ans : contenu peut-être daté.
            </p>
          )}
          <ul aria-label="En chiffres" className="flex flex-wrap gap-1.5">
            {video.viewCount !== null && <Fact title={snapshot}>{formatCompactCount(video.viewCount)} vues</Fact>}
            {video.likeCount !== null && (
              <Fact title={snapshot}>
                {formatCompactCount(video.likeCount)} <span aria-label="j'aime">likes</span>
              </Fact>
            )}
            {video.publishedAt && <Fact>Publiée le {formatLongDate(video.publishedAt)}</Fact>}
            {video.durationSeconds > 0 && <Fact>{formatDuration(video.durationSeconds)}</Fact>}
            {chapters > 0 && <Fact>{`${chapters} chapitre${chapters > 1 ? 's' : ''}`}</Fact>}
            {video.definition === 'hd' && <Fact>HD</Fact>}
            {video.hasCaptions && <Fact>Sous-titres</Fact>}
          </ul>
          {creatorNote?.trim() && (
            <figure className="rounded-yc-md border-l-2 border-accent bg-sunken px-4 py-3">
              <figcaption className="font-mono text-mono-12 uppercase text-content-muted">
                Note de la playlist
                {playlistChannel && <span className="normal-case"> · {playlistChannel}</span>}
              </figcaption>
              <blockquote className="mt-1 whitespace-pre-line text-body-15 text-content">{creatorNote}</blockquote>
            </figure>
          )}
        </div>

        {video.description && (
          <div className="flex min-w-0 flex-1 flex-col items-start gap-4">
            <p ref={descriptionRef} className={`whitespace-pre-line break-words text-body-15 text-content ${expanded ? '' : 'line-clamp-3'}`}>
              <LinkifiedText text={video.description} onSeek={onSeek} maxSeconds={video.durationSeconds || undefined} />
            </p>
            {(overflows || expanded) && (
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setExpanded((v) => !v)}
                className="text-label-14 font-semibold text-accent-text hover:underline"
              >
                {expanded ? 'Afficher moins' : 'Afficher toute la description'}
              </button>
            )}
          </div>
        )}
      </div>

      {category && (
        <>
          <div aria-hidden="true" className="h-px w-full bg-line" />
          <p className="text-small-13 font-medium text-content-muted">{category}</p>
        </>
      )}
    </section>
  )
}
