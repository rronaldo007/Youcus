import { AVAILABILITY_LABEL } from '@/lib/availability'
import { formatDuration } from '@/lib/format'
import type { Video } from '@/types'

/**
 * Carte vidéo du design system (cf. Figma VideoCard 26:12). An unavailable video (YC-13) is
 * dimmed: empty thumbnail, no play button, its reason in place of the duration, no status.
 */
export function VideoCard({ video }: { video: Video }) {
  const availability = video.availability ?? 'AVAILABLE'
  if (availability !== 'AVAILABLE') {
    return (
      <div className="flex flex-col gap-2.5" aria-disabled="true">
        <div className="relative aspect-video w-full overflow-hidden rounded-card bg-surface-2">
          <span className="absolute bottom-2 right-2 rounded bg-surface px-1.5 py-0.5 font-mono text-[11px] font-semibold text-accent-red">
            {AVAILABILITY_LABEL[availability]}
          </span>
        </div>
        <p className="line-clamp-2 text-[15px] leading-tight text-content-muted">
          {video.position + 1}. {video.title}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="relative aspect-video w-full overflow-hidden rounded-card bg-surface-2">
        {video.thumbnailUrl && (
          <img src={video.thumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-accent-red pl-0.5 text-white">
            ▶
          </span>
        </span>
        {video.durationSeconds > 0 && (
          <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-medium text-white">
            {formatDuration(video.durationSeconds)}
          </span>
        )}
        {video.completed && (
          <span className="absolute left-2 top-2 rounded bg-success px-1.5 py-0.5 text-[11px] font-medium text-white">
            ✓ Vue
          </span>
        )}
      </div>
      <p className="line-clamp-2 text-[15px] font-semibold leading-tight text-content">
        {video.position + 1}. {video.title}
      </p>
    </div>
  )
}
