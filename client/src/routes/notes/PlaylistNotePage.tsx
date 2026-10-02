import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { buttonClass } from '@/components/ui/buttonStyles'
import { Icon } from '@/components/ui/Icon'
import { InlineMessage } from '@/components/ui/InlineMessage'
import { PageState } from '@/components/ui/PageState'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { StatusPill } from '@/components/ui/StatusPill'
import { NotePageHeader } from '@/features/notes/NotePageHeader'
import type { NoteActions, NoteSummary } from '@/features/notes/NoteEditor'
import { PlaylistNotes } from '@/features/notes/PlaylistNotes'
import { usePlaylistVideoNotes, videoNoteLabel } from '@/features/notes/usePlaylistVideoNotes'
import { nextVideo } from '@/features/playlists/nextVideo'
import { usePlaylist } from '@/features/playlists/usePlaylists'
import { isPlayable } from '@/lib/availability'
import { formatTotalDuration } from '@/lib/format'
import type { Video } from '@/types'

/** « ✓ Vue », « ● En cours » (the one to resume), « ○ À voir » (Figma 23:1594, Pastille d'état). */
function VideoPill({ video, current }: { video: Video; current: boolean }) {
  if (!isPlayable(video)) return <StatusPill dot={false}>Indisponible</StatusPill>
  if (video.completed) return <StatusPill dot={false}>✓ Vue</StatusPill>
  if (current)
    return (
      <StatusPill tone="accent" dot={false}>
        ● En cours
      </StatusPill>
    )
  return (
    <StatusPill tone="outline" dot={false}>
      ○ À voir
    </StatusPill>
  )
}

/**
 * The note page of a playlist (Figma « Note de playlist » 23:1437, YC-77), at /notes/playlists/:id:
 * the note of the whole course, its progress, and beside it each video with what its note holds.
 * A video opens its own note page.
 */
export function PlaylistNotePage() {
  const { id = '' } = useParams()
  const { data, isLoading, isError } = usePlaylist(id)
  const { data: videoNotes } = usePlaylistVideoNotes(id)
  const actions = useRef<NoteActions | null>(null)
  const [summary, setSummary] = useState<NoteSummary | null>(null)

  if (isLoading) return <p className="p-6 text-content-muted">Chargement…</p>
  if (isError || !data) {
    return (
      <main className="mx-auto w-full max-w-[1440px] px-4 pt-8 md:px-8 xl:px-16">
        <PageState kind="error" title="Playlist introuvable" text="Elle a peut-être été supprimée. Tes autres playlists sont sur le tableau de bord." action={{ label: 'Retour au tableau de bord', to: '/' }} />
      </main>
    )
  }

  const playable = data.videos.filter(isPlayable)
  const done = playable.filter((v) => v.completed).length
  const totalSeconds = data.videos.reduce((sum, v) => sum + (v.durationSeconds || 0), 0)
  const next = nextVideo(data.videos)
  const channel = data.multipleChannels ? 'Plusieurs chaînes' : data.contentChannel?.title
  const eyebrow = [data.title, `${data.videoCount} vidéo${data.videoCount > 1 ? 's' : ''}`, totalSeconds > 0 && formatTotalDuration(totalSeconds), channel]
    .filter(Boolean)
    .join(' · ')
  const notesOf = new Map((videoNotes ?? []).map((n) => [n.videoId, n]))
  const currentId = next && !next.video.completed ? next.video.id : null

  return (
    <div className="min-h-[calc(100vh-64px)] bg-app">
      <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-7 px-4 pb-16 pt-5 md:px-8 xl:px-16 xl:pt-8">
        <NotePageHeader
          eyebrow={eyebrow}
          title="Note de la playlist"
          summary={summary}
          onExport={() => actions.current?.exportDocx()}
          action={
            next && (
              <Link to={`/playlists/${data.id}/watch/${next.video.youtubeId}`} className={buttonClass('primary', 'w-full md:w-auto')}>
                {next.label}
                <Icon name="play" size={24} />
              </Link>
            )
          }
        >
          <div className="w-full md:w-[420px]">
            <ProgressBar done={done} total={playable.length} label={`Progression de ${data.title}`} />
          </div>
        </NotePageHeader>
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:gap-8">
          <div className="min-w-0 flex-1">
            <PlaylistNotes fullPage playlistId={data.id} actions={actions} onSummary={setSummary} context={{ eyebrow, heading: data.title }} />
          </div>
          <aside aria-label="Vidéos de la playlist" className="flex w-full flex-col gap-5 xl:sticky xl:top-6 xl:w-[380px] xl:shrink-0">
            <section aria-labelledby="videos-notes-titre" className="flex flex-col gap-0.5 rounded-[20px] border border-line bg-surface px-4 pb-3 pt-5">
              <h2 id="videos-notes-titre" className="font-serif text-title-24 text-content">
                Vidéos et leurs notes
              </h2>
              <ol className="flex flex-col gap-0.5">
                {data.videos.map((v, i) => {
                  const current = v.id === currentId
                  return (
                    <li key={v.id}>
                      <Link
                        to={`/notes/videos/${v.id}?playlist=${data.id}`}
                        aria-current={current ? 'step' : undefined}
                        className={`flex items-center gap-2.5 rounded-yc-md px-2 py-2.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus ${
                          current ? 'bg-sunken' : 'hover:bg-sunken'
                        }`}
                      >
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className={`truncate ${current ? 'text-label-14 font-semibold text-content' : `text-body-15 ${v.completed ? 'text-content-muted' : 'text-content'}`}`}>
                            {i + 1}. {v.title}
                          </span>
                          <span className="font-mono text-mono-12 text-content-muted">{videoNotes ? videoNoteLabel(notesOf.get(v.id)) : '…'}</span>
                        </span>
                        <VideoPill video={v} current={current} />
                      </Link>
                    </li>
                  )
                })}
              </ol>
            </section>
            <InlineMessage tone="info">La note de playlist garde ce qui vaut pour tout le cours.</InlineMessage>
          </aside>
        </div>
      </main>
    </div>
  )
}
