import { Link } from 'react-router-dom'
import { useDeletePlaylist, usePlaylists } from '@/features/playlists/usePlaylists'

/** Bibliothèque des playlists importées (grille de cartes). Habillage design system : CS-53. */
export function PlaylistLibrary() {
  const { data: playlists, isLoading, isError } = usePlaylists()
  const del = useDeletePlaylist()

  if (isLoading) return <p className="text-content-muted">Chargement de vos playlists…</p>
  if (isError) {
    return (
      <p role="alert" className="text-accent-red">
        Impossible de charger vos playlists.
      </p>
    )
  }
  if (!playlists || playlists.length === 0) {
    return <p className="text-content-muted">Aucune playlist importée pour le moment.</p>
  }

  function onDelete(id: string, title: string) {
    if (window.confirm(`Supprimer la playlist « ${title} » ?`)) del.mutate(id)
  }

  return (
    <ul className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {playlists.map((pl) => (
        <li key={pl.id} className="overflow-hidden rounded-card border border-line bg-surface text-left">
          <Link to={`/playlists/${pl.id}`} className="block">
            {pl.thumbnailUrl ? (
              <img src={pl.thumbnailUrl} alt="" className="aspect-video w-full object-cover" />
            ) : (
              <div className="aspect-video w-full bg-surface-2" />
            )}
            <div className="p-3">
              <p className="line-clamp-2 font-medium text-content">{pl.title}</p>
              <p className="text-sm text-content-muted">
                {pl.videoCount} vidéo{pl.videoCount > 1 ? 's' : ''}
              </p>
            </div>
          </Link>
          <div className="px-3 pb-3">
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
  )
}
