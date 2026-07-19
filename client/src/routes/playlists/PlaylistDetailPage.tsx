import { Link, useParams } from 'react-router-dom'
import { usePlaylist } from '@/features/playlists/usePlaylists'

/** Détail d'une playlist : liste ordonnée de ses vidéos. */
export function PlaylistDetailPage() {
  const { id } = useParams()
  const { data, isLoading, isError } = usePlaylist(id as string)

  if (isLoading) return <p className="p-6 text-content-muted">Chargement…</p>
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
    <main className="mx-auto max-w-3xl px-6 py-8">
      <Link to="/" className="text-sm text-brand-purple hover:underline">
        ← Bibliothèque
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-content">{data.title}</h1>
      <p className="text-content-muted">
        {data.videoCount} vidéo{data.videoCount > 1 ? 's' : ''}
      </p>

      <ol className="mt-6 flex flex-col gap-2">
        {data.videos.map((v) => (
          <li key={v.id} className="flex items-center gap-3 rounded-card border border-line bg-surface p-2">
            {v.thumbnailUrl && (
              <img src={v.thumbnailUrl} alt="" className="h-12 w-20 shrink-0 rounded object-cover" />
            )}
            <span className="text-sm text-content">
              {v.position + 1}. {v.title}
            </span>
          </li>
        ))}
      </ol>
    </main>
  )
}
