import { AVAILABILITY_LABEL } from '@/lib/availability'
import { formatDuration } from '@/lib/format'
import { libraryVideoState, type LibraryVideoState as State } from '@/features/library/libraryVideoState'
import type { LibraryVideo } from '@/types'

const STATE_LABEL: Record<State, string> = { todo: '○ À voir', progress: '● En cours', seen: '✓ Vue' }

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
 * A video kept on its own (YC-61), Figma « Carte de vidéo » 104:150: the « Vidéo » pill, the
 * duration on the thumbnail, its state, and the progress in minutes. Same frame as the playlist
 * card, in the app's current look until the design port (decision of 30/09).
 */
export function LibraryVideoCard({ video }: { video: LibraryVideo }) {
  const state = libraryVideoState(video)
  const playable = video.availability === 'AVAILABLE'
  const pct = state === 'seen' ? 100 : video.durationSeconds ? Math.min(100, Math.round((video.watchedSeconds / video.durationSeconds) * 100)) : 0
  const position =
    state === 'progress' ? `${formatDuration(video.watchedSeconds)} / ${formatDuration(video.durationSeconds)}` : formatDuration(video.durationSeconds)

  return (
    <div className="flex flex-col" aria-disabled={playable ? undefined : true}>
      <div className="relative aspect-video w-full overflow-hidden bg-surface-2">
        {playable && video.thumbnailUrl && (
          <img src={video.thumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <span className="absolute left-2.5 top-2.5 rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-content-muted">
          Vidéo
        </span>
        {playable ? (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-accent-red pl-0.5 text-white">▶</span>
          </span>
        ) : (
          video.availability !== 'AVAILABLE' && (
            <span className="absolute bottom-2.5 right-2.5 rounded bg-surface px-1.5 py-0.5 font-mono text-[11px] font-semibold text-accent-red">
              {AVAILABILITY_LABEL[video.availability]}
            </span>
          )
        )}
        {playable && video.durationSeconds > 0 && (
          <span className="absolute bottom-2.5 right-2.5 rounded bg-black/80 px-1.5 py-0.5 font-mono text-[11px] text-white">
            {formatDuration(video.durationSeconds)}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-[9px] px-3.5 pb-3.5 pt-3">
        <span
          className={`self-start rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            state === 'progress'
              ? 'bg-brand-purple text-on-purple'
              : state === 'seen'
                ? 'bg-success/15 text-success'
                : 'border border-line text-content'
          }`}
        >
          {STATE_LABEL[state]}
        </span>
        <p className="line-clamp-2 text-[15px] font-semibold text-content">{video.title}</p>
        {video.channelTitle && <p className="text-[13px] text-content-muted">{video.channelTitle}</p>}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-brand-purple" style={{ width: `${pct}%` }} />
        </div>
        <p className="flex justify-between gap-2 font-mono text-xs text-content-muted">
          <span>{legend(video, state)}</span>
          {video.durationSeconds > 0 && <span>{position}</span>}
        </p>
      </div>
    </div>
  )
}
