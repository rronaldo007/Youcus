import type { KeyboardEvent, MouseEvent } from 'react'
import { currentChapterIndex } from '@/lib/chapters'
import { formatTimestamp } from '@/lib/format'
import type { VideoChapter } from '@/types'
import { useVideo } from './useVideo'

/** Arrows move by this much, as the YouTube bar does. */
const STEP_SECONDS = 5

interface ChapterBarProps {
  chapters: VideoChapter[]
  durationSeconds: number
  currentSeconds: number
  onSeek: (seconds: number) => void
}

/**
 * Figma « Barre de progression › Chapitres » 22:1425 (YC-88): the video cut where each chapter
 * starts, the playhead following it, a click or the keyboard moving it. Under the video and not on
 * it as the frame « Lecteur » 11:475 draws it: YouTube keeps its own controls there (decision of
 * Ronaldo, 03/10). Nothing for a video without chapters: YouTube's bar is enough.
 */
export function ChapterBar({ chapters, durationSeconds, currentSeconds, onSeek }: ChapterBarProps) {
  const inVideo = chapters.filter((c) => c.startSeconds < durationSeconds)
  if (inVideo.length === 0 || durationSeconds <= 0) return null

  const at = Math.min(Math.max(currentSeconds, 0), durationSeconds)
  const current = currentChapterIndex(inVideo, at)
  const title = current >= 0 ? inVideo[current].title : undefined
  // YouTube's chapters start at 0:00; one that does not leaves a first stretch without a title.
  const starts = inVideo[0].startSeconds > 0 ? [0, ...inVideo.map((c) => c.startSeconds)] : inVideo.map((c) => c.startSeconds)
  const segments = starts.map((start, i) => ({ start, end: starts[i + 1] ?? durationSeconds }))
  const playing = segments.findIndex((s) => at >= s.start && (at < s.end || s.end === durationSeconds))

  const seekIn = (start: number, end: number) => (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const fraction = rect.width > 0 ? Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1) : 0
    onSeek(Math.round(start + fraction * (end - start)))
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next: Record<string, number | undefined> = {
      ArrowRight: at + STEP_SECONDS,
      ArrowUp: at + STEP_SECONDS,
      ArrowLeft: at - STEP_SECONDS,
      ArrowDown: at - STEP_SECONDS,
      Home: 0,
      // From chapter to chapter: the start of the next one, or back to the start of this one.
      PageDown: starts.find((s) => s > at),
      PageUp: [...starts].reverse().find((s) => s < at - 1) ?? 0,
    }
    const to = next[e.key]
    if (!(e.key in next)) return
    e.preventDefault()
    if (to !== undefined) onSeek(Math.min(Math.max(Math.round(to), 0), durationSeconds))
  }

  return (
    <div className="flex flex-col gap-2 px-4">
      <div
        role="slider"
        tabIndex={0}
        aria-label="Position dans la vidéo"
        aria-valuemin={0}
        aria-valuemax={Math.floor(durationSeconds)}
        aria-valuenow={Math.floor(at)}
        aria-valuetext={[formatTimestamp(at), title].filter(Boolean).join(', ')}
        onKeyDown={onKeyDown}
        className="-mb-3.5 flex cursor-pointer gap-[3px] rounded-yc-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {segments.map((s, i) => {
          const fill = Math.min(Math.max((at - s.start) / (s.end - s.start), 0), 1)
          return (
            // 44 px tall to click, a 4 px line to see (the targets of the design system).
            <div
              key={s.start}
              data-chapter-segment=""
              onClick={seekIn(s.start, s.end)}
              style={{ flexGrow: s.end - s.start, flexBasis: 0 }}
              className="relative flex h-11 min-w-[2px] items-center"
            >
              <div className="relative h-1 w-full rounded-[2px] bg-line">
                <div className="absolute inset-y-0 left-0 rounded-[2px] bg-accent" style={{ width: `${fill * 100}%` }} />
                {i === playing && (
                  <span
                    aria-hidden="true"
                    data-playhead=""
                    className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-content"
                    style={{ left: `${fill * 100}%` }}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex justify-between gap-2 font-mono text-mono-12 text-content-muted">
        <span className="truncate">{[formatTimestamp(at), title].filter(Boolean).join(' · ')}</span>
        <span className="shrink-0">{formatTimestamp(durationSeconds)}</span>
      </div>
    </div>
  )
}

/** The bar of a video, read with its card (the same query as its chapters): nothing while it loads. */
export function ChapterBarOf({ videoId, currentSeconds, onSeek }: { videoId: string; currentSeconds: number; onSeek: (seconds: number) => void }) {
  const { data: video } = useVideo(videoId)
  if (!video) return null
  return <ChapterBar chapters={video.chapters} durationSeconds={video.durationSeconds} currentSeconds={currentSeconds} onSeek={onSeek} />
}
