import { useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, Extension, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extensions'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import TextAlign from '@tiptap/extension-text-align'
import { FormattingToolbar } from '@/features/notes/FormattingToolbar'
import { LinkField } from '@/features/notes/LinkField'
import { EMPTY_DOC, isSafeHref, type NoteData, type NoteDoc } from '@/features/notes/noteDoc'
import { HighlightMark, TextColorMark, TextFontMark, TextSizeMark } from '@/features/notes/noteMarks'
import { NoteCodeBlock } from '@/features/notes/codeBlock'
import './note-editor.css'

export type { NoteData } from '@/features/notes/noteDoc'

const AUTOSAVE_DELAY = 1000
type Mode = 'edit' | 'preview'

/**
 * The editor may only produce what the server accepts, or a save would fail: StarterKit's code
 * block is replaced by NoteCodeBlock (YC-44), headings stop at level 3, links are http(s) or mailto. Ctrl+K calls `openLink`
 * through a ref, so the extensions are built once per editor.
 */
function buildExtensions(openLink: { current: () => void }) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      codeBlock: false,
      link: { openOnClick: false, autolink: true, defaultProtocol: 'https', isAllowedUri: (url) => isSafeHref(url) },
    }),
    Placeholder.configure({ placeholder: 'Écris tes notes… (# titre, - liste, **gras**, `code`)' }),
    // Code blocks with a language, line numbers and Copier (YC-44).
    NoteCodeBlock,
    // Task lists, nested, each box named for screen readers (YC-43).
    TaskList,
    TaskItem.configure({
      nested: true,
      a11y: { checkboxLabel: (node, checked) => `${checked ? 'Fait' : 'À faire'} : ${node.textContent || 'tâche vide'}` },
    }),
    // Ctrl+Maj+L/E/R/J come with the extension; the server keeps only these four values.
    TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right', 'justify'] }),
    // Colours, highlight, font and size store a name, never a CSS value (YC-42).
    TextColorMark,
    HighlightMark,
    TextFontMark,
    TextSizeMark,
    Extension.create({
      name: 'linkShortcut',
      addKeyboardShortcuts: () => ({
        'Mod-k': () => {
          openLink.current()
          return true
        },
      }),
    }),
  ]
}

interface NoteEditorProps {
  /** Titre du panneau (distingue note de vidéo / de playlist). */
  title: string
  /** Emoji/icône optionnelle devant le titre (distinction visuelle). */
  icon?: string
  /** Label accessible de la zone d'écriture. */
  editorLabel: string
  /** Note chargée (null si aucune, undefined si en cours de chargement). */
  note: NoteData | null | undefined
  isLoading: boolean
  /** Sauvegarde le document (déclenché par l'autosave). */
  onSave: (doc: NoteDoc) => void
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
 * Éditeur de note riche (YC-40, TipTap) : écriture, barre de mise en forme (YC-41), autosave
 * (debounce) et lecture seule.
 * Utilisé pour les notes de vidéo et de playlist. La page suit la maquette « Éditeur de notes ».
 */
export function NoteEditor({ title, icon, editorLabel, note, isLoading, onSave, isSaving, resetKey }: NoteEditorProps) {
  const [draft, setDraft] = useState<NoteDoc | null>(null)
  const [mode, setMode] = useState<Mode>('edit')
  // Which editor instance was seeded for which target: useEditor may destroy and recreate its
  // instance (Suspense, remounts), and a new instance must be seeded again or it stays empty.
  const seeded = useRef<{ editor: unknown; key: string } | null>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const openLink = useRef(() => setLinkOpen(true))
  const extensions = useMemo(() => buildExtensions(openLink), [])

  const editor = useEditor({
    extensions,
    content: EMPTY_DOC,
    editorProps: { attributes: { 'aria-label': editorLabel, 'aria-multiline': 'true', role: 'textbox' } },
    onUpdate: ({ editor }) => setDraft(editor.getJSON() as NoteDoc),
  })

  // Amorce l'éditeur quand la note de CETTE cible est chargée (une fois par cible et par instance).
  useEffect(() => {
    if (!editor || editor.isDestroyed || note === undefined) return
    if (seeded.current?.editor === editor && seeded.current.key === resetKey) return
    // Out of the history too: loading a note is not an edit the user can undo (the « Annuler »
    // tool was enabled on a note just opened, found by the YC-41 tests).
    editor.chain().setMeta('addToHistory', false).setContent(note?.doc ?? EMPTY_DOC, { emitUpdate: false }).run()
    seeded.current = { editor, key: resetKey }
    setDraft(null)
  }, [editor, note, resetKey])

  // setEditable emits an update by default, which would save a note merely opened (write on
  // read): toggling edition never changes the document, so no update is emitted.
  useEffect(() => {
    if (editor && !editor.isDestroyed) editor.setEditable(mode === 'edit' && !isLoading, false)
  }, [editor, mode, isLoading])

  // Sauvegarde automatique après 1 s sans frappe.
  useEffect(() => {
    if (!draft) return
    const timer = setTimeout(() => {
      onSave(draft)
      setDraft(null)
    }, AUTOSAVE_DELAY)
    return () => clearTimeout(timer)
  }, [draft, onSave])

  const savedTime = formatTime(note?.updatedAt)
  const status = isSaving ? 'Enregistrement…' : draft ? 'Modifié' : savedTime ? `Enregistré à ${savedTime}` : ''

  const tab = (m: Mode, label: string) => (
    <button
      type="button"
      aria-pressed={mode === m}
      onClick={() => setMode(m)}
      className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
        mode === m ? 'bg-brand-purple text-on-purple' : 'text-content-muted hover:bg-surface-2'
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

      <div className="yc-note mt-3">
        {editor && mode === 'edit' && (
          <div className="yc-note-tools">
            <FormattingToolbar editor={editor} onLink={() => setLinkOpen(true)} />
            {linkOpen && <LinkField editor={editor} onClose={() => setLinkOpen(false)} />}
          </div>
        )}
        <div className="yc-note-page">
          <EditorContent editor={editor} />
        </div>
      </div>
    </section>
  )
}
