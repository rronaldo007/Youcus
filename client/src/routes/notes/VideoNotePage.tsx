import { useCallback, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { buttonClass } from '@/components/ui/buttonStyles'
import { ChapterRow } from '@/components/ui/ChapterRow'
import { Icon } from '@/components/ui/Icon'
import { InlineMessage } from '@/components/ui/InlineMessage'
import { PageState } from '@/components/ui/PageState'
import { FocusPlayer, type FocusPlayerHandle } from '@/features/player/FocusPlayer'
import { PlayerPanel } from '@/features/player/PlayerPanel'
import { useOnline } from '@/features/player/useOnline'
import { useVideo } from '@/features/player/useVideo'
import { reportLibrarySeconds, useSetLibraryProgress } from '@/features/library/useLibrary'
import { usePlaylist } from '@/features/playlists/usePlaylists'
import { NotePageHeader } from '@/features/notes/NotePageHeader'
import type { NoteActions, NoteSummary } from '@/features/notes/NoteEditor'
import { VideoNotes } from '@/features/notes/VideoNotes'
import { formatDuration, formatTimestamp } from '@/lib/format'
import type { VideoChapter } from '@/types'

/** The chapter playing at `seconds`, if the video has chapters. */
function chapterAt(chapters: VideoChapter[], seconds: number): VideoChapter | undefined {
  return chapters.reduce<VideoChapter | undefined>((at, c) => (c.startSeconds <= seconds ? c : at), undefined)
}

/** Which marker is playing: the last one at or before `seconds`, -1 before the first. */
function playingMarker(markers: { seconds: number }[], seconds: number): number {
  return markers.reduce((at, m, i) => (m.seconds <= seconds ? i : at), -1)
}

/**
 * The note page of a video (Figma « Note de vidéo » 22:1225, mobile 35:3232, YC-77), at
 * /notes/videos/:videoId: the note in full, the video beside it, played here. A marker plays the
 * video from its moment. `?playlist=` only says where the video was opened from, for the header:
 * a video has one note whatever the playlist (CS-70).
 */
export function VideoNotePage() {
  const { videoId = '' } = useParams()
  const [params] = useSearchParams()
  const playlistId = params.get('playlist')
  const { data: video, isLoading, isError } = useVideo(videoId)
  const { data: playlist } = usePlaylist(playlistId ?? '', { enabled: playlistId !== null })
  const online = useOnline()
  const queryClient = useQueryClient()
  const setProgress = useSetLibraryProgress()

  const player = useRef<FocusPlayerHandle>(null)
  const [seconds, setSeconds] = useState(0)
  const seek = useCallback((at: number) => player.current?.seekTo(at), [])
  const actions = useRef<NoteActions | null>(null)
  const [summary, setSummary] = useState<NoteSummary | null>(null)
  // The resume position is read once per video: a refetch must not move the player.
  const resume = useRef<{ id: string; seconds: number } | null>(null)

  if (isLoading) return <p className="p-6 text-content-muted">Chargement…</p>
  if (isError || !video) {
    return (
      <main className="mx-auto w-full max-w-[1440px] px-4 pt-8 md:px-8 xl:px-16">
        <PageState kind="error" title="Vidéo introuvable" text="Elle n’est ni dans tes playlists ni dans ta bibliothèque." action={{ label: 'Retour au tableau de bord', to: '/' }} />
      </main>
    )
  }

  if (resume.current?.id !== video.id) resume.current = { id: video.id, seconds: video.progress.watchedSeconds }
  const startSeconds = resume.current.seconds
  const playable = video.status === 'AVAILABLE' && video.embeddable
  const canPlay = playable && online
  // Before the player says where it is, the place to resume is the one stored.
  const at = seconds > 0 ? seconds : startSeconds
  const inPlaylist = playlist?.videos.find((v) => v.id === video.id)
  const eyebrow = [
    inPlaylist ? playlist?.title : 'Vidéo seule',
    inPlaylist && `Vidéo ${inPlaylist.position + 1}`,
    video.channel?.title,
    video.durationSeconds > 0 && formatDuration(video.durationSeconds),
  ]
    .filter(Boolean)
    .join(' · ')
  const markers = summary?.markers ?? []
  const playing = playingMarker(markers, at)
  const chapter = chapterAt(video.chapters, at)
  const pct = video.durationSeconds > 0 ? Math.min(100, (at / video.durationSeconds) * 100) : 0

  let stage
  if (!playable) {
    stage = (
      <PlayerPanel icon="alert" title="Vidéo indisponible" text="YouTube ne la sert plus ici. Ta note et tes repères sont conservés.">
        <a href={`https://www.youtube.com/watch?v=${encodeURIComponent(video.youtubeId)}`} target="_blank" rel="noopener noreferrer" className={buttonClass('ghost')}>
          Voir sur YouTube
        </a>
      </PlayerPanel>
    )
  } else if (!online) {
    stage = <PlayerPanel icon="offline" title="Pas de réseau" text="La vidéo reviendra avec la connexion. Ta note, elle, marche hors ligne." />
  } else {
    stage = (
      <FocusPlayer
        ref={player}
        youtubeId={video.youtubeId}
        title={video.title}
        startSeconds={startSeconds}
        onTimeUpdate={setSeconds}
        onProgress={(s) => reportLibrarySeconds(video.id, s)}
        onEnded={() =>
          setProgress.mutate(
            { videoId: video.id, completed: true },
            { onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['playlists'] }) },
          )
        }
      />
    )
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-app">
      <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-7 px-4 pb-16 pt-5 md:px-8 xl:px-16 xl:pt-8">
        <NotePageHeader
          eyebrow={eyebrow}
          title={video.title}
          summary={summary}
          extra={`${markers.length} repère${markers.length > 1 ? 's' : ''}`}
          onExport={() => actions.current?.exportDocx()}
          action={
            canPlay && (
              <button type="button" onClick={() => seek(at)} className={buttonClass('primary', 'w-full md:w-auto')}>
                Reprendre à {formatTimestamp(at)}
                <Icon name="play" size={24} />
              </button>
            )
          }
        />
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:gap-8">
          {/* On a phone the video comes first, the note under it (Figma 35:3232). */}
          <aside aria-label="Vidéo et repères" className="flex w-full flex-col gap-5 xl:sticky xl:top-6 xl:order-2 xl:w-[380px] xl:shrink-0">
            <div className="dark overflow-hidden rounded-yc-xl border border-white/[0.12] bg-stage">{stage}</div>
            <div className="flex flex-col gap-2">
              <div
                role="progressbar"
                aria-label="Position dans la vidéo"
                aria-valuemin={0}
                aria-valuemax={video.durationSeconds}
                aria-valuenow={Math.floor(at)}
                className="h-1 w-full overflow-hidden rounded-[2px] bg-line"
              >
                <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex justify-between gap-2 font-mono text-mono-12 text-content-muted">
                <span className="truncate">{[formatTimestamp(at), chapter?.title].filter(Boolean).join(' · ')}</span>
                {video.durationSeconds > 0 && <span className="shrink-0">{formatTimestamp(video.durationSeconds)}</span>}
              </div>
            </div>
            {/* The margin of the note carries the markers on a phone (Figma 35:3249 hidden). */}
            <section aria-labelledby="reperes-titre" className="hidden flex-col gap-1 rounded-[20px] border border-line bg-surface px-4 pb-4 pt-5 xl:flex">
              <h2 id="reperes-titre" className="font-serif text-title-24 text-content">
                Repères
              </h2>
              {markers.length ? (
                <ul className="flex flex-col">
                  {markers.map((m, i) => (
                    <li key={`${m.seconds}-${i}`}>
                      <ChapterRow
                        seconds={m.seconds}
                        title={m.text || 'Ligne vide'}
                        state={i < playing ? 'seen' : i === playing ? 'current' : 'todo'}
                        disabled={!canPlay}
                        onClick={() => seek(m.seconds)}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-2 text-body-15 text-content-muted">Aucun repère : M ou « + Repère » en pose un sur la ligne du curseur.</p>
              )}
            </section>
            <div className="hidden xl:block">
              <InlineMessage tone="info">Un clic sur un repère relance la vidéo à cet instant.</InlineMessage>
            </div>
          </aside>
          <div className="min-w-0 flex-1 xl:order-1">
            <VideoNotes
              fullPage
              videoId={video.id}
              player={canPlay ? { seconds: at, seek } : undefined}
              actions={actions}
              onSummary={setSummary}
              context={{ eyebrow, heading: video.title }}
            />
          </div>
        </div>
      </main>
    </div>
  )
}
