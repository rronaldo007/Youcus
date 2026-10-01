import { useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, Extension, useEditor, useEditorState } from '@tiptap/react'
import { Selection } from '@tiptap/pm/state'
import StarterKit from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extensions'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import TextAlign from '@tiptap/extension-text-align'
import { FormattingToolbar } from '@/features/notes/FormattingToolbar'
import { LinkField } from '@/features/notes/LinkField'
import { EMPTY_DOC, isSafeHref, type NoteData, type NoteDoc, type NoteSave } from '@/features/notes/noteDoc'
import { readPage, type NotePage } from '@/features/notes/notePage'
import { HighlightMark, TextColorMark, TextFontMark, TextSizeMark } from '@/features/notes/noteMarks'
import { NoteCodeBlock } from '@/features/notes/codeBlock'
import { NoteMarker, canSetMarker } from '@/features/notes/noteMarker'
import { formatTimestamp } from '@/lib/format'
import './note-editor.css'

export type { NoteData } from '@/features/notes/noteDoc'

const AUTOSAVE_DELAY = 1000
type Mode = 'edit' | 'preview'

/**
 * The editor may only produce what the server accepts, or a save would fail: StarterKit's code
 * block is replaced by NoteCodeBlock (YC-44), headings stop at level 3, links are http(s) or mailto. Ctrl+K calls `openLink`
 * and Ctrl+Alt+M `addMarker` through refs, so the extensions are built once per editor.
 */
function buildExtensions(
  openLink: { current: () => void },
  addMarker: { current: () => boolean },
  seek: { current: (seconds: number) => void },
) {
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
    // Timestamped markers on the lines, clicked to jump in the video (YC-56).
    NoteMarker.configure({ onSeek: seek }),
    Extension.create({
      name: 'linkShortcut',
      addKeyboardShortcuts: () => ({
        'Mod-k': () => {
          openLink.current()
          return true
        },
        'Mod-Alt-m': () => addMarker.current(),
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
  /** Sauvegarde le document, et la page quand elle a changé (déclenché par l'autosave). */
  onSave: (payload: NoteSave) => void
  isSaving: boolean
  /** Change quand la cible change (videoId / playlistId) → ré-amorce le brouillon. */
  resetKey: string
  /**
   * The player of the video this note is about (YC-56): its position, and how to move it. Without
   * it (playlist notes) markers are shown but none can be added.
   */
  player?: { seconds: number; seek: (seconds: number) => void }
}

/** M adds a marker only outside a field: in one, it is a letter. */
function isTyping(target: EventTarget | null) {
  if (!(target instanceof Element)) return false
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || !!target.closest('[contenteditable]:not([contenteditable="false"])')
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
export function NoteEditor({ title, icon, editorLabel, note, isLoading, onSave, isSaving, resetKey, player }: NoteEditorProps) {
  const [draft, setDraft] = useState<NoteDoc | null>(null)
  // The page chosen here (YC-45) stays shown while it is saved; otherwise the stored one, or the
  // defaults. `pageDirty` only says an autosave is due.
  const [chosenPage, setChosenPage] = useState<NotePage | null>(null)
  const [pageDirty, setPageDirty] = useState(false)
  const page = chosenPage ?? readPage(note?.page)
  const choosePage = (next: NotePage) => {
    setChosenPage(next)
    setPageDirty(true)
  }
  const [mode, setMode] = useState<Mode>('edit')
  // Which editor instance was seeded for which target: useEditor may destroy and recreate its
  // instance (Suspense, remounts), and a new instance must be seeded again or it stays empty.
  const seeded = useRef<{ editor: unknown; key: string } | null>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const openLink = useRef(() => setLinkOpen(true))
  // Markers (YC-56) read the player at the moment they are used, through refs: the editor and its
  // extensions are built once, the position changes every second.
  const playerRef = useRef(player)
  playerRef.current = player
  const addMarker = useRef<() => boolean>(() => false)
  const seek = useRef((seconds: number) => playerRef.current?.seek(seconds))
  const extensions = useMemo(() => buildExtensions(openLink, addMarker, seek), [])

  const editor = useEditor({
    extensions,
    content: EMPTY_DOC,
    editorProps: { attributes: { 'aria-label': editorLabel, 'aria-multiline': 'true', role: 'textbox' } },
    onUpdate: ({ editor }) => setDraft(editor.getJSON() as NoteDoc),
  })

  addMarker.current = () => {
    const current = playerRef.current
    if (!current || !editor || editor.isDestroyed || mode !== 'edit') return false
    return editor.chain().focus().setMarker(current.seconds).run()
  }
  const canMark = useEditorState({ editor, selector: ({ editor: e }) => !!e && canSetMarker(e) }) ?? false

  // M outside any field adds a marker at the line the cursor was left on (Figma 34:510).
  const hasPlayer = player !== undefined
  useEffect(() => {
    if (!hasPlayer) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'm' || e.ctrlKey || e.altKey || e.metaKey || e.repeat || isTyping(e.target)) return
      if (addMarker.current()) e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hasPlayer])

  // Amorce l'éditeur quand la note de CETTE cible est chargée (une fois par cible et par instance).
  useEffect(() => {
    if (!editor || editor.isDestroyed || note === undefined) return
    if (seeded.current?.editor === editor && seeded.current.key === resetKey) return
    // Out of the history too: loading a note is not an edit the user can undo (the « Annuler »
    // tool was enabled on a note just opened, found by the YC-41 tests).
    // The cursor then goes to the end of the note, where writing goes on: setContent leaves the
    // whole document selected, on no line, and a marker (YC-56) needs one.
    editor
      .chain()
      .setMeta('addToHistory', false)
      .setContent(note?.doc ?? EMPTY_DOC, { emitUpdate: false })
      .command(({ tr }) => {
        tr.setSelection(Selection.atEnd(tr.doc))
        return true
      })
      .run()
    seeded.current = { editor, key: resetKey }
    setDraft(null)
    setChosenPage(null)
    setPageDirty(false)
  }, [editor, note, resetKey])

  // setEditable emits an update by default, which would save a note merely opened (write on
  // read): toggling edition never changes the document, so no update is emitted.
  useEffect(() => {
    if (editor && !editor.isDestroyed) editor.setEditable(mode === 'edit' && !isLoading, false)
  }, [editor, mode, isLoading])

  // Sauvegarde automatique après 1 s sans frappe ; un changement de page s'enregistre de même.
  useEffect(() => {
    if (!draft && !pageDirty) return
    const timer = setTimeout(() => {
      const doc = draft ?? (editor && !editor.isDestroyed ? (editor.getJSON() as NoteDoc) : null)
      if (doc) onSave(pageDirty ? { doc, page } : { doc })
      setDraft(null)
      setPageDirty(false)
    }, AUTOSAVE_DELAY)
    return () => clearTimeout(timer)
  }, [draft, pageDirty, page, onSave, editor])

  const savedTime = formatTime(note?.updatedAt)
  const status = isSaving ? 'Enregistrement…' : draft || pageDirty ? 'Modifié' : savedTime ? `Enregistré à ${savedTime}` : ''

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
            <FormattingToolbar
              editor={editor}
              onLink={() => setLinkOpen(true)}
              page={page}
              onPageChange={choosePage}
              onMarker={player ? () => addMarker.current() : undefined}
            />
            {linkOpen && <LinkField editor={editor} onClose={() => setLinkOpen(false)} />}
          </div>
        )}
        <div
          className="yc-note-page"
          data-paper={page.paper}
          data-tint={page.tint}
          data-margin={page.margin ? 'true' : 'false'}
          data-timestamps={page.timestamps ? 'true' : 'false'}
        >
          <EditorContent editor={editor} />
        </div>
        {player && mode === 'edit' && (
          <div className="yc-marker-bar">
            <button
              type="button"
              className="yc-marker-add"
              disabled={!canMark}
              title={canMark ? undefined : 'Place le curseur sur une ligne de texte'}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addMarker.current()}
            >
              + Repère à {formatTimestamp(player.seconds)}
            </button>
            {page.margin && <span className="yc-marker-hint">Dans la marge · touche M</span>}
          </div>
        )}
      </div>
    </section>
  )
}
