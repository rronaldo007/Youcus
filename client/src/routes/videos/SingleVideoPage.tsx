import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
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
import { VideoNotes } from '@/features/notes/VideoNotes'
import { reportLibrarySeconds, useLibraryVideo, useSetLibraryProgress } from '@/features/library/useLibrary'
import { AVAILABILITY_LABEL } from '@/lib/availability'
import { formatDuration } from '@/lib/format'
import { startAt } from '@/features/player/startAt'

/**
 * The player of a video kept on its own (YC-61), at /videos/:youtubeId: the same player, study
 * controls, notes and end card as in a playlist, without a playlist around it.
 */
export function SingleVideoPage() {
  const { youtubeId = '' } = useParams()
  const online = useOnline()
  const [, setAttempt] = useState(0)
  const retry = () => setAttempt((n) => n + 1)
  const { data: video, isLoading, isError } = useLibraryVideo(youtubeId)
  const setProgress = useSetLibraryProgress()
  // The resume position is read once per video: a refetch must not move the player.
  const resumeRef = useRef<{ key: string; seconds: number } | null>(null)
  const [params] = useSearchParams()
  const at = startAt(params)
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
  } = useStudySession(youtubeId)
  // Another ?t= on the video already open (a second line of its note found by the search): go there.
  useEffect(() => {
    if (at !== null) seek(at)
  }, [at, seek])

  if (isLoading) return <p className="p-6 text-content-muted">Chargement…</p>
  if (isError || !video) {
    return (
      <main className="mx-auto w-full max-w-[1440px] px-4 pt-8 md:px-8 xl:px-16">
        <PageState kind="error" title="Vidéo introuvable" text="Cette vidéo n’est pas dans ta bibliothèque." action={{ label: 'Retour au tableau de bord', to: '/' }} />
      </main>
    )
  }

  // A moment asked by the address (?t=, a note found by the search) comes before the resume.
  if (resumeRef.current?.key !== `${video.youtubeId}:${at}`) {
    resumeRef.current = { key: `${video.youtubeId}:${at}`, seconds: at ?? video.watchedSeconds }
  }
  const startSeconds = resumeRef.current.seconds
  const playable = video.availability === 'AVAILABLE'

  let stage
  if (video.availability !== 'AVAILABLE') {
    stage = (
      <PlayerPanel
        icon="alert"
        title="Vidéo indisponible"
        text={`YouTube ne la sert plus ici (${AVAILABILITY_LABEL[video.availability].toLowerCase()}). Ta note et tes repères sont conservés.`}
      >
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
        onProgress={(s) => reportLibrarySeconds(video.id, s)}
        onEnded={() => {
          setEndedAt(Math.max(currentSeconds, video.durationSeconds))
          setProgress.mutate({ videoId: video.id, completed: true })
        }}
        onPlay={() => setEndedAt(null)}
        autoplay={autoplay}
        below={<ChapterBarOf videoId={video.id} currentSeconds={currentSeconds} onSeek={seek} />}
        overlay={endedAt !== null && <EndCard context={{ kind: 'single', homeTo: '/' }} seconds={endedAt} onSave={saveSentence} onReplay={replay} />}
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
      back={{ to: '/', label: 'Retour au tableau de bord' }}
      title="Vidéo seule"
      meta={[video.channelTitle, video.durationSeconds > 0 && formatDuration(video.durationSeconds)].filter(Boolean).join(' · ')}
      offline={!online}
      onRetry={retry}
      notebook={
        <VideoNotes
          notebook
          videoId={video.id}
          fullPageTo={`/notes/videos/${video.id}`}
          player={{ seconds: currentSeconds, seek }}
          actions={noteActions}
          context={{
            eyebrow: ['Vidéo seule', video.channelTitle, formatDuration(video.durationSeconds)].filter(Boolean).join(' · '),
            heading: video.title,
          }}
        />
      }
    >
      <div className="overflow-hidden rounded-yc-xl border border-white/[0.12] bg-stage">{stage}</div>
      {playable && online && <StudyControls player={studyPlayer} rate={rate} onRate={chooseRate} captions={captions} tracks={tracks} onCaptions={chooseCaptions} />}
      <PlayerTitle
        videoId={video.id}
        title={video.title}
        completed={video.completed}
        playable={playable}
        onToggleSeen={() => setProgress.mutate({ videoId: video.id, completed: !video.completed })}
        pending={setProgress.isPending}
      />
      <VideoChaptersOf videoId={video.id} currentSeconds={currentSeconds} onSeek={seek} />
      <VideoAbout videoId={video.id} onSeek={seek} />
    </PlayerShell>
  )
}
