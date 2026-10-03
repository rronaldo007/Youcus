import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { buttonClass } from '@/components/ui/buttonStyles'
import { PageState } from '@/components/ui/PageState'
import { PlayerPanel } from '@/features/player/PlayerPanel'
import { PlayerShell } from '@/features/player/PlayerShell'
import { PlayerTitle } from '@/features/player/PlayerTitle'
import { VideoChaptersOf } from '@/features/player/VideoChapters'
import { ChapterBarOf } from '@/features/player/ChapterBar'
import { useOnline } from '@/features/player/useOnline'
import { FocusPlayer } from '@/features/player/FocusPlayer'
import { EndCard } from '@/features/player/EndCard'
import { StudyControls } from '@/features/player/StudyControls'
import { useStudySession } from '@/features/player/useStudySession'
import { VideoAbout } from '@/features/player/VideoAbout'
import { VideoSidebar } from '@/features/player/VideoSidebar'
import { VideoNotes } from '@/features/notes/VideoNotes'
import { reportWatchedSeconds, usePlaylist, useSetProgress } from '@/features/playlists/usePlaylists'
import { AVAILABILITY_LABEL, isPlayable } from '@/lib/availability'
import { formatDuration } from '@/lib/format'
import { startAt } from '@/features/player/startAt'

/**
 * Page lecteur focus : lecture, navigation, reprise à la dernière position (CS-19), in the new design
 * (YC-76): the stage and its states (unavailable, offline, end of the video), the notebook beside it.
 */
export function FocusPlayerPage() {
  const { id, videoId } = useParams()
  const online = useOnline()
  // « Réessayer » asks the network again: the player is mounted anew once the browser says it is back.
  const [, setAttempt] = useState(0)
  const retry = () => setAttempt((n) => n + 1)
  const { data, isLoading, isError } = usePlaylist(id as string)
  const setProgress = useSetProgress(id as string)
  // Fige la position de reprise à la 1re ouverture de chaque vidéo (stable malgré les refetch).
  const resumeRef = useRef<{ key: string; seconds: number } | null>(null)
  const [params] = useSearchParams()
  const at = startAt(params)
  // Position, study controls and end card, shared with the single video page (YC-61).
  const {
    playerRef,
    currentSeconds,
    setCurrentSeconds,
    seek,
    endedAt,
    setEndedAt,
    noteActions,
    autoplay,
    replay,
    saveSentence,
    rate,
    setRate,
    captions,
    tracks,
    chooseRate,
    chooseCaptions,
    studyPlayer,
    onCaptionTracks,
  } = useStudySession(videoId ?? '')
  // Another ?t= on the video already open (a second line of its note found by the search): go there.
  useEffect(() => {
    if (at !== null) seek(at)
  }, [at, seek])

  if (isLoading) return <p className="p-6 text-content-muted">Chargement…</p>
  if (isError || !data) {
    return (
      <main className="mx-auto w-full max-w-[1440px] px-4 pt-8 md:px-8 xl:px-16">
        <PageState kind="error" title="Playlist introuvable" text="Elle a peut-être été supprimée. Tes autres playlists sont sur le tableau de bord." action={{ label: 'Retour au tableau de bord', to: '/' }} />
      </main>
    )
  }

  const videos = data.videos
  const index = videos.findIndex((v) => v.youtubeId === videoId)
  const video = videos[index]
  if (!video) {
    return (
      <main className="mx-auto w-full max-w-[1440px] px-4 pt-8 md:px-8 xl:px-16">
        <PageState kind="error" title="Vidéo introuvable" text="Elle n’est pas (ou plus) dans cette playlist." action={{ label: `Retour à ${data.title}`, to: `/playlists/${id}` }} />
      </main>
    )
  }

  // A moment asked by the address (?t=, a note found by the search) comes before the resume.
  const resumeKey = `${id}:${video.youtubeId}:${at}`
  if (resumeRef.current?.key !== resumeKey) {
    resumeRef.current = { key: resumeKey, seconds: at ?? video.watchedSeconds ?? 0 }
  }
  const startSeconds = resumeRef.current.seconds

  // Previous and next skip the videos that cannot be played (YC-13).
  const prev = videos.slice(0, index).reverse().find(isPlayable) ?? null
  const next = videos.slice(index + 1).find(isPlayable) ?? null
  const watchTo = (v: { youtubeId: string }) => `/playlists/${id}/watch/${v.youtubeId}`
  const playable = isPlayable(video)
  const after = videos.length - index - 1

  let stage
  if (!playable) {
    stage = (
      <PlayerPanel
        icon="alert"
        title="Vidéo indisponible"
        text={`YouTube ne la sert plus ici (${AVAILABILITY_LABEL[video.availability as Exclude<typeof video.availability, 'AVAILABLE' | undefined>].toLowerCase()}). Ta note et tes repères sont conservés.`}
      >
        {next && (
          <Link to={watchTo(next)} className={buttonClass('primary')}>
            Vidéo suivante →
          </Link>
        )}
        <a href={`https://www.youtube.com/watch?v=${encodeURIComponent(video.youtubeId)}`} target="_blank" rel="noopener noreferrer" className={buttonClass('ghost')}>
          Voir sur YouTube
        </a>
      </PlayerPanel>
    )
  } else if (!online) {
    stage = (
      <PlayerPanel icon="offline" title="Pas de réseau" text="La vidéo reviendra avec la connexion. Ton cahier, lui, marche hors ligne : écris, tout se synchronisera.">
        <button type="button" onClick={retry} className={buttonClass('primary')}>
          Réessayer
        </button>
      </PlayerPanel>
    )
  } else {
    stage = (
      <FocusPlayer
        ref={playerRef}
        youtubeId={video.youtubeId}
        title={video.title}
        startSeconds={startSeconds}
        onProgress={(s) => reportWatchedSeconds(id as string, video.id, s)}
        onEnded={() => {
          setEndedAt(Math.max(currentSeconds, video.durationSeconds))
          setProgress.mutate({ videoId: video.id, completed: true })
        }}
        onPlay={() => setEndedAt(null)}
        autoplay={autoplay}
        below={<ChapterBarOf videoId={video.id} currentSeconds={currentSeconds} onSeek={seek} />}
        overlay={
          endedAt !== null && (
            <EndCard
              context={{
                kind: 'playlist',
                number: video.position + 1,
                total: videos.length,
                next: next && {
                  title: next.title,
                  thumbnailUrl: next.thumbnailUrl,
                  durationSeconds: next.durationSeconds,
                  number: next.position + 1,
                  to: watchTo(next),
                },
                playlistTo: `/playlists/${id}`,
              }}
              seconds={endedAt}
              onSave={saveSentence}
              onReplay={replay}
            />
          )
        }
        onTimeUpdate={setCurrentSeconds}
        rate={rate}
        onRateChange={setRate}
        captions={captions}
        onCaptionTracks={onCaptionTracks}
      />
    )
  }

  return (
    <PlayerShell
      back={{ to: `/playlists/${id}`, label: `Retour à ${data.title}` }}
      title={data.title}
      meta={`Vidéo ${index + 1} / ${videos.length}${after > 0 ? ` · ${after} ensuite` : ''}`}
      list={<VideoSidebar playlistId={id as string} videos={videos} currentVideoId={video.youtubeId} />}
      offline={!online}
      onRetry={retry}
      notebook={
        <VideoNotes
          notebook
          videoId={video.id}
          fullPageTo={`/notes/videos/${video.id}?playlist=${id}`}
          player={{ seconds: currentSeconds, seek }}
          actions={noteActions}
          context={{
            eyebrow: [data.title, `Vidéo ${video.position + 1}`, data.channelTitle, formatDuration(video.durationSeconds)].filter(Boolean).join(' · '),
            heading: video.title,
          }}
        />
      }
    >
      <div className="overflow-hidden rounded-yc-xl border border-white/[0.12] bg-stage">{stage}</div>
      {playable && online && <StudyControls player={studyPlayer} rate={rate} onRate={chooseRate} captions={captions} tracks={tracks} onCaptions={chooseCaptions} />}
      <PlayerTitle
        videoId={video.id}
        number={video.position + 1}
        title={video.title}
        completed={Boolean(video.completed)}
        playable={playable}
        onToggleSeen={() => setProgress.mutate({ videoId: video.id, completed: !video.completed })}
        pending={setProgress.isPending}
        prevTo={prev && watchTo(prev)}
        nextTo={next && watchTo(next)}
      />
      <VideoChaptersOf videoId={video.id} currentSeconds={currentSeconds} onSeek={seek} />
      <VideoAbout videoId={video.id} onSeek={seek} creatorNote={video.creatorNote} playlistChannel={data.channelTitle} />
    </PlayerShell>
  )
}
