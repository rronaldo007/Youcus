import { useEffect, useRef } from 'react'
import { currentChapterIndex } from '@/lib/chapters'
import { formatTimestamp } from '@/lib/format'
import type { VideoChapter } from '@/types'

/**
 * Chapters parsed from the description (YC-6, Figma « Focus + Description », 150:2818): a click
 * moves the player, and the chapter playing is highlighted and follows the playback.
 * Long lists scroll inside the card; only the list scrolls to the current chapter, never the page.
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
    <div className="flex flex-col gap-3">
      <div className="h-px w-full bg-line" />
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-bold text-content">Chapitres</h2>
        <span className="text-xs text-content-muted">{chapters.length} · tirés de la description</span>
      </div>
      <ol ref={listRef} className="relative flex max-h-80 flex-col gap-0.5 overflow-y-auto">
        {chapters.map((chapter, i) => {
          const isCurrent = i === current
          const isPast = current >= 0 && i < current
          return (
            <li key={chapter.position}>
              <button
                type="button"
                onClick={() => onSeek(chapter.startSeconds)}
                aria-current={isCurrent ? 'true' : undefined}
                className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition hover:bg-surface-2 ${
                  isCurrent ? 'bg-surface-2' : ''
                }`}
              >
                <span className={`${pillWidth} shrink-0 rounded-[5px] bg-brand-purple py-[3px] text-center font-mono text-xs font-bold text-on-purple`}>
                  {formatTimestamp(chapter.startSeconds)}
                </span>
                <span
                  className={`min-w-0 text-[13px] ${
                    isCurrent ? 'font-semibold text-content' : isPast ? 'text-content-muted' : 'text-content'
                  }`}
                >
                  {chapter.title}
                </span>
                {isCurrent && (
                  <span className="shrink-0 text-[11px] font-semibold text-brand-purple">● en cours</span>
                )}
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
