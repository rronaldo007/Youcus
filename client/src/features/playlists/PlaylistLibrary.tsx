import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { buttonClass } from '@/components/ui/buttonStyles'
import { CardMenu } from '@/components/ui/CardMenu'
import { PlaylistCard } from '@/components/ui/PlaylistCard'
import { LibraryVideoCard } from '@/components/ui/LibraryVideoCard'
import { libraryVideoState } from '@/features/library/libraryVideoState'
import { MergePlaylistsModal } from '@/features/playlists/MergePlaylistsModal'
import { useDeletePlaylist, usePlaylists } from '@/features/playlists/usePlaylists'
import { useLibraryVideos, useRemoveLibraryVideo } from '@/features/library/useLibrary'
import type { LibraryVideo, Playlist } from '@/types'

type Filter = 'all' | 'progress' | 'done' | 'recent' | 'videos'
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Toutes' },
  { key: 'progress', label: 'En cours' },
  { key: 'done', label: 'Terminées' },
  { key: 'recent', label: 'Récentes' },
  // Figma « Tableau de bord » 11:5 (YC-61): the videos kept on their own.
  { key: 'videos', label: 'Vidéos seules' },
]

function isDone(pl: Playlist): boolean {
  // Counted on playable videos (YC-13): a deleted video must not keep a playlist unfinished.
  const base = pl.availableCount ?? pl.videoCount
  return base > 0 && (pl.completedCount ?? 0) >= base
}

/** The same filters for a video kept on its own (YC-61). « Récentes » dates playlists only. */
function videoMatches(video: LibraryVideo, filter: Filter): boolean {
  const state = libraryVideoState(video)
  if (filter === 'done') return state === 'seen'
  if (filter === 'progress') return state === 'progress'
  return filter !== 'recent'
}

/** The playlists a filter shows, in its order: « Récentes » = the last watched first (YC-74). */
function visiblePlaylists(playlists: Playlist[], filter: Filter): Playlist[] {
  if (filter === 'videos') return []
  if (filter === 'done') return playlists.filter(isDone)
  if (filter === 'progress') return playlists.filter((pl) => !isDone(pl) && (pl.completedCount ?? 0) > 0)
  if (filter === 'recent') {
    return playlists
      .filter((pl) => pl.lastActivityAt)
      .sort((a, b) => (b.lastActivityAt as string).localeCompare(a.lastActivityAt as string))
  }
  return playlists
}

/** The channel under a playlist card: whose videos these are (YC-74). */
function channelOf(pl: Playlist): string | null {
  return pl.multipleChannels ? 'Plusieurs chaînes' : (pl.channelTitle ?? null)
}

interface PlaylistLibraryProps {
  onImport?: () => void
  /** « Fusionner » in the dashboard header turns the cards into a selection (YC-74). */
  selecting?: boolean
  onSelectingDone?: () => void
}

/**
 * The library of the dashboard (Figma « Tableau de bord » 11:5): the filters, the playlists, then the
 * videos kept on their own (YC-61) in the same grid, and the import card. Each card's « Actions » menu
 * is always visible; selecting playlists to merge starts from « Fusionner » in the header.
 */
export function PlaylistLibrary({ onImport, selecting = false, onSelectingDone }: PlaylistLibraryProps) {
  const { data: playlists, isError } = usePlaylists()
  const del = useDeletePlaylist()
  const library = useLibraryVideos()
  const remove = useRemoveLibraryVideo()
  const videos = library.data ?? []
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [merging, setMerging] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')

  if (isError) {
    return (
      <p role="alert" className="text-body-15 text-error">
        Impossible de charger tes playlists.
      </p>
    )
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function stopSelecting() {
    setSelected(new Set())
    onSelectingDone?.()
  }

  function onDelete(pl: Playlist) {
    if (window.confirm(`Supprimer la playlist « ${pl.title} » ?`)) del.mutate(pl.id)
  }

  function onRemove(video: LibraryVideo) {
    if (window.confirm(`Retirer « ${video.title} » de ta bibliothèque ? Sa note est gardée.`)) remove.mutate(video.id)
  }

  const visible = visiblePlaylists(playlists ?? [], filter)
  const visibleVideos = videos.filter((v) => videoMatches(v, filter))
  const selectedPlaylists = (playlists ?? []).filter((pl) => selected.has(pl.id))

  return (
    <>
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <div role="group" aria-label="Filtres" className="flex w-max gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={buttonClass(filter === f.key ? 'primary' : 'secondary')}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {library.isError && (
        <p role="alert" className="text-body-15 text-error">
          Impossible de charger tes vidéos seules. Tes playlists, elles, sont là.
        </p>
      )}
      {filter === 'videos' && visibleVideos.length === 0 && !library.isError && (
        <p className="text-body-15 text-content-muted">
          Aucune vidéo seule. Colle le lien d'une vidéo dans « + Importer une playlist » pour la garder ici.
        </p>
      )}
      {filter === 'recent' && visible.length === 0 && (
        <p className="text-body-15 text-content-muted">Aucune playlist commencée pour l’instant : elles arrivent ici dès ta première vidéo.</p>
      )}

      {selecting && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-yc-lg border border-line bg-surface px-4 py-2">
          <span className="text-body-15 text-content-muted">
            {selected.size === 0 ? 'Choisis au moins deux playlists à fusionner.' : `${selected.size} sélectionnée${selected.size > 1 ? 's' : ''}`}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={stopSelecting}>
              Annuler
            </Button>
            <Button disabled={selected.size < 2} onClick={() => setMerging(true)}>
              Fusionner ({selected.size})
            </Button>
          </div>
        </div>
      )}

      <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {visible.map((pl) => (
          <li key={pl.id} className="relative">
            <Link to={`/playlists/${pl.id}`} className="block h-full rounded-yc-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
              <PlaylistCard playlist={pl} channel={channelOf(pl)} />
            </Link>
            {/* Over the card, not inside its link: a button never sits in a link. */}
            <div className="absolute right-1.5 top-2">
              <CardMenu
                label={`Actions de ${pl.title}`}
                items={[
                  { label: 'Ouvrir', to: `/playlists/${pl.id}` },
                  { label: 'Supprimer', danger: true, onSelect: () => onDelete(pl) },
                ]}
              />
            </div>
            {selecting && (
              <label className="absolute left-3 top-3 flex min-h-touch cursor-pointer items-center gap-2 rounded-full bg-surface px-3 text-small-13 font-medium text-content">
                <input type="checkbox" checked={selected.has(pl.id)} onChange={() => toggle(pl.id)} className="size-4 accent-[var(--yc-bg-accent)]" />
                Choisir <span className="sr-only">{pl.title}</span>
              </label>
            )}
          </li>
        ))}

        {visibleVideos.map((video) => (
          <li key={`video-${video.id}`} className="relative">
            <Link to={`/videos/${video.youtubeId}`} className="block h-full rounded-yc-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
              <LibraryVideoCard video={video} />
            </Link>
            <div className="absolute right-1.5 top-2">
              <CardMenu
                label={`Actions de ${video.title}`}
                items={[
                  { label: 'Ouvrir', to: `/videos/${video.youtubeId}` },
                  { label: 'Retirer', danger: true, onSelect: () => onRemove(video) },
                ]}
              />
            </div>
          </li>
        ))}

        {filter === 'all' && (
          // On a computer the dashed card ends the grid; tablet and phone get a full-width button after it.
          <li className="hidden xl:block">
            <button
              type="button"
              onClick={onImport}
              className="flex size-full min-h-[328px] flex-col items-center justify-center gap-3 rounded-yc-lg border-[1.5px] border-dashed border-line transition-colors hover:border-line-strong"
            >
              <span aria-hidden="true" className="font-serif text-title-56 text-accent-text">
                +
              </span>
              <span className="text-label-14 font-semibold text-content-muted">Importer une playlist</span>
            </button>
          </li>
        )}
      </ul>
      {filter === 'all' && (
        <Button variant="secondary" onClick={onImport} className="w-full xl:hidden">
          + Importer une playlist
        </Button>
      )}

      {merging && (
        <MergePlaylistsModal
          sources={selectedPlaylists}
          onClose={() => {
            setMerging(false)
            stopSelecting()
          }}
        />
      )}
    </>
  )
}
