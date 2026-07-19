import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { PlaylistCard } from '@/components/ui/PlaylistCard'
import { SkeletonGrid } from '@/components/ui/Skeletons'
import { MergePlaylistsModal } from '@/features/playlists/MergePlaylistsModal'
import { useDeletePlaylist, usePlaylists } from '@/features/playlists/usePlaylists'
import type { Playlist } from '@/types'

type Filter = 'all' | 'progress' | 'done'
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Toutes' },
  { key: 'progress', label: 'En cours' },
  { key: 'done', label: 'Terminées' },
]

function isDone(pl: Playlist): boolean {
  return pl.videoCount > 0 && (pl.completedCount ?? 0) >= pl.videoCount
}

/** Bibliothèque des playlists (grille design system, chips de filtre, carte d'import — cf. CS-59). */
export function PlaylistLibrary({ onImport }: { onImport?: () => void }) {
  const { data: playlists, isLoading, isError } = usePlaylists()
  const del = useDeletePlaylist()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [merging, setMerging] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')

  if (isLoading) return <SkeletonGrid variant="playlist" />
  if (isError) {
    return (
      <p role="alert" className="text-accent-red">
        Impossible de charger vos playlists.
      </p>
    )
  }
  if (!playlists || playlists.length === 0) {
    return (
      <button
        type="button"
        onClick={onImport}
        className="flex w-full flex-col items-center gap-2 rounded-card border border-dashed border-line px-6 py-12 text-center transition hover:bg-surface-2"
      >
        <span className="text-3xl text-content-muted">+</span>
        <span className="font-medium text-content">Aucune playlist — importer une playlist</span>
        <span className="text-sm text-content-muted">Colle une URL YouTube pour commencer.</span>
      </button>
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

  function onDelete(id: string, title: string) {
    if (window.confirm(`Supprimer la playlist « ${title} » ?`)) del.mutate(id)
  }

  const visible = playlists.filter((pl) => {
    if (filter === 'done') return isDone(pl)
    if (filter === 'progress') return !isDone(pl) && (pl.completedCount ?? 0) > 0
    return true
  })
  const selectedPlaylists = playlists.filter((pl) => selected.has(pl.id))

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              filter === f.key ? 'bg-brand-purple text-white' : 'bg-surface-2 text-content hover:opacity-90'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {selected.size > 0 && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-card border border-line bg-surface px-4 py-2">
          <span className="text-sm text-content-muted">{selected.size} sélectionnée(s)</span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setSelected(new Set())}>
              Annuler
            </Button>
            <Button disabled={selected.size < 2} onClick={() => setMerging(true)}>
              Fusionner
            </Button>
          </div>
        </div>
      )}

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visible.map((pl) => (
          <li key={pl.id} className="overflow-hidden rounded-card border border-line bg-surface text-left">
            <Link to={`/playlists/${pl.id}`} className="block transition hover:opacity-95">
              <PlaylistCard playlist={pl} />
            </Link>
            <div className="flex items-center justify-between border-t border-line px-3.5 py-2">
              <label className="flex items-center gap-2 text-sm text-content-muted">
                <input
                  type="checkbox"
                  checked={selected.has(pl.id)}
                  onChange={() => toggle(pl.id)}
                  aria-label={`Sélectionner ${pl.title}`}
                />
                Sélectionner
              </label>
              <button
                type="button"
                onClick={() => onDelete(pl.id, pl.title)}
                disabled={del.isPending}
                className="text-sm text-accent-red transition hover:underline disabled:opacity-60"
              >
                Supprimer
              </button>
            </div>
          </li>
        ))}

        {filter === 'all' && (
          <li>
            <button
              type="button"
              onClick={onImport}
              className="flex h-full min-h-[240px] w-full flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line text-content-muted transition hover:bg-surface-2"
            >
              <span className="text-3xl">+</span>
              <span className="text-sm font-medium">Importer une playlist</span>
            </button>
          </li>
        )}
      </ul>

      {merging && (
        <MergePlaylistsModal
          sources={selectedPlaylists}
          onClose={() => {
            setMerging(false)
            setSelected(new Set())
          }}
        />
      )}
    </>
  )
}
