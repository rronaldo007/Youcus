import type { Playlist } from '@/types'

/** Carte playlist du design system (cf. Figma PlaylistCard 26:22). */
export function PlaylistCard({ playlist }: { playlist: Playlist }) {
  return (
    <div className="flex flex-col">
      <div className="relative aspect-video w-full overflow-hidden bg-surface-2">
        {playlist.thumbnailUrl && (
          <img src={playlist.thumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-accent-red pl-0.5 text-white">
            ▶
          </span>
        </span>
      </div>
      <div className="flex flex-col gap-1 px-3.5 pb-3.5 pt-3">
        <p className="line-clamp-2 text-[15px] font-semibold text-content">{playlist.title}</p>
        <p className="text-xs text-content-muted">
          {playlist.videoCount} vidéo{playlist.videoCount > 1 ? 's' : ''}
        </p>
      </div>
    </div>
  )
}
