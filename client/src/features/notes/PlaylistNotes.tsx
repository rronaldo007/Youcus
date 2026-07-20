import { NoteEditor } from '@/features/notes/NoteEditor'
import { usePlaylistNote, useSavePlaylistNote } from '@/features/notes/usePlaylistNote'

/** Panneau de note Markdown attachée à une playlist entière (distincte des notes de vidéo). */
export function PlaylistNotes({ playlistId }: { playlistId: string }) {
  const { data: note, isLoading } = usePlaylistNote(playlistId)
  const save = useSavePlaylistNote(playlistId)

  return (
    <NoteEditor
      title="Note de la playlist"
      icon="📌"
      textareaLabel="Contenu de la note de la playlist"
      note={note}
      isLoading={isLoading}
      onSave={save.mutate}
      isSaving={save.isPending}
      resetKey={playlistId}
    />
  )
}
