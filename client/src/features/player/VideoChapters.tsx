import { useEffect, useRef } from 'react'
import { currentChapterIndex } from '@/lib/chapters'
import { formatTimestamp } from '@/lib/format'
import type { VideoChapter } from '@/types'
import { useVideo } from './useVideo'

/**
 * Chapters parsed from the description (YC-6), under the title of the player (Figma « Lecteur »
 * 11:475, YC-76): a click moves the player, the chapter playing is highlighted and followed, those
 * before it say « vu ». Long lists scroll in place; only the list scrolls, never the page.
 */
export function VideoChapters({
  chapters,
  currentSeconds,
  onSeek,
}: {
  chapters: VideoChapter[]
  currentSeconds: number
  onSeek: (seconds: number) => void
}) {
  const current = currentChapterIndex(chapters, currentSeconds)
  // One pill width per video, so titles line up even when some chapters pass the hour.
  const pillWidth = chapters.some((c) => c.startSeconds >= 3600) ? 'w-[4.5rem]' : 'w-[3.25rem]'
  const listRef = useRef<HTMLOListElement>(null)

  useEffect(() => {
    const list = listRef.current
    const row = list?.children[current] as HTMLElement | undefined
    if (!list || !row || list.scrollHeight <= list.clientHeight) return
    const top = row.offsetTop - list.offsetTop
    if (top < list.scrollTop || top + row.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = Math.max(0, top - list.clientHeight / 3)
    }
  }, [current])

  if (chapters.length === 0) return null

  return (
    <section aria-labelledby="chapitres-titre">
      <h2 id="chapitres-titre" className="sr-only">
        Chapitres ({chapters.length})
      </h2>
      {/* Seven rows show (three in the frame: too few, Ronaldo 03/10, YC-88); the others scroll, and the
          list follows the playback. */}
      <ol ref={listRef} className="relative flex max-h-[320px] flex-col gap-0.5 overflow-y-auto">
        {chapters.map((chapter, i) => {
          const isCurrent = i === current
          const isPast = current >= 0 && i < current
          return (
            <li key={chapter.position}>
              <button
                type="button"
                onClick={() => onSeek(chapter.startSeconds)}
                aria-current={isCurrent ? 'true' : undefined}
                className={`flex min-h-touch w-full items-center gap-3 rounded-yc-md px-2.5 text-left transition-colors hover:bg-sunken ${isCurrent ? 'bg-sunken' : ''}`}
              >
                <span
                  className={`${pillWidth} shrink-0 rounded-[5px] py-[3px] text-center font-mono text-mono-12 font-bold ${
                    isPast ? 'bg-sunken text-content-muted' : 'bg-accent text-on-accent'
                  }`}
                >
                  {formatTimestamp(chapter.startSeconds)}
                </span>
                <span className={`min-w-0 flex-1 truncate text-body-15 ${isCurrent ? 'font-semibold text-content' : isPast ? 'text-content-muted' : 'text-content'}`}>
                  {chapter.title}
                </span>
                {isPast && <span className="shrink-0 font-mono text-mono-12 text-content-muted">✓ vu</span>}
                {isCurrent && <span className="shrink-0 font-mono text-mono-12 text-accent-text">● en cours</span>}
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/** The chapters of a video, read with its card (the same query): nothing while it loads (YC-76). */
export function VideoChaptersOf({ videoId, currentSeconds, onSeek }: { videoId: string; currentSeconds: number; onSeek: (seconds: number) => void }) {
  const { data: video } = useVideo(videoId)
  if (!video) return null
  return <VideoChapters chapters={video.chapters} currentSeconds={currentSeconds} onSeek={onSeek} />
}
