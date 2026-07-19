import type { Video } from '@/types'

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Carte vidéo du design system (cf. Figma VideoCard 26:12). */
export function VideoCard({ video }: { video: Video }) {
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
