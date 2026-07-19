import { Link, useParams } from 'react-router-dom'
import { FocusPlayer } from '@/features/player/FocusPlayer'
import { VideoSidebar } from '@/features/player/VideoSidebar'
import { usePlaylist } from '@/features/playlists/usePlaylists'

/** Page lecteur focus : lit une vidéo, avec navigation entre les vidéos de la playlist (CS-15). */
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

  const videos = data.videos
  const index = videos.findIndex((v) => v.youtubeId === videoId)
  const video = videos[index]
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

  const prev = index > 0 ? videos[index - 1] : null
  const next = index < videos.length - 1 ? videos[index + 1] : null
  const navBtn =
    'rounded-card border border-line px-3 py-1.5 text-sm font-medium text-content transition hover:bg-surface-2'

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <Link to={`/playlists/${id}`} className="text-sm text-brand-purple hover:underline">
        ← {data.title}
      </Link>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <FocusPlayer youtubeId={video.youtubeId} title={video.title} />
          <h1 className="mt-4 text-xl font-semibold text-content">
            {video.position + 1}. {video.title}
          </h1>
          <div className="mt-3 flex items-center justify-between">
            {prev ? (
              <Link to={`/playlists/${id}/watch/${prev.youtubeId}`} className={navBtn}>
                ← Précédent
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link to={`/playlists/${id}/watch/${next.youtubeId}`} className={navBtn}>
                Suivant →
              </Link>
            ) : (
              <span />
            )}
          </div>
        </div>

        <VideoSidebar playlistId={id as string} videos={videos} currentVideoId={video.youtubeId} />
      </div>
    </main>
  )
}
