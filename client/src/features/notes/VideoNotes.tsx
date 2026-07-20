import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import { useSaveVideoNote, useVideoNote } from '@/features/notes/useVideoNote'

const AUTOSAVE_DELAY = 1000
type Mode = 'edit' | 'preview'

/**
 * Panneau de note Markdown pour une vidéo : édition + sauvegarde automatique (debounce),
 * et aperçu formaté assaini (react-markdown + rehype-sanitize).
 */
export function VideoNotes({ videoId }: { videoId: string }) {
  const { data: note, isLoading } = useVideoNote(videoId)
  const save = useSaveVideoNote(videoId)
  const saveMutate = save.mutate
  const [draft, setDraft] = useState('')
  const [dirty, setDirty] = useState(false)
  const [mode, setMode] = useState<Mode>('edit')
  const seededFor = useRef<string | null>(null)

  // Amorce le brouillon quand la note de CETTE vidéo est chargée (une fois par vidéo).
  useEffect(() => {
    if (note !== undefined && seededFor.current !== videoId) {
      setDraft(note?.content ?? '')
      seededFor.current = videoId
      setDirty(false)
    }
  }, [note, videoId])

  // Sauvegarde automatique après 1 s sans frappe.
  useEffect(() => {
    if (!dirty) return
    const timer = setTimeout(() => {
      saveMutate(draft)
      setDirty(false)
    }, AUTOSAVE_DELAY)
    return () => clearTimeout(timer)
  }, [draft, dirty, saveMutate])

  const status = save.isPending
    ? 'Enregistrement…'
    : dirty
      ? 'Modifié'
      : save.isSuccess
        ? 'Enregistré'
        : ''

  const tab = (m: Mode, label: string) => (
    <button
      type="button"
      aria-pressed={mode === m}
      onClick={() => setMode(m)}
      className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
        mode === m ? 'bg-brand-purple text-white' : 'text-content-muted hover:bg-surface-2'
      }`}
    >
      {label}
    </button>
  )

  return (
    <section aria-label="Notes" className="mt-6 rounded-card border border-line bg-canvas p-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-content-muted">Notes</h2>
        <div className="flex items-center gap-3">
          <div role="group" aria-label="Mode des notes" className="flex rounded-lg border border-line p-0.5">
            {tab('edit', 'Éditer')}
            {tab('preview', 'Aperçu')}
          </div>
          <span aria-live="polite" className="text-xs text-content-muted">
            {status}
          </span>
        </div>
      </div>

      {mode === 'edit' ? (
        <textarea
          aria-label="Note de la vidéo"
          value={draft}
          disabled={isLoading}
          onChange={(e) => {
            setDraft(e.target.value)
            setDirty(true)
          }}
          placeholder="Écris tes notes en Markdown…"
          className="mt-3 h-48 w-full resize-y rounded-lg border border-line bg-surface p-3 font-mono text-sm text-content outline-none transition focus:border-brand-purple"
        />
      ) : draft.trim() ? (
        <div className="yc-md mt-3 min-h-48 rounded-lg border border-line bg-surface p-3">
          <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{draft}</ReactMarkdown>
        </div>
      ) : (
        <p className="mt-3 min-h-48 rounded-lg border border-line bg-surface p-3 text-sm text-content-muted">
          Rien à afficher — écris une note dans l'onglet « Éditer ».
        </p>
      )}
    </section>
  )
}
