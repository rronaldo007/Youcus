import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { PlaylistCard } from '@/components/ui/PlaylistCard'
import { SkeletonGrid } from '@/components/ui/Skeletons'
import { MergePlaylistsModal } from '@/features/playlists/MergePlaylistsModal'
import { useDeletePlaylist, usePlaylists } from '@/features/playlists/usePlaylists'

/** Bibliothèque des playlists importées (grille de cartes design system, cf. CS-53). */
export function PlaylistLibrary() {
  const { data: playlists, isLoading, isError } = usePlaylists()
  const del = useDeletePlaylist()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [merging, setMerging] = useState(false)

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
      <div className="rounded-card border border-dashed border-line px-6 py-12 text-center">
        <p className="font-medium text-content">Aucune playlist pour le moment</p>
        <p className="mt-1 text-sm text-content-muted">
          Importez une playlist YouTube ci-dessus pour commencer.
        </p>
      </div>
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

  const selectedPlaylists = playlists.filter((pl) => selected.has(pl.id))

  return (
    <>
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

      <ul className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {playlists.map((pl) => (
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
