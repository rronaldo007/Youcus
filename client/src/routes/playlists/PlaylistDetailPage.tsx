import { Link, useParams } from 'react-router-dom'
import { VideoCard } from '@/components/ui/VideoCard'
import { SkeletonGrid } from '@/components/ui/Skeletons'
import { usePlaylist, useRefreshPlaylist } from '@/features/playlists/usePlaylists'

/** Détail d'une playlist : grille de vidéos (design system), lien vers le lecteur focus. */
export function PlaylistDetailPage() {
  const { id } = useParams()
  const { data, isLoading, isError } = usePlaylist(id as string)
  const refresh = useRefreshPlaylist(id as string)

  if (isLoading) {
    return (
      <main className="px-6 py-8 sm:px-10 lg:px-16">
        <SkeletonGrid variant="video" />
      </main>
    )
  }
  if (isError || !data) {
    return (
      <div className="p-6">
        <Link to="/" className="text-sm text-brand-purple hover:underline">
          ← Bibliothèque
        </Link>
        <p role="alert" className="mt-4 text-accent-red">
          Playlist introuvable.
        </p>
      </div>
    )
  }

  return (
    <main className="px-6 py-8 sm:px-10 lg:px-16">
      <Link to="/" className="text-sm text-brand-purple hover:underline">
        ← Bibliothèque
      </Link>

      <div className="mt-4 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-content">{data.title}</h1>
        <button
          type="button"
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending}
          className="shrink-0 rounded-card border border-line px-3 py-1.5 text-sm font-medium text-content transition hover:bg-surface-2 disabled:opacity-60"
        >
          {refresh.isPending ? 'Rafraîchissement…' : 'Rafraîchir'}
        </button>
      </div>
      <p className="text-content-muted">
        {data.videoCount} vidéo{data.videoCount > 1 ? 's' : ''}
      </p>
      {refresh.isError && (
        <p role="alert" className="mt-1 text-sm text-accent-red">
          {(refresh.error as Error).message}
        </p>
      )}

      <ul className="mt-6 grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
        {data.videos.map((v) => (
          <li key={v.id}>
            <Link to={`/playlists/${id}/watch/${v.youtubeId}`} className="block transition hover:opacity-95">
              <VideoCard video={v} />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
