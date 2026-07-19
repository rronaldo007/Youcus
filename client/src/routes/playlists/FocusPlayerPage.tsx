import { Link, useParams } from 'react-router-dom'
import { FocusPlayer } from '@/features/player/FocusPlayer'
import { usePlaylist } from '@/features/playlists/usePlaylists'

/** Page lecteur focus : lit une vidéo d'une playlist dans un lecteur épuré. */
export function FocusPlayerPage() {
  const { id, videoId } = useParams()
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

  const video = data.videos.find((v) => v.youtubeId === videoId)
  if (!video) {
    return (
      <div className="p-6">
        <Link to={`/playlists/${id}`} className="text-sm text-brand-purple hover:underline">
          ← {data.title}
        </Link>
        <p role="alert" className="mt-4 text-accent-red">
          Vidéo introuvable dans cette playlist.
        </p>
      </div>
    )
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <Link to={`/playlists/${id}`} className="text-sm text-brand-purple hover:underline">
        ← {data.title}
      </Link>
      <div className="mt-4">
        <FocusPlayer youtubeId={video.youtubeId} title={video.title} />
      </div>
      <h1 className="mt-4 text-xl font-semibold text-content">{video.title}</h1>
    </main>
  )
}
