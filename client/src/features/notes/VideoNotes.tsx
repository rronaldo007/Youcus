import type { MutableRefObject } from 'react'
import { LazyNoteEditor as NoteEditor } from '@/features/notes/LazyNoteEditor'
import type { NoteActions } from '@/features/notes/NoteEditor'
import { useSaveVideoNote, useVideoNote } from '@/features/notes/useVideoNote'

/**
 * Panneau de note pour une vidéo (éditeur + autosave + aperçu). With the player (YC-56), lines
 * can be timestamped and a timestamp jumps the video there.
 */
export function VideoNotes({
  videoId,
  player,
  context,
  actions,
}: {
  videoId: string
  player?: { seconds: number; seek: (seconds: number) => void }
  /** Shown above the note in its expanded view (YC-18). */
  context?: { eyebrow?: string; heading: string }
  /** What the player page can do to the note (the end card, YC-60). */
  actions?: MutableRefObject<NoteActions | null>
}) {
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
        isOffline={save.isPaused}
        resetKey={videoId}
        player={player}
        context={context}
        actions={actions}
      />
    </div>
  )
}
