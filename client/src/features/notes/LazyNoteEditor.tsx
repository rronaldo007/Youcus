import { lazy, Suspense, type ComponentProps } from 'react'
import type { NoteEditor as NoteEditorType } from '@/features/notes/NoteEditor'

/**
 * The rich editor (TipTap, fonts, styles) weighs about 90 kB gzipped: it is loaded only on the
 * pages that show a note, never on the public pages (YC-40).
 */
const NoteEditor = lazy(() => import('@/features/notes/NoteEditor').then((m) => ({ default: m.NoteEditor })))

export function LazyNoteEditor(props: ComponentProps<typeof NoteEditorType>) {
  return (
    <Suspense
      fallback={
        // A modal-only note has nothing to show while it loads: the page draws its preview.
        props.modalOnly ? null : (
        <section aria-label={props.title} aria-busy="true" className="min-h-72 rounded-card border border-line bg-canvas p-4">
          <p className="text-sm text-content-muted">Chargement des notes…</p>
        </section>
        )
      }
    >
      <NoteEditor {...props} />
    </Suspense>
  )
}
