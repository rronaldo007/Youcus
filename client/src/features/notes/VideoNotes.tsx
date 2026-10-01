import { LazyNoteEditor as NoteEditor } from '@/features/notes/LazyNoteEditor'
import { useSaveVideoNote, useVideoNote } from '@/features/notes/useVideoNote'

/**
 * Panneau de note pour une vidéo (éditeur + autosave + aperçu). With the player (YC-56), lines
 * can be timestamped and a timestamp jumps the video there.
 */
export function VideoNotes({ videoId, player }: { videoId: string; player?: { seconds: number; seek: (seconds: number) => void } }) {
  const { data: note, isLoading } = useVideoNote(videoId)
  const save = useSaveVideoNote(videoId)

  return (
    <div className="mt-6">
      <NoteEditor
        title="Notes"
        editorLabel="Note de la vidéo"
        note={note}
        isLoading={isLoading}
        onSave={save.mutate}
        isSaving={save.isPending}
        resetKey={videoId}
        player={player}
      />
    </div>
  )
}
