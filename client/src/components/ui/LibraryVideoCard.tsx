import { Icon } from '@/components/ui/Icon'
import { StatusPill, type PillTone } from '@/components/ui/StatusPill'
import { AVAILABILITY_LABEL } from '@/lib/availability'
import { formatDuration } from '@/lib/format'
import { libraryVideoState, type LibraryVideoState as State } from '@/features/library/libraryVideoState'
import type { LibraryVideo } from '@/types'

const STATE: Record<State, { label: string; tone: PillTone }> = {
  todo: { label: '○ À voir', tone: 'outline' },
  progress: { label: '● En cours', tone: 'accent' },
  seen: { label: '✓ Vue', tone: 'success' },
}

const seenDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''

/** What the legend says is left, in minutes (Figma « Barre de progression »: what REMAINS). */
function legend(video: LibraryVideo, state: State): string {
  if (state === 'seen') return video.completedAt ? `Vue le ${seenDate(video.completedAt)}` : 'Vue'
  if (state === 'todo') return 'Pas encore commencée'
  const left = Math.max(1, Math.ceil((video.durationSeconds - video.watchedSeconds) / 60))
  return `${left} min restante${left > 1 ? 's' : ''}`
}

/**
 * Figma « Carte de vidéo » 104:150, a video kept on its own (YC-61): « même gabarit que la carte de
 * playlist ; titre en Hanken (une phrase, pas un nom), pastille Vidéo, durée sur la miniature,
 * progression en minutes ». The « Actions » menu is laid over it by the grid, like the playlists'.
 */
export function LibraryVideoCard({ video }: { video: LibraryVideo }) {
  const state = libraryVideoState(video)
  const playable = video.availability === 'AVAILABLE'
  const pct = state === 'seen' ? 100 : video.durationSeconds ? Math.min(100, (video.watchedSeconds / video.durationSeconds) * 100) : 0
  const position =
    state === 'progress' ? `${formatDuration(video.watchedSeconds)} / ${formatDuration(video.durationSeconds)}` : formatDuration(video.durationSeconds)

  return (
    <div
      aria-disabled={playable ? undefined : true}
      className="flex h-full flex-col overflow-hidden rounded-yc-lg border border-line bg-surface transition-colors hover:border-line-strong"
    >
      <div className="relative h-[168px] w-full shrink-0 bg-stage">
        {playable && video.thumbnailUrl && <img src={video.thumbnailUrl} alt="" className="absolute inset-0 size-full object-cover" />}
        <span className="absolute left-3 top-3">
          <StatusPill>Vidéo</StatusPill>
        </span>
        {playable ? (
          <span aria-hidden="true" className="absolute left-1/2 top-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent text-on-accent">
            <Icon name="play" />
          </span>
        ) : (
          video.availability !== 'AVAILABLE' && (
            <span className="absolute bottom-3 right-3">
              <StatusPill tone="error" dot={false}>
                {AVAILABILITY_LABEL[video.availability]}
              </StatusPill>
            </span>
          )
        )}
        {playable && video.durationSeconds > 0 && (
          <span className="absolute bottom-3 right-3 rounded-yc-sm bg-[color:var(--yc-text-on-stage)] px-2 py-[3px] font-mono text-[12px] text-[color:var(--yc-bg-stage)]">
            {formatDuration(video.durationSeconds)}
          </span>
        )}
      </div>
      <div className="flex flex-col items-start gap-2 px-4 pb-4 pt-3.5">
        <StatusPill tone={STATE[state].tone} dot={false}>
          {STATE[state].label}
        </StatusPill>
        <p className="line-clamp-2 w-full text-[17px] font-semibold leading-[1.3] text-content">{video.title}</p>
        {video.channelTitle && <p className="w-full truncate text-small-13 font-medium text-content-muted">{video.channelTitle}</p>}
        <div className="flex w-full flex-col gap-2">
          <div aria-hidden="true" className="h-1.5 w-full overflow-hidden rounded-[3px] bg-sunken">
            <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
          <p className="flex justify-between gap-2 whitespace-nowrap font-mono text-mono-12 text-content-muted">
            <span>{legend(video, state)}</span>
            {video.durationSeconds > 0 && <span>{position}</span>}
          </p>
        </div>
      </div>
    </div>
  )
}
