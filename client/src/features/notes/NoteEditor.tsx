import { useEffect, useId, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { EditorContent, Extension, useEditor, useEditorState, type Editor } from '@tiptap/react'
import { Selection } from '@tiptap/pm/state'
import StarterKit from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extensions'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import TextAlign from '@tiptap/extension-text-align'
import { FormattingToolbar, Icon } from '@/features/notes/FormattingToolbar'
import { useModalDialog } from '@/features/notes/useModalDialog'
import collapseIcon from './icons/collapse.svg'
import closeIcon from './icons/note/fermer.svg'
import checkIcon from './icons/check.svg'
import { LinkField } from '@/features/notes/LinkField'
import { EMPTY_DOC, isSafeHref, type NoteData, type NoteDoc, type NoteSave } from '@/features/notes/noteDoc'
import { readPage, type NotePage } from '@/features/notes/notePage'
import { useNotePreferences } from '@/features/notes/useNotePreferences'
import { HighlightMark, TextColorMark, TextFontMark, TextSizeMark } from '@/features/notes/noteMarks'
import { NoteCodeBlock } from '@/features/notes/codeBlock'
import { MAX_MARKER_SECONDS, NoteMarker, canSetMarker } from '@/features/notes/noteMarker'
import { NoteSpacing } from '@/features/notes/noteSpacing'
import { NoteIcon } from '@/features/notes/noteIcon'
import { NoteImage } from '@/features/notes/noteImage'
import { ACCEPTED_IMAGES, imageProblem, uploadNoteImage } from '@/features/notes/noteImageUpload'
import { formatTimestamp } from '@/lib/format'
import { isTyping } from '@/lib/keyboard'
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
  onImageFiles: { current: (files: File[], at: number | null) => void },
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
    // Line height, space before and after, first-line indent of the paragraphs (YC-55).
    NoteSpacing,
    // Icons in the text, from the toolbar or « : » (YC-46).
    NoteIcon,
    // Images pasted, dropped or chosen (YC-50), stored by the API.
    NoteImage.configure({ onFiles: onImageFiles }),
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

/** What a page can do to the note from outside it (YC-60). */
export interface NoteActions {
  /**
   * Adds `text` as the last line of the note, timestamped at `seconds`, and saves it at once.
   * False when the note cannot take it yet (still loading); `done` tells what the server said.
   */
  appendMarkedLine(text: string, seconds: number, done: SaveCallbacks): boolean
}

interface SaveCallbacks {
  onSuccess?: () => void
  onError?: () => void
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
  onSave: (payload: NoteSave, callbacks?: SaveCallbacks) => void
  isSaving: boolean
  /** Change quand la cible change (videoId / playlistId) → ré-amorce le brouillon. */
  resetKey: string
  /**
   * The player of the video this note is about (YC-56): its position, and how to move it. Without
   * it (playlist notes) markers are shown but none can be added.
   */
  player?: { seconds: number; seek: (seconds: number) => void }
  /** What the expanded view shows above the note (YC-18): « FULLSTACK · VIDÉO 4 · 14:32 » and a title. */
  context?: { eyebrow?: string; heading: string }
  /** Filled with what a page can do to this note (the end card of the player, YC-60). */
  actions?: MutableRefObject<NoteActions | null>
}

/**
 * The expanded view of a note (YC-18) lives in the address, `?note=agrandie`: Retour closes it and
 * a shared link opens it. The history entry is pushed here, so closing goes back to it.
 */
const EXPANDED = 'agrandie'
const readExpanded = () => new URLSearchParams(window.location.search).get('note') === EXPANDED

function useExpandedView() {
  const [expanded, setExpanded] = useState(readExpanded)
  useEffect(() => {
    const onPop = () => setExpanded(readExpanded())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  const open = () => {
    const url = new URL(window.location.href)
    url.searchParams.set('note', EXPANDED)
    window.history.pushState({ ...window.history.state, ycNote: true }, '', url)
    setExpanded(true)
  }
  /** `after` runs once the address is back: the browser restores the scroll of that entry first. */
  const close = (after?: () => void) => {
    if (window.history.state?.ycNote) {
      if (after) window.addEventListener('popstate', () => after(), { once: true })
      window.history.back()
    } else {
      const url = new URL(window.location.href)
      url.searchParams.delete('note')
      window.history.replaceState(window.history.state, '', url)
      after?.()
    }
    setExpanded(false)
  }
  return { expanded, open, close }
}

interface Marker {
  seconds: number
  text: string
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
export function NoteEditor({
  title,
  icon,
  editorLabel,
  note,
  isLoading,
  onSave,
  isSaving,
  resetKey,
  player,
  context,
  actions,
}: NoteEditorProps) {
  const [draft, setDraft] = useState<NoteDoc | null>(null)
  // The page chosen here (YC-45) stays shown while it is saved; otherwise the stored one, or the
  // defaults. `pageDirty` only says an autosave is due.
  const [chosenPage, setChosenPage] = useState<NotePage | null>(null)
  const [pageDirty, setPageDirty] = useState(false)
  // A note not written yet starts with the account's settings (YC-48), as the server will store
  // them at its first save; an existing note shows its own page, whatever the settings are now.
  const { data: preferences } = useNotePreferences()
  const page = chosenPage ?? readPage(note === null ? preferences : note?.page)
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
  // Images (YC-50): sent one after the other, each inserted once the server has it.
  const [imageStatus, setImageStatus] = useState<{ sending: number; error: string | null }>({ sending: 0, error: null })
  const imageInput = useRef<HTMLInputElement>(null)
  // The editor alive when a file comes back from the server: useEditor may rebuild its instance
  // while a file is sent, and the one of an earlier render would then be destroyed.
  const liveEditor = useRef<Editor | null>(null)
  // Set ONCE: TipTap's configure() copies the { current } object it is given, so a function put
  // there later would never reach the extension (seen: a pasted image went nowhere).
  const onImageFiles = useRef((files: File[], at: number | null) => {
    const problems = files.map(imageProblem).filter((p): p is string => p !== null)
    const valid = files.filter((f) => imageProblem(f) === null)
    setImageStatus({ sending: valid.length, error: problems[0] ?? null })
    void (async () => {
      let position = at
      for (const file of valid) {
        try {
          const uploaded = await uploadNoteImage(file)
          const current = liveEditor.current
          if (!current || current.isDestroyed) return
          // The note may have changed while the file was sent: the drop point stays inside it.
          const where = position === null ? null : Math.min(position, current.state.doc.content.size)
          current.chain().focus().insertNoteImage({ id: uploaded.id }, where).run()
          // The next one goes after it, not over it.
          position = null
        } catch (err) {
          setImageStatus((s) => ({ ...s, error: (err as Error).message || `« ${file.name} » n'a pas pu être envoyée.` }))
        }
        setImageStatus((s) => ({ ...s, sending: Math.max(0, s.sending - 1) }))
      }
    })()
  })
  const extensions = useMemo(() => buildExtensions(openLink, addMarker, seek, onImageFiles), [])

  const editor = useEditor({
    extensions,
    content: EMPTY_DOC,
    editorProps: { attributes: { 'aria-label': editorLabel, 'aria-multiline': 'true', role: 'textbox' } },
    onUpdate: ({ editor }) => setDraft(editor.getJSON() as NoteDoc),
  })

  liveEditor.current = editor

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
      // M adds a marker only outside a field: in one, it is a letter.
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
    if (!editor || editor.isDestroyed) return
    const editable = mode === 'edit' && !isLoading
    if (editor.isEditable === editable) return
    editor.setEditable(editable, false)
    // An empty transaction (no change, out of the history) tells the blocks drawn by React (image,
    // code) that editing changed: without it the image bar stayed shown in « Aperçu » (YC-50).
    editor.view.dispatch(editor.state.tr.setMeta('addToHistory', false).setMeta('editable', editable))
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

  // The end card (YC-60) writes its sentence as the last line, timestamped, and it is saved at
  // once: an autosave still waiting would be lost if « Lire la suivante » changes the video.
  const latestSave = useRef({ page, pageDirty, onSave })
  latestSave.current = { page, pageDirty, onSave }
  useEffect(() => {
    if (!actions) return
    actions.current = {
      appendMarkedLine(text, seconds, done) {
        // Only into the note of THIS target, once it is loaded in the editor.
        if (!editor || editor.isDestroyed || seeded.current?.editor !== editor || seeded.current.key !== resetKey) return false
        const marker = Math.min(MAX_MARKER_SECONDS, Math.max(0, Math.floor(seconds)))
        const line = { type: 'paragraph', attrs: { marker }, content: [{ type: 'text', text }] }
        const { doc } = editor.state
        const last = doc.lastChild
        const end = doc.content.size
        // An empty last line (a note just opened ends with one) takes the sentence, no blank is left.
        const blank = last?.type.name === 'paragraph' && last.content.size === 0 && last.attrs.marker == null
        const at = blank && last ? { from: end - last.nodeSize, to: end } : end
        if (!editor.chain().insertContentAt(at, line).run()) return false
        const { page: current, pageDirty: dirty, onSave: save } = latestSave.current
        const json = editor.getJSON() as NoteDoc
        save(dirty ? { doc: json, page: current } : { doc: json }, {
          onSuccess: done.onSuccess,
          // Not lost: the autosave tries again, as for any edit.
          onError: () => {
            if (!editor.isDestroyed) setDraft(editor.getJSON() as NoteDoc)
            done.onError?.()
          },
        })
        setDraft(null)
        setPageDirty(false)
        return true
      },
    }
    return () => {
      actions.current = null
    }
  }, [actions, editor, resetKey])

  // The expanded view (YC-18): the same editor, in a modal; nothing below is mounted twice.
  const view = useExpandedView()
  const expanded = view.expanded
  const sectionRef = useRef<HTMLElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const onDialogKeyDown = useModalDialog(expanded, dialogRef, () => closeView())
  const wasExpanded = useRef(expanded)
  useEffect(() => {
    if (expanded === wasExpanded.current) return
    wasExpanded.current = expanded
    if (!editor || editor.isDestroyed) return
    // Synchronous focus: TipTap's focus() lands a frame later, and would take the focus back
    // from « Agrandir » if the view is closed at once (seen in the tests).
    if (expanded) editor.view.focus()
    else sectionRef.current?.querySelector<HTMLElement>('.yc-tool-expand')?.focus({ preventScroll: true })
  }, [expanded, editor])
  // Back to the note at its normal size, at the same place of the text; or, after a marker or
  // « Reprendre », up to the player. By hand: TipTap's scrollIntoView takes the focus back.
  const closeView = (revealPlayer = false) =>
    // A frame later: the browser restores the scroll of the history entry after « popstate » (seen
    // in Chrome: a scroll done in the handler itself was undone).
    view.close(() => requestAnimationFrame(() => afterClose(revealPlayer)))
  const afterClose = (revealPlayer: boolean) => {
    if (revealPlayer) return window.scrollTo({ top: 0, behavior: 'smooth' })
    if (!editor || editor.isDestroyed) return
    try {
      const caret = editor.view.coordsAtPos(editor.state.selection.from)
      window.scrollBy({ top: caret.top - window.innerHeight / 2 })
    } catch {
      sectionRef.current?.scrollIntoView({ block: 'nearest' })
    }
  }
  // The markers of the note, in time order, for the side panel.
  const markers =
    useEditorState({
      editor,
      selector: ({ editor: e }) => {
        const found: Marker[] = []
        e?.state.doc.descendants((node) => {
          if (typeof node.attrs.marker === 'number') found.push({ seconds: node.attrs.marker, text: node.textContent.trim() })
          return true
        })
        return found.sort((a, b) => a.seconds - b.seconds)
      },
    }) ?? []
  const playing = player ? markers.reduce((at, m, i) => (m.seconds <= player.seconds ? i : at), -1) : -1
  // A marker or « Reprendre » closes the view and plays the video there (Ronaldo, 01/10).
  const jump = (seconds: number) => {
    closeView(true)
    player?.seek(seconds)
  }

  // « Exporter en .docx » (YC-49): what the editor holds, built and downloaded here. The library
  // (and the converter) load on the first click only.
  const [exporting, setExporting] = useState<'idle' | 'busy' | 'failed'>('idle')
  const exportDocx = async () => {
    if (!editor || editor.isDestroyed || exporting === 'busy') return
    setExporting('busy')
    try {
      const { noteToDocx, docxFileName } = await import('@/features/notes/noteToDocx')
      const heading = context?.heading ?? title
      const blob = await noteToDocx(editor.getJSON() as NoteDoc, { eyebrow: context?.eyebrow, title: heading, page })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = docxFileName(heading)
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setExporting('idle')
    } catch {
      setExporting('failed')
    }
  }

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

  const smallHeader = (
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
  )

  // Figma « Note agrandie » 53:705: where the note comes from, its title, the save status.
  const bigHeader = (
    <div className="yc-x-head">
      <div className="yc-x-title">
        {context?.eyebrow && <p className="yc-x-eyebrow">{context.eyebrow}</p>}
        <h2 id={titleId} className="yc-x-heading">
          {context?.heading ?? title}
        </h2>
        <p aria-live="polite" className="yc-x-status" data-saved={status.startsWith('Enregistré à') || undefined}>
          {/* The tick says « saved »: never in front of « Modifié » or « Enregistrement… ». */}
          {status.startsWith('Enregistré à') && <Icon src={checkIcon} size={16} />}
          {[status, player ? `${markers.length} repère${markers.length > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ')}
        </p>
        {exporting === 'failed' && (
          <p role="alert" className="yc-x-error">
            L'export a échoué. Réessaie : ta note n'a pas bougé.
          </p>
        )}
      </div>
      <div className="yc-x-actions">
        <div role="group" aria-label="Lire ou modifier" className="yc-x-segment">
          <button type="button" aria-pressed={mode === 'preview'} onClick={() => setMode('preview')}>
            Lire
          </button>
          <button type="button" aria-pressed={mode === 'edit'} onClick={() => setMode('edit')}>
            Modifier
          </button>
        </div>
        <button type="button" className="yc-x-export" aria-busy={exporting === 'busy' || undefined} onClick={exportDocx}>
          {exporting === 'busy' ? 'Export…' : 'Exporter en .docx'}
        </button>
        <button type="button" className="yc-x-icon" aria-label="Réduire (revenir à la note)" title="Réduire" onClick={() => closeView()}>
          <Icon src={collapseIcon} size={20} />
        </button>
        <button type="button" className="yc-x-icon" aria-label="Fermer (Échap)" title="Fermer" onClick={() => closeView()}>
          <Icon src={closeIcon} size={20} />
        </button>
      </div>
    </div>
  )

  // Figma 53:1007: the markers to jump to, which are seen, which one is playing; « Reprendre ».
  const side = player && (
    <aside aria-label="Repères" className="yc-x-side">
      <div className="yc-x-markers-card">
        <h3 className="yc-x-side-title">Repères</h3>
        {markers.length ? (
          <ul className="yc-x-markers">
            {markers.map((m, i) => {
              const state = i < playing ? 'vu' : i === playing ? 'en-cours' : undefined
              return (
                <li key={`${m.seconds}-${i}`}>
                  <button type="button" className="yc-x-marker" data-state={state} onClick={() => jump(m.seconds)}>
                    <span className="yc-x-pill">{formatTimestamp(m.seconds)}</span>
                    <span className="yc-x-marker-text">{m.text || 'Ligne vide'}</span>
                    {state === 'vu' && <span className="yc-x-marker-state">✓ vu</span>}
                    {state === 'en-cours' && <span className="yc-x-marker-state">● en cours</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="yc-x-empty">Aucun repère : M ou « + Repère » en pose un sur la ligne du curseur.</p>
        )}
      </div>
      <button type="button" className="yc-x-resume" onClick={() => jump(player.seconds)}>
        Reprendre à {formatTimestamp(player.seconds)}
      </button>
      <p className="yc-x-help">Un clic sur un repère ouvre la vidéo à cet instant. Échap ferme.</p>
    </aside>
  )

  // The same tree open or not (wrappers in `display: contents` when inline): the editor is never
  // remounted, so a text typed less than a second ago, not saved yet, is never lost.
  return (
    <section ref={sectionRef} aria-label={title} className={expanded ? 'yc-x-layer' : 'rounded-card border border-line bg-canvas p-4'}>
      {expanded && <div className="yc-x-veil" aria-hidden="true" onClick={() => closeView()} />}
      <div
        ref={dialogRef}
        role={expanded ? 'dialog' : undefined}
        aria-modal={expanded || undefined}
        aria-labelledby={expanded ? titleId : undefined}
        className={expanded ? 'yc-x-dialog yc-note' : 'yc-x-inline'}
        onKeyDown={onDialogKeyDown}
      >
        {expanded ? bigHeader : smallHeader}
        <div className={expanded ? 'yc-x-body' : 'yc-x-inline'}>
          <div className="yc-note mt-3">
            {editor && mode === 'edit' && (
              <div className="yc-note-tools">
                <FormattingToolbar
                  editor={editor}
                  onLink={() => setLinkOpen(true)}
                  page={page}
                  onPageChange={choosePage}
                  onMarker={player ? () => addMarker.current() : undefined}
                  onImage={() => imageInput.current?.click()}
                  onExpand={expanded ? () => closeView() : view.open}
                  expanded={expanded}
                />
                <input
                  ref={imageInput}
                  type="file"
                  accept={ACCEPTED_IMAGES}
                  multiple
                  hidden
                  data-testid="note-image-input"
                  onChange={(e) => {
                    onImageFiles.current([...(e.target.files ?? [])], null)
                    e.target.value = ''
                  }}
                />
                {linkOpen && <LinkField editor={editor} onClose={() => setLinkOpen(false)} />}
                {imageStatus.sending > 0 && (
                  <p aria-live="polite" className="yc-image-status">
                    Envoi de {imageStatus.sending > 1 ? `${imageStatus.sending} images` : "l'image"}…
                  </p>
                )}
                {imageStatus.error && (
                  <p role="alert" className="yc-image-status yc-image-status-error">
                    {imageStatus.error}{' '}
                    <button type="button" onClick={() => setImageStatus((s) => ({ ...s, error: null }))}>
                      OK
                    </button>
                  </p>
                )}
              </div>
            )}
            <div
              className="yc-note-page"
              data-paper={page.paper}
              data-tint={page.tint}
              data-margin={page.margin ? 'true' : 'false'}
              data-timestamps={page.timestamps ? 'true' : 'false'}
              data-font={page.font}
              data-base-size={page.size}
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
          {expanded && side}
        </div>
      </div>
    </section>
  )
}
