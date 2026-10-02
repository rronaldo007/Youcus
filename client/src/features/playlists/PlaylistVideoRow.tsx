import { Link } from 'react-router-dom'
import { StatusPill } from '@/components/ui/StatusPill'
import { AVAILABILITY_LABEL, isPlayable } from '@/lib/availability'
import { formatDuration } from '@/lib/format'
import type { Video } from '@/types'

function State({ video }: { video: Video }) {
  if (video.completed) return <StatusPill dot={false}>✓ Vue</StatusPill>
  if ((video.watchedSeconds ?? 0) > 0) {
    return (
      <StatusPill tone="accent" dot={false}>
        ● En cours
      </StatusPill>
    )
  }
  return (
    <StatusPill tone="outline" dot={false}>
      ○ À voir
    </StatusPill>
  )
}

/**
 * A row of the « Vidéos » list (Figma « Détail de playlist » 16:434): the thumbnail (not on a phone),
 * « n. titre », the duration and the state. A video seen is muted, the one to resume is marked. An
 * unavailable one says why in place of its duration and is not a link: the player could only show an
 * error (YC-13).
 */
export function PlaylistVideoRow({ video, number, to, current }: { video: Video; number: number; to: string; current: boolean }) {
  const playable = isPlayable(video)
  const body = (
    <>
      {playable ? (
        <span className="relative hidden h-[54px] w-24 shrink-0 overflow-hidden rounded-yc-sm border border-white/[0.12] bg-stage md:block">
          {video.thumbnailUrl && <img src={video.thumbnailUrl} alt="" className="absolute inset-0 size-full object-cover" />}
        </span>
      ) : (
        <span aria-hidden="true" className="hidden h-[54px] w-24 shrink-0 rounded-yc-sm bg-sunken md:block" />
      )}
      <span
        className={`min-w-0 flex-1 ${current ? 'text-label-14 font-semibold text-content' : `text-body-15 ${video.completed || !playable ? 'text-content-muted' : 'text-content'}`}`}
      >
        {number}. {video.title}
      </span>
      {playable ? (
        <>
          <span className="w-16 shrink-0 text-right font-mono text-mono-12 text-content-muted">{formatDuration(video.durationSeconds)}</span>
          <State video={video} />
        </>
      ) : (
        <span className="shrink-0 text-right font-mono text-mono-12 text-error">{AVAILABILITY_LABEL[video.availability as Exclude<Video['availability'], 'AVAILABLE' | undefined>]}</span>
      )}
    </>
  )
  const row = `flex w-full items-center gap-3 rounded-card px-3 py-2.5 md:gap-4 ${current ? 'bg-sunken' : ''}`
  return (
    <li>
      {playable ? (
        <Link
          to={to}
          aria-current={current ? 'step' : undefined}
          className={`${row} transition-colors hover:bg-sunken focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus`}
        >
          {body}
        </Link>
      ) : (
        <div aria-disabled="true" className={row}>
          {body}
        </div>
      )}
    </li>
  )
}
