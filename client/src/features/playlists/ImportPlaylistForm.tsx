import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { useAddLibraryVideo } from '@/features/library/useLibrary'
import { useImportPlaylist } from '@/features/playlists/useImportPlaylist'
import { isVideoLink } from '@/lib/youtubeLink'

/**
 * Champ d'import : une playlist YouTube (URL ou identifiant), ou une vidéo seule par son lien,
 * gardée dans la bibliothèque (YC-61).
 */
export function ImportPlaylistForm() {
  const [url, setUrl] = useState('')
  const importMut = useImportPlaylist()
  const addVideo = useAddLibraryVideo()
  const [last, setLast] = useState<'playlist' | 'video' | null>(null)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const value = url.trim()
    if (!value) return
    if (isVideoLink(value)) {
      setLast('video')
      addVideo.mutate(value)
    } else {
      setLast('playlist')
      importMut.mutate(value)
    }
  }

  const pending = importMut.isPending || addVideo.isPending
  const current = last === 'video' ? addVideo : last === 'playlist' ? importMut : null

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-xl flex-col gap-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Lien d'une playlist ou d'une vidéo YouTube"
          aria-label="Lien d'une playlist ou d'une vidéo YouTube"
          className="flex-1 rounded-card border border-line bg-surface-2 px-4 py-2.5 text-sm text-content placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-brand-purple/40"
        />
        <Button type="submit" disabled={pending}>
          {pending ? 'Import…' : 'Importer'}
        </Button>
      </div>

      {current?.isError && (
        <p role="alert" className="text-sm text-accent-red">
          {(current.error as Error).message}
        </p>
      )}
      {last === 'playlist' && importMut.isSuccess && (
        <p className="text-sm text-success">
          Playlist «&nbsp;{importMut.data.title}&nbsp;» importée ({importMut.data.videoCount} vidéos).
        </p>
      )}
      {last === 'video' && addVideo.isSuccess && (
        <p className="text-sm text-success">
          Vidéo «&nbsp;{addVideo.data.title}&nbsp;» ajoutée à ta bibliothèque.{' '}
          <Link to={`/videos/${addVideo.data.youtubeId}`} className="font-medium underline">
            La regarder
          </Link>
        </p>
      )}
    </form>
  )
}
