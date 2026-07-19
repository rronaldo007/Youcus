import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { useImportPlaylist } from '@/features/playlists/useImportPlaylist'

/** Champ d'import d'une playlist YouTube (URL ou identifiant). */
export function ImportPlaylistForm() {
  const [url, setUrl] = useState('')
  const importMut = useImportPlaylist()

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const value = url.trim()
    if (value) importMut.mutate(value)
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-xl flex-col gap-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="URL ou identifiant d'une playlist YouTube"
          aria-label="URL ou identifiant de playlist YouTube"
          className="flex-1 rounded-card border border-line bg-surface-2 px-4 py-2.5 text-sm text-content placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-brand-purple/40"
        />
        <Button type="submit" disabled={importMut.isPending}>
          {importMut.isPending ? 'Import…' : 'Importer'}
        </Button>
      </div>

      {importMut.isError && (
        <p role="alert" className="text-sm text-accent-red">
          {(importMut.error as Error).message}
        </p>
      )}
      {importMut.isSuccess && (
        <p className="text-sm text-success">
          Playlist «&nbsp;{importMut.data.title}&nbsp;» importée ({importMut.data.videoCount} vidéos).
        </p>
      )}
    </form>
  )
}
