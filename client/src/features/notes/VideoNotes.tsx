import type { MutableRefObject } from 'react'
import { LazyNoteEditor as NoteEditor } from '@/features/notes/LazyNoteEditor'
import type { NoteActions, NoteSummary } from '@/features/notes/NoteEditor'
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
  notebook = false,
  fullPageTo,
  fullPage = false,
  onSummary,
  modalOnly,
  onClose,
}: {
  videoId: string
  player?: { seconds: number; seek: (seconds: number) => void }
  /** Shown above the note in its expanded view (YC-18). */
  context?: { eyebrow?: string; heading: string }
  /** What the player page can do to the note (the end card, YC-60). */
  actions?: MutableRefObject<NoteActions | null>
  /** « Mon cahier », the right column of the player (YC-76). */
  notebook?: boolean
  /** « Pleine page » in the notebook: the note page of this video (YC-77). */
  fullPageTo?: string
  /** On the note page (YC-77): the page draws the header and the side. */
  fullPage?: boolean
  onSummary?: (summary: NoteSummary) => void
  /** Only its expanded view (« Agrandir » of a card in Mes notes, YC-78). */
  modalOnly?: boolean
  onClose?: () => void
}) {
  const { data: note, isLoading } = useVideoNote(videoId)
  const save = useSaveVideoNote(videoId)

  return (
    <div className={notebook || fullPage || modalOnly ? '' : 'mt-6'}>
      <NoteEditor
        title={notebook ? 'Mon cahier' : 'Notes'}
        notebook={notebook}
        fullPageTo={fullPageTo}
        fullPage={fullPage}
        onSummary={onSummary}
        modalOnly={modalOnly}
        onClose={onClose}
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
