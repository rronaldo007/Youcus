import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { useMergePlaylists } from '@/features/playlists/usePlaylists'
import type { Playlist } from '@/types'

/** Modal de fusion : nomme la playlist fusionnée et confirme (cf. Figma Fusion Modal 118:923). */
export function MergePlaylistsModal({ sources, onClose }: { sources: Playlist[]; onClose: () => void }) {
  const [title, setTitle] = useState('')
  const merge = useMergePlaylists()
  const navigate = useNavigate()
  const totalVideos = sources.reduce((n, p) => n + p.videoCount, 0)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim() || sources.length < 2) return
    merge.mutate(
      { sourceIds: sources.map((s) => s.id), title: title.trim() },
      {
        onSuccess: (pl) => {
          onClose()
          navigate(`/playlists/${pl.id}`)
        },
      },
    )
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Fusionner des playlists"
      className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 p-4"
    >
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-card border border-line bg-surface p-5 text-left">
        <h2 className="text-lg font-semibold text-content">Fusionner des playlists</h2>
        <p className="mt-1 text-sm text-content-muted">
          {sources.length} playlists · {totalVideos} vidéos (avant déduplication)
        </p>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nom de la playlist fusionnée"
          aria-label="Nom de la playlist fusionnée"
          className="mt-4 w-full rounded-card border border-line bg-surface-2 px-4 py-2.5 text-sm text-content placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-brand-purple/40"
        />
        {merge.isError && (
          <p role="alert" className="mt-2 text-sm text-accent-red">
            {(merge.error as Error).message}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={!title.trim() || merge.isPending}>
            {merge.isPending ? 'Fusion…' : 'Fusionner'}
          </Button>
        </div>
      </form>
    </div>
  )
}
