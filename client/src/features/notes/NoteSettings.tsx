import { useId } from 'react'
import { FONTS, SIZES, type FontId, type FontSize } from '@/features/notes/noteMarkValues'
import { DEFAULT_PREFERENCES, PAPERS, TINTS, type NotePreferences } from '@/features/notes/notePage'
import { useNotePreferences, useSaveNotePreferences } from '@/features/notes/useNotePreferences'
import './note-editor.css'

/**
 * Réglages › Notes (YC-48), Figma « Réglages » 17:1219: the starting settings of every NEW note.
 * A note gets them when it is created, then keeps its own: changing them touches no existing note.
 * Loaded on its own (lazy), so the editor's styles and fonts stay out of the main bundle.
 */
export default function NoteSettings() {
  const { data, isLoading, isError } = useNotePreferences()
  const saving = useSaveNotePreferences()
  const fontId = useId()
  const sizeId = useId()
  const switchId = useId()
  if (isLoading) return <p className="mt-4 text-sm text-content-muted">Chargement…</p>
  const prefs = data ?? DEFAULT_PREFERENCES
  const set = (change: Partial<NotePreferences>) => saving.save(change)

  const toggle = (key: 'timestamps' | 'margin', label: string) => (
    <div className="flex min-h-11 items-center justify-between gap-4">
      <span className="text-sm font-medium text-content" id={`${switchId}-${key}`}>
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={prefs[key]}
        aria-labelledby={`${switchId}-${key}`}
        className="yc-settings-switch"
        onClick={() => set({ [key]: !prefs[key] })}
      >
        <span aria-hidden="true" className="yc-switch" />
      </button>
    </div>
  )

  return (
    <div className="yc-note mt-4 flex flex-col gap-5">
      <p className="text-sm text-content-muted">
        Réglages de départ de chaque nouvelle note. Une note peut changer de fond depuis sa barre (Fond ▾).
      </p>
      {isError && (
        <p role="alert" className="text-sm text-accent-red">
          Tes réglages n'ont pas pu être lus : ceux par défaut sont affichés.
        </p>
      )}

      <div>
        <p className="mb-2 text-sm font-medium text-content">Fond par défaut</p>
        <div role="radiogroup" aria-label="Fond par défaut" className="yc-papers yc-settings-papers">
          {PAPERS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={prefs.paper === p.id}
              aria-label={`Papier ${p.label.toLowerCase()}`}
              className="yc-paper-choice"
              onClick={() => set({ paper: p.id })}
            >
              <span className="yc-paper-preview" data-paper={p.id} data-tint={prefs.tint} />
              <span className="yc-paper-name">{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-content">Teinte</p>
        <div role="radiogroup" aria-label="Teinte par défaut" className="yc-swatches">
          {TINTS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={prefs.tint === t.id}
              aria-label={`Teinte ${t.label.toLowerCase()}`}
              className="yc-swatch"
              onClick={() => set({ tint: t.id })}
            >
              <span className="yc-swatch-dot yc-tint-dot" data-tint={t.id} />
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-content">Police et taille</p>
        <div className="flex flex-wrap gap-2">
          <label htmlFor={fontId} className="sr-only">
            Police par défaut
          </label>
          <select
            id={fontId}
            value={prefs.font}
            onChange={(e) => set({ font: e.target.value as FontId })}
            className="h-11 rounded-lg border border-line bg-canvas px-3 text-sm text-content"
          >
            {FONTS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
          <label htmlFor={sizeId} className="sr-only">
            Taille par défaut
          </label>
          <select
            id={sizeId}
            value={prefs.size}
            onChange={(e) => set({ size: Number(e.target.value) as FontSize })}
            className="h-11 rounded-lg border border-line bg-canvas px-3 text-sm text-content"
          >
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {s} px
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        {toggle('timestamps', 'Horodatages dans la marge')}
        {toggle('margin', 'Colonne de marge (horodatages)')}
      </div>

      <p aria-live="polite" className="text-xs text-content-muted">
        {saving.isPending ? 'Enregistrement…' : saving.isError ? '' : saving.isSuccess ? 'Enregistré' : ''}
      </p>
      {saving.isError && (
        <p role="alert" className="text-sm text-accent-red">
          L'enregistrement a échoué : tes réglages précédents sont gardés.
        </p>
      )}
    </div>
  )
}
