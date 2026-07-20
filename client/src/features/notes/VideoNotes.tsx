import { NoteEditor } from '@/features/notes/NoteEditor'
import { useSaveVideoNote, useVideoNote } from '@/features/notes/useVideoNote'

/** Panneau de note Markdown pour une vidéo (éditeur + autosave + aperçu). */
export function VideoNotes({ videoId }: { videoId: string }) {
  const { data: note, isLoading } = useVideoNote(videoId)
  const save = useSaveVideoNote(videoId)

  return (
    <div className="mt-6">
      <NoteEditor
        title="Notes"
        textareaLabel="Note de la vidéo"
        note={note}
        isLoading={isLoading}
        onSave={save.mutate}
        isSaving={save.isPending}
        resetKey={videoId}
      />
    </div>
  )
}
