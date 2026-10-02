import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { PageState } from '@/components/ui/PageState'
import { Skeleton } from '@/components/ui/Skeletons'
import { ResumeBanner } from '@/features/dashboard/ResumeBanner'
import { dayLabel, greeting, videosToWatch } from '@/features/dashboard/dashboardText'
import { useResume } from '@/features/dashboard/useResume'
import { useLibraryVideos } from '@/features/library/useLibrary'
import { ImportPlaylistForm } from '@/features/playlists/ImportPlaylistForm'
import { PlaylistLibrary } from '@/features/playlists/PlaylistLibrary'
import { usePlaylists } from '@/features/playlists/usePlaylists'
import type { User } from '@/types'

/** The line above the greeting: the day, then what is left (Figma « Tableau de bord » 11:5). */
function Overline({ now, status, short }: { now: Date; status: string; short: string }) {
  return (
    <p className="font-mono text-mono-12 uppercase text-content-muted">
      <span className="xl:hidden">
        {dayLabel(now, true)} · {short}
      </span>
      <span className="hidden xl:inline">
        {dayLabel(now)} · {status}
      </span>
    </p>
  )
}

function LoadingGrid() {
  return (
    <div aria-busy="true" aria-label="Chargement" className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} kind="playlist-card" />
      ))}
    </div>
  )
}

/**
 * Le tableau de bord (Figma « Tableau de bord » 11:5, 11:226, 11:360 ; sombre 45:6212 ; états Vide
 * 98:16476 et Chargement 98:16548). « Jeton expiré » waits for YC-84: the server forgets a dead token
 * today, so nothing tells it apart from an account never connected.
 */
export function Dashboard({ user, now = new Date() }: { user: User; now?: Date }) {
  const playlists = usePlaylists()
  const library = useLibraryVideos()
  const resume = useResume()
  const [importing, setImporting] = useState(false)
  const [selecting, setSelecting] = useState(false)

  const loading = playlists.isLoading || library.isLoading
  const list = playlists.data ?? []
  const videos = library.data ?? []
  const empty = !loading && !playlists.isError && list.length === 0 && videos.length === 0
  const left = videosToWatch(list, videos)
  const status = loading ? 'Chargement…' : empty ? 'Aucune playlist encore' : left === 0 ? 'Tout est vu' : `${left} vidéo${left > 1 ? 's' : ''} à voir`
  const short = loading ? 'Chargement…' : empty ? 'Aucune playlist' : left === 0 ? 'Tout est vu' : `${left} à voir`
  const toggleImport = () => setImporting((v) => !v)

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 pb-16 pt-6 md:gap-8 md:px-8 md:pt-10 xl:px-16">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex flex-col gap-2">
          <Overline now={now} status={status} short={short} />
          <h1 className="font-serif text-title-34 text-content md:text-[44px] md:leading-[48px] xl:text-title-56">
            {greeting(now, user.displayName)}
            <span className="hidden xl:inline"> {empty ? 'On commence ?' : 'On reprend ?'}</span>
          </h1>
        </div>
        <div className="flex gap-3">
          {/* Not on the tablet and phone frames: kept there too, merging must stay within reach. */}
          {list.length >= 2 && (
            <Button variant="secondary" aria-pressed={selecting} onClick={() => setSelecting((v) => !v)}>
              Fusionner
            </Button>
          )}
          <Button onClick={toggleImport} className="hidden xl:inline-flex">
            + Importer une playlist
          </Button>
        </div>
      </header>

      {importing && (
        <div className="rounded-yc-lg border border-line bg-surface p-4">
          <ImportPlaylistForm />
        </div>
      )}

      {loading ? (
        <>
          <div aria-hidden="true" className="h-[112px] w-full rounded-yc-xl border border-line bg-surface" />
          <LoadingGrid />
        </>
      ) : empty ? (
        <PageState
          kind="empty"
          title="Rien ici pour l’instant"
          text="Importe une playlist YouTube : elle devient un cours, avec ta progression et ton cahier."
          action={{ label: '+ Importer une playlist', onClick: toggleImport }}
          // The catalogue has no page yet (YC-65): greyed like the tab.
          secondaryAction={{ label: 'Voir le catalogue', soon: true }}
        />
      ) : (
        <>
          {resume.data && <ResumeBanner item={resume.data} />}
          <PlaylistLibrary onImport={toggleImport} selecting={selecting} onSelectingDone={() => setSelecting(false)} />
        </>
      )}
    </main>
  )
}
