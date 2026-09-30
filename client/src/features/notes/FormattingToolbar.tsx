import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { useEditorState, type Editor } from '@tiptap/react'
import undoIcon from './icons/undo.svg'
import redoIcon from './icons/redo.svg'
import chevronIcon from './icons/chevron-down.svg'
import checkIcon from './icons/check.svg'
import bulletListIcon from './icons/bullet-list.svg'
import orderedListIcon from './icons/ordered-list.svg'
import linkIcon from './icons/link.svg'
import quoteIcon from './icons/quote.svg'
import codeIcon from './icons/code.svg'
import clearFormatIcon from './icons/clear-format.svg'
import dividerIcon from './icons/divider.svg'

/**
 * Formatting toolbar of the note editor (YC-41), from Figma « Barre de mise en forme » (32:365)
 * and « Menu de l'éditeur › Styles » (33:250). Only the tools that work are shown; the others
 * (colours, fonts, alignment, blocks, page) arrive with their own tickets (YC-42 to YC-54).
 *
 * One tab stop: arrows, Home and End move inside the toolbar (WAI-ARIA toolbar pattern).
 */

/** An icon drawn with the Figma SVG as a mask, so it follows the text colour (light and dark). */
function Icon({ src, size = 24 }: { src: string; size?: number }) {
  return <span aria-hidden="true" className="yc-tool-icon" style={{ '--icon': `url("${src}")`, '--size': `${size}px` } as CSSProperties} />
}

interface ToolProps {
  label: string
  onRun: () => void
  pressed?: boolean
  disabled?: boolean
  children: ReactNode
}

function Tool({ label, onRun, pressed, disabled, children }: ToolProps) {
  return (
    <button
      type="button"
      className="yc-tool"
      data-tool=""
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      aria-disabled={disabled || undefined}
      tabIndex={-1}
      // Keep the selection in the editor: a click on the toolbar must not blur it.
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        if (!disabled) onRun()
      }}
    >
      {children}
    </button>
  )
}

type Style = 'h1' | 'h2' | 'h3' | 'paragraph' | 'quote'

const STYLES: { id: Style; label: string; shortcut?: string }[] = [
  { id: 'h1', label: 'Titre 1', shortcut: 'Ctrl+Alt+1' },
  { id: 'h2', label: 'Titre 2', shortcut: 'Ctrl+Alt+2' },
  { id: 'h3', label: 'Titre 3', shortcut: 'Ctrl+Alt+3' },
  { id: 'paragraph', label: 'Paragraphe', shortcut: 'Ctrl+Alt+0' },
  { id: 'quote', label: 'Citation' },
]

function applyStyle(editor: Editor, style: Style) {
  let chain = editor.chain().focus()
  if (style === 'quote') {
    if (!editor.isActive('blockquote')) chain.setParagraph().setBlockquote().run()
    return
  }
  // A style replaces the quote, as in a word processor: the paragraph leaves it first.
  if (editor.isActive('blockquote')) chain = chain.lift('blockquote')
  if (style === 'paragraph') chain.setParagraph().run()
  else chain.setHeading({ level: Number(style[1]) as 1 | 2 | 3 }).run()
}

function StyleMenu({ editor, current }: { editor: Editor; current: Style }) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const currentLabel = STYLES.find((s) => s.id === current)?.label ?? 'Paragraphe'

  const close = (focusButton: boolean) => {
    setOpen(false)
    if (focusButton) buttonRef.current?.focus()
  }

  // Opening puts the focus on the current style; a click outside closes the menu.
  useEffect(() => {
    if (!open) return
    menuRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus()
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const onMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])
    const index = items.indexOf(document.activeElement as HTMLElement)
    const move = (to: number) => items[(to + items.length) % items.length]?.focus()
    if (e.key === 'ArrowDown') move(index + 1)
    else if (e.key === 'ArrowUp') move(index - 1)
    else if (e.key === 'Home') move(0)
    else if (e.key === 'End') move(items.length - 1)
    else if (e.key === 'Escape') close(true)
    else if (e.key === 'Tab') setOpen(false)
    else return
    if (e.key !== 'Tab') {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  return (
    <div className="yc-menu-anchor">
      <button
        ref={buttonRef}
        type="button"
        className="yc-select"
        data-tool=""
        tabIndex={-1}
        aria-label={`Style de paragraphe : ${currentLabel}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault()
            setOpen(true)
          }
        }}
      >
        <span>{currentLabel}</span>
        <Icon src={chevronIcon} size={18} />
      </button>
      {open && (
        <div ref={menuRef} id={menuId} role="menu" aria-label="Style de paragraphe" className="yc-menu" onKeyDown={onMenuKeyDown}>
          <p aria-hidden="true" className="yc-menu-label">
            STYLE DE PARAGRAPHE
          </p>
          {STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              role="menuitemradio"
              aria-checked={s.id === current}
              tabIndex={-1}
              className={`yc-menu-item yc-style-${s.id}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                applyStyle(editor, s.id)
                setOpen(false)
              }}
            >
              <span className="yc-menu-item-label">{s.label}</span>
              {s.shortcut && <kbd className="yc-menu-shortcut">{s.shortcut}</kbd>}
              {s.id === current && <Icon src={checkIcon} size={18} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface FormattingToolbarProps {
  editor: Editor
  /** Opens the link field (also bound to Ctrl+K in the editor). */
  onLink: () => void
}

export function FormattingToolbar({ editor, onLink }: FormattingToolbarProps) {
  const ref = useRef<HTMLDivElement>(null)
  // The toolbar re-renders only when a state it shows changes, not on every keystroke.
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      style: (e.isActive('blockquote')
        ? 'quote'
        : e.isActive('heading', { level: 1 })
          ? 'h1'
          : e.isActive('heading', { level: 2 })
            ? 'h2'
            : e.isActive('heading', { level: 3 })
              ? 'h3'
              : 'paragraph') as Style,
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      code: e.isActive('code'),
      link: e.isActive('link'),
      bulletList: e.isActive('bulletList'),
      orderedList: e.isActive('orderedList'),
      quote: e.isActive('blockquote'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  })

  // Roving tab stop: exactly one tool is reachable with Tab, the last one used.
  useEffect(() => {
    const tools = ref.current?.querySelectorAll<HTMLElement>('[data-tool]')
    if (tools && !Array.from(tools).some((t) => t.tabIndex === 0)) tools[0]?.setAttribute('tabindex', '0')
  })

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
    if ((e.target as HTMLElement).closest('[role="menu"]')) return
    const tools = Array.from(ref.current?.querySelectorAll<HTMLElement>('[data-tool]') ?? [])
    const index = tools.indexOf(document.activeElement as HTMLElement)
    if (index < 0) return
    const next =
      e.key === 'Home' ? 0 : e.key === 'End' ? tools.length - 1 : (index + (e.key === 'ArrowRight' ? 1 : -1) + tools.length) % tools.length
    e.preventDefault()
    tools[index].tabIndex = -1
    tools[next].tabIndex = 0
    tools[next].focus()
  }

  const run = (fn: (chain: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>) => () => fn(editor.chain().focus()).run()

  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label="Mise en forme"
      className="yc-toolbar"
      onKeyDown={onKeyDown}
      onFocus={(e) => {
        // The focused tool becomes the tab stop.
        if (!(e.target as HTMLElement).hasAttribute('data-tool')) return
        ref.current?.querySelectorAll<HTMLElement>('[data-tool]').forEach((t) => (t.tabIndex = t === e.target ? 0 : -1))
      }}
    >
      <div role="group" aria-label="Historique" className="yc-tool-group">
        <Tool label="Annuler (Ctrl+Z)" disabled={!state.canUndo} onRun={run((c) => c.undo())}>
          <Icon src={undoIcon} />
        </Tool>
        <Tool label="Rétablir (Ctrl+Y)" disabled={!state.canRedo} onRun={run((c) => c.redo())}>
          <Icon src={redoIcon} />
        </Tool>
      </div>

      <div role="group" aria-label="Style" className="yc-tool-group">
        <StyleMenu editor={editor} current={state.style} />
      </div>

      <div role="group" aria-label="Caractères" className="yc-tool-group">
        <Tool label="Gras (Ctrl+B)" pressed={state.bold} onRun={run((c) => c.toggleBold())}>
          <span className="yc-glyph yc-glyph-bold">B</span>
        </Tool>
        <Tool label="Italique (Ctrl+I)" pressed={state.italic} onRun={run((c) => c.toggleItalic())}>
          <span className="yc-glyph yc-glyph-italic">I</span>
        </Tool>
        <Tool label="Souligné (Ctrl+U)" pressed={state.underline} onRun={run((c) => c.toggleUnderline())}>
          <span className="yc-glyph yc-glyph-underline">U</span>
        </Tool>
        <Tool label="Barré (Ctrl+Maj+S)" pressed={state.strike} onRun={run((c) => c.toggleStrike())}>
          <span className="yc-glyph yc-glyph-strike">S</span>
        </Tool>
      </div>

      <div role="group" aria-label="Listes" className="yc-tool-group">
        <Tool label="Liste à puces (Ctrl+Maj+8)" pressed={state.bulletList} onRun={run((c) => c.toggleBulletList())}>
          <Icon src={bulletListIcon} />
        </Tool>
        <Tool label="Liste numérotée (Ctrl+Maj+7)" pressed={state.orderedList} onRun={run((c) => c.toggleOrderedList())}>
          <Icon src={orderedListIcon} />
        </Tool>
      </div>

      <div role="group" aria-label="Insertion" className="yc-tool-group">
        <Tool label="Lien (Ctrl+K)" pressed={state.link} onRun={onLink}>
          <Icon src={linkIcon} />
        </Tool>
        <Tool label="Citation (Ctrl+Maj+B)" pressed={state.quote} onRun={run((c) => c.toggleBlockquote())}>
          <Icon src={quoteIcon} />
        </Tool>
        <Tool label="Code en ligne (Ctrl+E)" pressed={state.code} onRun={run((c) => c.toggleCode())}>
          <Icon src={codeIcon} />
        </Tool>
        <Tool label="Effacer la mise en forme" onRun={run((c) => c.unsetAllMarks().clearNodes())}>
          <Icon src={clearFormatIcon} />
        </Tool>
      </div>

      <div role="group" aria-label="Blocs" className="yc-tool-group">
        <Tool label="Insérer un séparateur" onRun={run((c) => c.setHorizontalRule())}>
          <Icon src={dividerIcon} />
        </Tool>
      </div>
    </div>
  )
}
