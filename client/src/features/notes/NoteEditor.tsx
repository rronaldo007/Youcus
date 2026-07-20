import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'

const AUTOSAVE_DELAY = 1000
type Mode = 'edit' | 'preview'

export interface NoteData {
  content: string
  updatedAt: string
}

interface NoteEditorProps {
  /** Titre du panneau (distingue note de vidéo / de playlist). */
  title: string
  /** Emoji/icône optionnelle devant le titre (distinction visuelle). */
  icon?: string
  /** Label accessible du textarea. */
  textareaLabel: string
  /** Note chargée (null si aucune, undefined si en cours de chargement). */
  note: NoteData | null | undefined
  isLoading: boolean
  /** Sauvegarde le contenu (déclenché par l'autosave). */
  onSave: (content: string) => void
  isSaving: boolean
  /** Change quand la cible change (videoId / playlistId) → ré-amorce le brouillon. */
  resetKey: string
}

/** Formate une date ISO en HH:MM (locale FR), ou '' si invalide. */
function formatTime(iso: string | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Éditeur de note Markdown réutilisable : édition + autosave (debounce) + aperçu assaini.
 * Utilisé pour les notes de vidéo (CS-16/17) et de playlist (CS-49).
 */
export function NoteEditor({ title, icon, textareaLabel, note, isLoading, onSave, isSaving, resetKey }: NoteEditorProps) {
  const [draft, setDraft] = useState('')
  const [dirty, setDirty] = useState(false)
  const [mode, setMode] = useState<Mode>('edit')
  const seededFor = useRef<string | null>(null)

  // Amorce le brouillon quand la note de CETTE cible est chargée (une fois par cible).
  useEffect(() => {
    if (note !== undefined && seededFor.current !== resetKey) {
      setDraft(note?.content ?? '')
      seededFor.current = resetKey
      setDirty(false)
    }
  }, [note, resetKey])

  // Sauvegarde automatique après 1 s sans frappe.
  useEffect(() => {
    if (!dirty) return
    const timer = setTimeout(() => {
      onSave(draft)
      setDirty(false)
    }, AUTOSAVE_DELAY)
    return () => clearTimeout(timer)
  }, [draft, dirty, onSave])

  const savedTime = formatTime(note?.updatedAt)
  const status = isSaving
    ? 'Enregistrement…'
    : dirty
      ? 'Modifié'
      : savedTime
        ? `Enregistré à ${savedTime}`
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
    <section aria-label={title} className="rounded-card border border-line bg-canvas p-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-content-muted">
          {icon ? `${icon} ` : ''}
          {title}
        </h2>
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
          aria-label={textareaLabel}
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
