import { Link } from 'react-router-dom'
import { AVAILABILITY_LABEL, isPlayable } from '@/lib/availability'
import type { Video } from '@/types'

/** Liste latérale des vidéos d'une playlist, avec surbrillance de la vidéo en cours. */
export function VideoSidebar({
  playlistId,
  videos,
  currentVideoId,
}: {
  playlistId: string
  videos: Video[]
  currentVideoId: string
}) {
  return (
    <aside className="rounded-card border border-line bg-surface">
      <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-content">
        Vidéos ({videos.length})
      </h2>
      <ol className="max-h-[70vh] overflow-y-auto">
        {videos.map((v) => {
          const current = v.youtubeId === currentVideoId
          if (!isPlayable(v)) {
            // Unavailable (YC-13): dimmed, its reason instead of a link.
            return (
              <li key={v.id}>
                <span aria-disabled="true" className="flex items-center gap-3 border-l-2 border-transparent px-3 py-2 text-sm text-content-muted opacity-70">
                  <span className="w-5 shrink-0 text-right text-xs">{v.position + 1}</span>
                  <span className="h-9 w-16 shrink-0 rounded bg-surface-2" />
                  <span className="line-clamp-2">{v.title}</span>
                  <span className="ml-auto shrink-0 font-mono text-[11px] font-semibold text-accent-red">
                    {AVAILABILITY_LABEL[v.availability as keyof typeof AVAILABILITY_LABEL]}
                  </span>
                </span>
              </li>
            )
          }
          return (
            <li key={v.id}>
              <Link
                to={`/playlists/${playlistId}/watch/${v.youtubeId}`}
                aria-current={current ? 'true' : undefined}
                className={`flex items-center gap-3 border-l-2 px-3 py-2 text-sm transition ${
                  current
                    ? 'border-brand-purple bg-surface-2 font-medium text-content'
                    : 'border-transparent text-content-muted hover:bg-surface-2'
                }`}
              >
                <span className="w-5 shrink-0 text-right text-xs text-content-muted">{v.position + 1}</span>
                {v.thumbnailUrl && (
                  <img src={v.thumbnailUrl} alt="" className="h-9 w-16 shrink-0 rounded object-cover" />
                )}
                <span className="line-clamp-2">{v.title}</span>
                {v.completed && (
                  <span className="ml-auto shrink-0 text-success" aria-label="Vue" title="Vue">
                    ✓
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ol>
    </aside>
  )
}
