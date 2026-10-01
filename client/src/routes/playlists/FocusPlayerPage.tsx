import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FocusPlayer, type CaptionTrack, type FocusPlayerHandle } from '@/features/player/FocusPlayer'
import { StudyControls } from '@/features/player/StudyControls'
import { readStudyPreferences, saveStudyPreferences } from '@/features/player/studyPreferences'
import { VideoAbout } from '@/features/player/VideoAbout'
import { VideoSidebar } from '@/features/player/VideoSidebar'
import { VideoNotes } from '@/features/notes/VideoNotes'
import { reportWatchedSeconds, usePlaylist, useSetProgress } from '@/features/playlists/usePlaylists'
import { isPlayable } from '@/lib/availability'
import { formatDuration } from '@/lib/format'

/** Page lecteur focus : lecture, navigation, reprise à la dernière position (CS-19). */
export function FocusPlayerPage() {
  const { id, videoId } = useParams()
  const { data, isLoading, isError } = usePlaylist(id as string)
  const setProgress = useSetProgress(id as string)
  // Fige la position de reprise à la 1re ouverture de chaque vidéo (stable malgré les refetch).
  const resumeRef = useRef<{ key: string; seconds: number } | null>(null)
  // Player position, for the chapter playing (YC-6), and a handle to move the player.
  const playerRef = useRef<FocusPlayerHandle>(null)
  const [currentSeconds, setCurrentSeconds] = useState(0)
  const seek = useCallback((seconds: number) => playerRef.current?.seekTo(seconds), [])
  useEffect(() => setCurrentSeconds(0), [videoId])
  // Study controls (YC-59): the speed and the captions stay from one video and one visit to the next.
  const [rate, setRate] = useState(() => readStudyPreferences().rate)
  const [captions, setCaptions] = useState<string | null>(() => readStudyPreferences().captions)
  useEffect(() => saveStudyPreferences({ rate, captions }), [rate, captions])
  const [tracks, setTracks] = useState<CaptionTrack[] | null>(null)
  const chooseRate = useCallback((next: number) => {
    setRate(next)
    playerRef.current?.setRate(next)
  }, [])
  const chooseCaptions = useCallback((code: string | null) => {
    setCaptions(code)
    playerRef.current?.setCaptions(code)
  }, [])
  const studyPlayer = useMemo(
    () => ({ seekBy: (delta: number) => playerRef.current?.seekBy(delta), togglePlay: () => playerRef.current?.togglePlay() }),
    [],
  )
  const onCaptionTracks = useCallback((list: CaptionTrack[] | null, shown: string | null) => {
    setTracks(list)
    // « On » chosen before the tracks were known: the menu now names the language shown.
    if (shown) setCaptions((c) => (c === '' ? shown : c))
  }, [])

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

  // Previous and next skip the videos that cannot be played (YC-13).
  const prev = videos.slice(0, index).reverse().find(isPlayable) ?? null
  const next = videos.slice(index + 1).find(isPlayable) ?? null
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
            ref={playerRef}
            youtubeId={video.youtubeId}
            title={video.title}
            startSeconds={startSeconds}
            onProgress={(s) => reportWatchedSeconds(id as string, video.id, s)}
            onEnded={() => setProgress.mutate({ videoId: video.id, completed: true })}
            onTimeUpdate={setCurrentSeconds}
            rate={rate}
            onRateChange={setRate}
            captions={captions}
            onCaptionTracks={onCaptionTracks}
          />
          <StudyControls player={studyPlayer} rate={rate} onRate={chooseRate} captions={captions} tracks={tracks} onCaptions={chooseCaptions} />
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

          <VideoAbout
            videoId={video.id}
            currentSeconds={currentSeconds}
            onSeek={seek}
            creatorNote={video.creatorNote}
            playlistChannel={data.channelTitle}
          />

          <VideoNotes
            videoId={video.id}
            player={{ seconds: currentSeconds, seek }}
            context={{
              eyebrow: [data.title, `Vidéo ${video.position + 1}`, data.channelTitle, formatDuration(video.durationSeconds)].filter(Boolean).join(' · '),
              heading: video.title,
            }}
          />
        </div>

        <VideoSidebar playlistId={id as string} videos={videos} currentVideoId={video.youtubeId} />
      </div>
    </main>
  )
}
