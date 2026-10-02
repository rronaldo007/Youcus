import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { buttonClass } from '@/components/ui/buttonStyles'
import { InlineMessage } from '@/components/ui/InlineMessage'
import type { NoteActions } from '@/features/notes/NoteEditor'
import { noteExcerpt } from '@/features/notes/noteExcerpt'
import { PlaylistNotes } from '@/features/notes/PlaylistNotes'
import { usePlaylistNote } from '@/features/notes/usePlaylistNote'

/**
 * Figma « Détail de playlist » 16:434, « Note de la playlist »: what the note says, that it is saved,
 * and « Ouvrir dans le cahier », which opens it in the expanded view (YC-18). The editor stays
 * mounted, hidden, so the view opens at once and nothing waiting to be saved is lost.
 */
export function PlaylistNotePreview({ playlistId, context }: { playlistId: string; context: { eyebrow?: string; heading: string } }) {
  const { data: note, isLoading } = usePlaylistNote(playlistId)
  const actions = useRef<NoteActions | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  const text = noteExcerpt(note?.doc)

  function open() {
    if (actions.current) return actions.current.expand()
    // The editor is still loading: the address opens it as soon as it is there, like a shared link.
    const url = new URL(window.location.href)
    url.searchParams.set('note', 'agrandie')
    window.history.pushState({ ...window.history.state, ycNote: true }, '', url)
  }

  return (
    <section aria-labelledby="note-playlist-titre" className="flex flex-col items-start gap-4 rounded-yc-xl border border-line bg-surface p-6">
      <h2 id="note-playlist-titre" className="font-serif text-title-34 text-content">
        Note de la playlist
      </h2>
      {!isLoading && (
        <p className={`line-clamp-4 text-body-15 ${text ? 'text-content' : 'text-content-muted'}`}>
          {text || 'Aucune note pour l’instant : écris ce que tu veux retenir de cette playlist.'}
        </p>
      )}
      {note && <InlineMessage tone="success">Enregistré</InlineMessage>}
      {/* A plain button: React 18 passes no ref through Button, and the focus comes back here. */}
      <div className="flex flex-wrap gap-2.5">
        <button ref={button} type="button" onClick={open} className={buttonClass('secondary')}>
          Ouvrir dans le cahier
        </button>
        {/* The note page of the playlist, with its videos and their notes beside it (YC-77). */}
        <Link to={`/notes/playlists/${playlistId}`} className={buttonClass('ghost')}>
          Pleine page
        </Link>
      </div>
      <PlaylistNotes playlistId={playlistId} context={context} modalOnly actions={actions} onClose={() => button.current?.focus()} />
    </section>
  )
}
