import type { MutableRefObject } from 'react'
import { LazyNoteEditor as NoteEditor } from '@/features/notes/LazyNoteEditor'
import type { NoteActions } from '@/features/notes/NoteEditor'
import { usePlaylistNote, useSavePlaylistNote } from '@/features/notes/usePlaylistNote'

/** Panneau de note attachée à une playlist entière (distincte des notes de vidéo). */
interface PlaylistNotesProps {
  playlistId: string
  context?: { eyebrow?: string; heading: string }
  /** The playlist page shows a preview and opens the note expanded (YC-75). */
  modalOnly?: boolean
  actions?: MutableRefObject<NoteActions | null>
  onClose?: () => void
}

export function PlaylistNotes({ playlistId, context, modalOnly, actions, onClose }: PlaylistNotesProps) {
  const { data: note, isLoading } = usePlaylistNote(playlistId)
  const save = useSavePlaylistNote(playlistId)

  return (
    <NoteEditor
      title="Note de la playlist"
      icon="📌"
      editorLabel="Contenu de la note de la playlist"
      note={note}
      isLoading={isLoading}
      onSave={save.mutate}
      isSaving={save.isPending}
        isOffline={save.isPaused}
      resetKey={playlistId}
      context={context}
      modalOnly={modalOnly}
      actions={actions}
      onClose={onClose}
    />
  )
}
