import { useEffect, useRef, useState } from 'react'
import { useSaveVideoNote, useVideoNote } from '@/features/notes/useVideoNote'

const AUTOSAVE_DELAY = 1000

/**
 * Panneau de note Markdown pour une vidéo : édition + sauvegarde automatique (debounce).
 * Le rendu formaté (aperçu) est apporté par CS-17.
 */
export function VideoNotes({ videoId }: { videoId: string }) {
  const { data: note, isLoading } = useVideoNote(videoId)
  const save = useSaveVideoNote(videoId)
  const saveMutate = save.mutate
  const [draft, setDraft] = useState('')
  const [dirty, setDirty] = useState(false)
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

  return (
    <section aria-label="Notes" className="mt-6 rounded-card border border-line bg-canvas p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-content-muted">Notes</h2>
        <span aria-live="polite" className="text-xs text-content-muted">
          {status}
        </span>
      </div>
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
    </section>
  )
}
