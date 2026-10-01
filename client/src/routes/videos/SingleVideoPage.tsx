import { useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FocusPlayer } from '@/features/player/FocusPlayer'
import { EndCard } from '@/features/player/EndCard'
import { StudyControls } from '@/features/player/StudyControls'
import { useStudySession } from '@/features/player/useStudySession'
import { VideoAbout } from '@/features/player/VideoAbout'
import { VideoNotes } from '@/features/notes/VideoNotes'
import { reportLibrarySeconds, useLibraryVideo, useSetLibraryProgress } from '@/features/library/useLibrary'
import { AVAILABILITY_LABEL } from '@/lib/availability'
import { formatDuration } from '@/lib/format'

/**
 * The player of a video kept on its own (YC-61), at /videos/:youtubeId: the same player, study
 * controls, notes and end card as in a playlist, without a playlist around it.
 */
export function SingleVideoPage() {
  const { youtubeId = '' } = useParams()
  const { data: video, isLoading, isError } = useLibraryVideo(youtubeId)
  const setProgress = useSetLibraryProgress()
  // The resume position is read once per video: a refetch must not move the player.
  const resumeRef = useRef<{ key: string; seconds: number } | null>(null)
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

  const back = (
    <Link to="/" className="text-sm text-brand-purple hover:underline">
      ← Tableau de bord
    </Link>
  )

  if (isLoading) return <p className="p-6 text-content-muted">Chargement…</p>
  if (isError || !video) {
    return (
      <div className="p-6">
        {back}
        <p role="alert" className="mt-4 text-accent-red">
          Cette vidéo n'est pas dans ta bibliothèque.
        </p>
      </div>
    )
  }

  if (resumeRef.current?.key !== video.youtubeId) {
    resumeRef.current = { key: video.youtubeId, seconds: video.watchedSeconds }
  }
  const startSeconds = resumeRef.current.seconds

  return (
    <main className="px-6 py-8 sm:px-10 lg:px-16">
      {back}

      <div className="mx-auto mt-4 max-w-5xl">
        {video.availability !== 'AVAILABLE' ? (
          <p role="alert" className="rounded-card border border-line bg-surface p-6 text-content">
            {AVAILABILITY_LABEL[video.availability]} : YouTube ne la sert plus ici. Ta note, elle, reste ci-dessous.
          </p>
        ) : (
          <>
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
              overlay={
                endedAt !== null && (
                  <EndCard
                    context={{ kind: 'single', homeTo: '/' }}
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
            <StudyControls
              player={studyPlayer}
              rate={rate}
              onRate={chooseRate}
              captions={captions}
              tracks={tracks}
              onCaptions={chooseCaptions}
            />
          </>
        )}

        <div className="mt-4 flex items-start justify-between gap-4">
          <h1 className="text-xl font-semibold text-content">{video.title}</h1>
          <button
            type="button"
            onClick={() => setProgress.mutate({ videoId: video.id, completed: !video.completed })}
            disabled={setProgress.isPending}
            className={`shrink-0 rounded-card border px-3 py-1.5 text-sm font-medium transition disabled:opacity-60 ${
              video.completed ? 'border-success/40 bg-success/10 text-success' : 'border-line text-content hover:bg-surface-2'
            }`}
          >
            {video.completed ? '✓ Vue' : 'Marquer comme vue'}
          </button>
        </div>

        <VideoAbout videoId={video.id} currentSeconds={currentSeconds} onSeek={seek} />

        <VideoNotes
          videoId={video.id}
          player={{ seconds: currentSeconds, seek }}
          actions={noteActions}
          context={{
            eyebrow: ['Vidéo seule', video.channelTitle, formatDuration(video.durationSeconds)].filter(Boolean).join(' · '),
            heading: video.title,
          }}
        />
      </div>
    </main>
  )
}
