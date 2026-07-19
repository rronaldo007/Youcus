import { useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FocusPlayer } from '@/features/player/FocusPlayer'
import { VideoSidebar } from '@/features/player/VideoSidebar'
import { reportWatchedSeconds, usePlaylist, useSetProgress } from '@/features/playlists/usePlaylists'

/** Page lecteur focus : lecture, navigation, reprise à la dernière position (CS-19). */
export function FocusPlayerPage() {
  const { id, videoId } = useParams()
  const { data, isLoading, isError } = usePlaylist(id as string)
  const setProgress = useSetProgress(id as string)
  // Fige la position de reprise à la 1re ouverture de chaque vidéo (stable malgré les refetch).
  const resumeRef = useRef<{ key: string; seconds: number } | null>(null)

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

  const resumeKey = `${id}:${video.youtubeId}`
  if (resumeRef.current?.key !== resumeKey) {
    resumeRef.current = { key: resumeKey, seconds: video.watchedSeconds ?? 0 }
  }
  const startSeconds = resumeRef.current.seconds

  const prev = index > 0 ? videos[index - 1] : null
  const next = index < videos.length - 1 ? videos[index + 1] : null
  const navBtn =
    'rounded-card border border-line px-3 py-1.5 text-sm font-medium text-content transition hover:bg-surface-2'

  return (
    <main className="px-6 py-8 sm:px-10 lg:px-16">
      <Link to={`/playlists/${id}`} className="text-sm text-brand-purple hover:underline">
        ← {data.title}
      </Link>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <FocusPlayer
            youtubeId={video.youtubeId}
            title={video.title}
            startSeconds={startSeconds}
            onProgress={(s) => reportWatchedSeconds(id as string, video.id, s)}
            onEnded={() => setProgress.mutate({ videoId: video.id, completed: true })}
          />
          <div className="mt-4 flex items-start justify-between gap-4">
            <h1 className="text-xl font-semibold text-content">
              {video.position + 1}. {video.title}
            </h1>
            <button
              type="button"
              onClick={() => setProgress.mutate({ videoId: video.id, completed: !video.completed })}
              disabled={setProgress.isPending}
              className={`shrink-0 rounded-card border px-3 py-1.5 text-sm font-medium transition disabled:opacity-60 ${
                video.completed
                  ? 'border-success/40 bg-success/10 text-success'
                  : 'border-line text-content hover:bg-surface-2'
              }`}
            >
              {video.completed ? '✓ Vue' : 'Marquer comme vue'}
            </button>
          </div>
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
