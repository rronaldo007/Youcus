import { Link, useParams } from 'react-router-dom'
import { SOON } from '@/components/layout/navItems'
import { BUTTON_BASE, buttonClass } from '@/components/ui/buttonStyles'
import { Icon } from '@/components/ui/Icon'
import { InlineMessage } from '@/components/ui/InlineMessage'
import { PageState } from '@/components/ui/PageState'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Skeleton } from '@/components/ui/Skeletons'
import { nextVideo } from '@/features/playlists/nextVideo'
import { PlaylistAbout } from '@/features/playlists/PlaylistAbout'
import { PlaylistNotePreview } from '@/features/playlists/PlaylistNotePreview'
import { PlaylistVideoRow } from '@/features/playlists/PlaylistVideoRow'
import { usePlaylist, useRefreshPlaylist } from '@/features/playlists/usePlaylists'
import { isPlayable } from '@/lib/availability'
import { formatTotalDuration } from '@/lib/format'

const BACK = 'font-mono text-mono-12 uppercase text-content-muted hover:text-content'

/**
 * Détail d'une playlist (Figma « Détail de playlist » 16:434, 16:544, 16:642 ; sombre 45:6423). The
 * playlist's note is a preview; « Ouvrir dans le cahier » opens it in the expanded view (Ronaldo,
 * 02/10), in the right column on a computer and under the list elsewhere.
 */
export function PlaylistDetailPage() {
  const { id } = useParams()
  const { data, isLoading, isError } = usePlaylist(id as string)
  const refresh = useRefreshPlaylist(id as string)

  if (isLoading) {
    return (
      <main aria-busy="true" aria-label="Chargement" className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-4 pb-16 pt-8 md:px-8 xl:px-16">
        <Skeleton kind="player" />
        <Skeleton kind="video-row" />
        <Skeleton kind="video-row" />
      </main>
    )
  }
  if (isError || !data) {
    return (
      <main className="mx-auto w-full max-w-[1440px] px-4 pt-8 md:px-8 xl:px-16">
        <Link to="/" className={BACK}>
          ← Mes playlists
        </Link>
        <PageState kind="error" title="Playlist introuvable" text="Elle a peut-être été supprimée. Tes autres playlists sont sur le tableau de bord." action={{ label: 'Retour au tableau de bord', to: '/' }} />
      </main>
    )
  }

  const playable = data.videos.filter(isPlayable)
  const done = playable.filter((v) => v.completed).length
  const totalSeconds = data.videos.reduce((sum, v) => sum + (v.durationSeconds || 0), 0)
  const next = nextVideo(data.videos)
  const channel = data.multipleChannels ? 'Plusieurs chaînes' : data.contentChannel?.title
  const overline = [channel, `${data.videoCount} vidéo${data.videoCount > 1 ? 's' : ''}`, totalSeconds > 0 && formatTotalDuration(totalSeconds)].filter(Boolean).join(' · ')

  return (
    <div className="min-h-[calc(100vh-64px)] bg-app">
      <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 pb-16 pt-6 md:gap-8 md:px-8 md:pt-8 xl:px-16">
        <Link to="/" className={`${BACK} self-start`}>
          ← Mes playlists
        </Link>

        <header className="flex flex-col gap-6 xl:flex-row xl:items-center xl:gap-8">
          <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-yc-lg border border-white/[0.12] bg-stage xl:aspect-auto xl:h-[168px] xl:w-[300px]">
            {data.thumbnailUrl && <img src={data.thumbnailUrl} alt="" className="absolute inset-0 size-full object-cover" />}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <p className="font-mono text-mono-12 uppercase text-content-muted">{overline}</p>
            <h1 className="break-words font-serif text-title-34 text-content md:text-title-56">{data.title}</h1>
            <div className="w-full xl:w-[460px]">
              <ProgressBar done={done} total={playable.length} unit="vues" label={`Progression de ${data.title}`} />
            </div>
            <div className="flex flex-col gap-2.5 md:flex-row md:flex-wrap">
              {next && (
                <Link to={`/playlists/${data.id}/watch/${next.video.youtubeId}`} className={buttonClass('primary', 'w-full md:w-auto')}>
                  {next.label}
                  <Icon name="play" size={24} />
                </Link>
              )}
              <button type="button" onClick={() => refresh.mutate()} disabled={refresh.isPending} className={buttonClass('secondary', 'w-full md:w-auto')}>
                {refresh.isPending ? 'Synchronisation…' : 'Synchroniser'}
              </button>
              {/* Per-playlist export does not exist yet (YC-86): greyed like the tabs without a page. */}
              <span aria-disabled="true" title={SOON} className={`${BUTTON_BASE} w-full cursor-not-allowed border border-line-strong text-content opacity-45 md:w-auto`}>
                Exporter les notes · Bientôt
              </span>
            </div>
            {refresh.isError && <InlineMessage tone="error">{(refresh.error as Error).message}</InlineMessage>}
          </div>
        </header>

        <PlaylistAbout playlist={data} />

        <div className="flex flex-col gap-6 md:gap-8 xl:flex-row xl:items-start">
          <section aria-labelledby="videos-titre" className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-yc-xl border border-line bg-surface p-2 md:p-3">
            <div className="flex items-start justify-between px-3 py-2">
              <h2 id="videos-titre" className="font-serif text-title-34 text-content">
                Vidéos
              </h2>
              <p aria-hidden="true" className="font-mono text-mono-12 uppercase text-content-muted">
                Durée
              </p>
            </div>
            <ol className="flex flex-col gap-0.5">
              {data.videos.map((v, i) => (
                <PlaylistVideoRow
                  key={v.id}
                  video={v}
                  number={i + 1}
                  to={`/playlists/${data.id}/watch/${v.youtubeId}`}
                  current={next?.video.id === v.id && !v.completed}
                />
              ))}
            </ol>
          </section>
          <div className="w-full xl:w-[420px] xl:shrink-0">
            <PlaylistNotePreview playlistId={data.id} context={{ eyebrow: `Note de playlist · ${data.videoCount} vidéo${data.videoCount > 1 ? 's' : ''}`, heading: data.title }} />
          </div>
        </div>
      </main>
    </div>
  )
}
