import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { useEditorState, type Editor } from '@tiptap/react'
import { ToolMenu } from '@/features/notes/ToolMenu'
import {
  COLOR_LABELS,
  DEFAULT_COLOR,
  DEFAULT_FONT,
  DEFAULT_SIZE,
  FONTS,
  HIGHLIGHTS,
  SIZES,
  TEXT_COLORS,
  type FontId,
  type FontSize,
  type Highlight,
  type TextColor,
} from '@/features/notes/noteMarks'
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
import codeBlockIcon from './icons/code-block.svg'
import textColorIcon from './icons/text-color.svg'
import highlighterIcon from './icons/highlighter.svg'
import taskListIcon from './icons/task-list.svg'
import outdentIcon from './icons/outdent.svg'
import indentIcon from './icons/indent.svg'
import alignLeftIcon from './icons/align-left.svg'
import alignCenterIcon from './icons/align-center.svg'
import alignRightIcon from './icons/align-right.svg'
import alignJustifyIcon from './icons/align-justify.svg'

/**
 * Formatting toolbar of the note editor (YC-41, YC-42, YC-43), from Figma « Barre de mise en forme »
 * (32:365) and « Menu de l'éditeur » (33:2774: Styles, Polices, Couleurs, Alignement). Only the
 * tools that work are shown; the others (paper, line spacing, blocks, page) arrive with their tickets.
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
  className?: string
  children: ReactNode
}

function Tool({ label, onRun, pressed, disabled, className = 'yc-tool', children }: ToolProps) {
  return (
    <button
      type="button"
      className={className}
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

/** A menu entry: keeps the editor selection, runs, and closes the menu unless told to stay. */
function MenuItem({
  label,
  checked,
  className = 'yc-menu-item',
  ariaLabel,
  onSelect,
  children,
}: {
  label?: string
  checked?: boolean
  className?: string
  ariaLabel?: string
  onSelect: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role={checked === undefined ? 'menuitem' : 'menuitemradio'}
      aria-checked={checked}
      aria-label={ariaLabel}
      title={ariaLabel ?? label}
      tabIndex={-1}
      className={className}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onSelect}
    >
      {children}
    </button>
  )
}

type Style = 'h1' | 'h2' | 'h3' | 'paragraph' | 'quote' | 'code'

const STYLES: { id: Style; label: string; shortcut?: string }[] = [
  { id: 'h1', label: 'Titre 1', shortcut: 'Ctrl+Alt+1' },
  { id: 'h2', label: 'Titre 2', shortcut: 'Ctrl+Alt+2' },
  { id: 'h3', label: 'Titre 3', shortcut: 'Ctrl+Alt+3' },
  { id: 'paragraph', label: 'Paragraphe', shortcut: 'Ctrl+Alt+0' },
  { id: 'quote', label: 'Citation' },
  { id: 'code', label: 'Bloc de code', shortcut: '```' },
]

function applyStyle(editor: Editor, style: Style) {
  let chain = editor.chain().focus()
  if (style === 'code') {
    if (!editor.isActive('codeBlock')) chain.setCodeBlock().run()
    return
  }
  if (style === 'quote') {
    if (!editor.isActive('blockquote')) chain.setParagraph().setBlockquote().run()
    return
  }
  // A style replaces the quote, as in a word processor: the paragraph leaves it first.
  if (editor.isActive('blockquote')) chain = chain.lift('blockquote')
  if (style === 'paragraph') chain.setParagraph().run()
  else chain.setHeading({ level: Number(style[1]) as 1 | 2 | 3 }).run()
}

type Align = 'left' | 'center' | 'right' | 'justify'

const ALIGNS: { id: Align; label: string; shortcut: string; icon: string }[] = [
  { id: 'left', label: 'À gauche', shortcut: 'Ctrl+Maj+L', icon: alignLeftIcon },
  { id: 'center', label: 'Centré', shortcut: 'Ctrl+Maj+E', icon: alignCenterIcon },
  { id: 'right', label: 'À droite', shortcut: 'Ctrl+Maj+R', icon: alignRightIcon },
  { id: 'justify', label: 'Justifié', shortcut: 'Ctrl+Maj+J', icon: alignJustifyIcon },
]

/** The list item the cursor is in, the nearest one: indenting acts on it (bullet, numbered or task). */
function currentItem(editor: Editor): 'listItem' | 'taskItem' | null {
  const { $from } = editor.state.selection
  for (let d = $from.depth; d > 0; d--) {
    const name = $from.node(d).type.name
    if (name === 'listItem' || name === 'taskItem') return name
  }
  return null
}

/** Sets a named mark, or removes it when the value is the default (plain text stores nothing). */
function setNamed(editor: Editor, mark: string, attrs: Record<string, unknown>, isDefault: boolean) {
  const chain = editor.chain().focus()
  if (isDefault) chain.unsetMark(mark).run()
  else chain.setMark(mark, attrs).run()
}

interface FormattingToolbarProps {
  editor: Editor
  /** Opens the link field (also bound to Ctrl+K in the editor). */
  onLink: () => void
}

export function FormattingToolbar({ editor, onLink }: FormattingToolbarProps) {
  const ref = useRef<HTMLDivElement>(null)
  // The colour tools reapply the last colour chosen in one click (Figma « Outil couleur », 31:88).
  const [lastColor, setLastColor] = useState<TextColor>('rouge')
  const [lastHighlight, setLastHighlight] = useState<Highlight>('jaune')

  // The toolbar re-renders only when a state it shows changes, not on every keystroke.
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      style: (e.isActive('codeBlock')
        ? 'code'
        : e.isActive('blockquote')
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
      taskList: e.isActive('taskList'),
      align: ((['center', 'right', 'justify'] as const).find((a) => e.isActive({ textAlign: a })) ?? 'left') as Align,
      canSink: (() => {
        const item = currentItem(e)
        return !!item && e.can().sinkListItem(item)
      })(),
      canLift: (() => {
        const item = currentItem(e)
        return !!item && e.can().liftListItem(item)
      })(),
      quote: e.isActive('blockquote'),
      codeBlock: e.isActive('codeBlock'),
      color: ((e.getAttributes('textColor').color as TextColor | undefined) ?? DEFAULT_COLOR) as TextColor,
      highlight: (e.getAttributes('highlight').color as Highlight | undefined) ?? null,
      font: ((e.getAttributes('textFont').font as FontId | undefined) ?? DEFAULT_FONT) as FontId,
      size: ((e.getAttributes('textSize').size as FontSize | undefined) ?? DEFAULT_SIZE) as FontSize,
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

  const applyColor = (color: TextColor) => {
    setNamed(editor, 'textColor', { color }, color === DEFAULT_COLOR)
    if (color !== DEFAULT_COLOR) setLastColor(color)
  }
  const applyHighlight = (color: Highlight | null) => {
    setNamed(editor, 'highlight', { color }, color === null)
    if (color) setLastHighlight(color)
  }
  const applyFont = (font: FontId) => setNamed(editor, 'textFont', { font }, font === DEFAULT_FONT)
  const applySize = (size: FontSize) => setNamed(editor, 'textSize', { size }, size === DEFAULT_SIZE)
  const stepSize = (step: 1 | -1) => {
    const next = SIZES[SIZES.indexOf(state.size) + step]
    if (next) applySize(next)
  }

  const styleLabel = STYLES.find((s) => s.id === state.style)?.label ?? 'Paragraphe'
  const fontLabel = FONTS.find((f) => f.id === state.font)?.label ?? 'Hanken Grotesk'

  /** Both colour tools open the same menu (33:207); each puts the focus in its own section. */
  const colorMenu = (focus: 'text' | 'highlight') => (
    <ToolMenu
      buttonLabel={focus === 'text' ? 'Choisir la couleur du texte' : 'Choisir le surlignage'}
      buttonClassName="yc-tool yc-tool-chevron"
      buttonContent={<Icon src={chevronIcon} size={16} />}
      menuLabel="Couleurs"
      menuClassName="yc-menu-colors"
      initialFocus={focus === 'text' ? '[data-section="text"] [aria-checked="true"]' : '[data-section="highlight"] [aria-checked="true"]'}
    >
      {(close) => (
        <>
          <p aria-hidden="true" className="yc-menu-label">
            COULEUR DU TEXTE
          </p>
          <div className="yc-swatches" data-section="text">
            {TEXT_COLORS.map((c) => (
              <MenuItem
                key={c}
                ariaLabel={`Texte ${COLOR_LABELS[c].toLowerCase()}`}
                checked={state.color === c}
                className="yc-swatch"
                onSelect={() => {
                  applyColor(c)
                  close()
                }}
              >
                <span className="yc-swatch-dot" data-swatch-color={c} />
              </MenuItem>
            ))}
          </div>
          <p aria-hidden="true" className="yc-menu-label">
            SURLIGNAGE
          </p>
          <div className="yc-swatches" data-section="highlight">
            <MenuItem
              ariaLabel="Aucun surlignage"
              checked={state.highlight === null}
              className="yc-swatch"
              onSelect={() => {
                applyHighlight(null)
                close()
              }}
            >
              <span className="yc-swatch-dot yc-swatch-none" />
            </MenuItem>
            {HIGHLIGHTS.map((c) => (
              <MenuItem
                key={c}
                ariaLabel={`Surlignage ${COLOR_LABELS[c].toLowerCase()}`}
                checked={state.highlight === c}
                className="yc-swatch"
                onSelect={() => {
                  applyHighlight(c)
                  close()
                }}
              >
                <span className="yc-swatch-dot" data-swatch-highlight={c} />
              </MenuItem>
            ))}
          </div>
        </>
      )}
    </ToolMenu>
  )

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

      <div role="group" aria-label="Style et police" className="yc-tool-group">
        <ToolMenu
          buttonLabel={`Style de paragraphe : ${styleLabel}`}
          buttonClassName="yc-select"
          buttonContent={
            <>
              <span>{styleLabel}</span>
              <Icon src={chevronIcon} size={18} />
            </>
          }
          menuLabel="Style de paragraphe"
        >
          {(close) => (
            <>
              <p aria-hidden="true" className="yc-menu-label">
                STYLE DE PARAGRAPHE
              </p>
              {STYLES.map((s) => (
                <MenuItem
                  key={s.id}
                  checked={s.id === state.style}
                  className={`yc-menu-item yc-style-${s.id}`}
                  onSelect={() => {
                    applyStyle(editor, s.id)
                    close()
                  }}
                >
                  <span className="yc-menu-item-label">{s.label}</span>
                  {s.shortcut && <kbd className="yc-menu-shortcut">{s.shortcut}</kbd>}
                  {s.id === state.style && <Icon src={checkIcon} size={18} />}
                </MenuItem>
              ))}
            </>
          )}
        </ToolMenu>

        <ToolMenu
          buttonLabel={`Police : ${fontLabel}`}
          buttonClassName="yc-select"
          buttonContent={
            <>
              <span>{fontLabel}</span>
              <Icon src={chevronIcon} size={18} />
            </>
          }
          menuLabel="Police et taille"
        >
          {(close) => (
            <>
              <p aria-hidden="true" className="yc-menu-label">
                POLICE
              </p>
              {FONTS.map((f) => (
                <MenuItem
                  key={f.id}
                  checked={f.id === state.font}
                  className="yc-menu-item"
                  onSelect={() => {
                    applyFont(f.id)
                    close()
                  }}
                >
                  <span className="yc-menu-item-label" data-font={f.id} data-font-preview="">
                    {f.label}
                  </span>
                  <span className="yc-menu-hint">{f.hint}</span>
                  {f.id === state.font && <Icon src={checkIcon} size={18} />}
                </MenuItem>
              ))}
              <div aria-hidden="true" className="yc-menu-rule" />
              <p aria-hidden="true" className="yc-menu-label">
                TAILLE
              </p>
              <div className="yc-size-stepper">
                <MenuItem ariaLabel="Réduire la taille" className="yc-tool yc-tool-outline" onSelect={() => stepSize(-1)}>
                  <span className="yc-glyph yc-glyph-step">−</span>
                </MenuItem>
                <span className="yc-size-value" aria-live="polite">
                  {state.size} px
                </span>
                <MenuItem ariaLabel="Agrandir la taille" className="yc-tool yc-tool-outline" onSelect={() => stepSize(1)}>
                  <span className="yc-glyph yc-glyph-step">+</span>
                </MenuItem>
              </div>
            </>
          )}
        </ToolMenu>

        <ToolMenu
          buttonLabel={`Taille : ${state.size} px`}
          buttonClassName="yc-select"
          buttonContent={
            <>
              <span>{state.size}</span>
              <Icon src={chevronIcon} size={18} />
            </>
          }
          menuLabel="Taille du texte"
          menuClassName="yc-menu-narrow"
        >
          {(close) => (
            <>
              <p aria-hidden="true" className="yc-menu-label">
                TAILLE
              </p>
              {SIZES.map((s) => (
                <MenuItem
                  key={s}
                  checked={s === state.size}
                  className="yc-menu-item"
                  onSelect={() => {
                    applySize(s)
                    close()
                  }}
                >
                  <span className="yc-menu-item-label">{s} px</span>
                  {s === state.size && <Icon src={checkIcon} size={18} />}
                </MenuItem>
              ))}
            </>
          )}
        </ToolMenu>
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

      <div role="group" aria-label="Couleurs" className="yc-tool-group">
        <div className="yc-color-tool">
          <Tool label={`Couleur du texte : ${COLOR_LABELS[lastColor].toLowerCase()}`} className="yc-tool yc-tool-color" onRun={() => applyColor(lastColor)}>
            <span className="yc-color-pastille">
              <Icon src={textColorIcon} />
              <span className="yc-color-bar" data-swatch-color={lastColor} />
            </span>
          </Tool>
          {colorMenu('text')}
        </div>
        <div className="yc-color-tool">
          <Tool
            label={`Surlignage : ${COLOR_LABELS[lastHighlight].toLowerCase()}`}
            className="yc-tool yc-tool-color"
            onRun={() => applyHighlight(lastHighlight)}
          >
            <span className="yc-color-pastille">
              <Icon src={highlighterIcon} />
              <span className="yc-color-bar" data-swatch-highlight={lastHighlight} />
            </span>
          </Tool>
          {colorMenu('highlight')}
        </div>
      </div>

      <div role="group" aria-label="Listes" className="yc-tool-group">
        <Tool label="Liste à puces (Ctrl+Maj+8)" pressed={state.bulletList} onRun={run((c) => c.toggleBulletList())}>
          <Icon src={bulletListIcon} />
        </Tool>
        <Tool label="Liste numérotée (Ctrl+Maj+7)" pressed={state.orderedList} onRun={run((c) => c.toggleOrderedList())}>
          <Icon src={orderedListIcon} />
        </Tool>
        <Tool label="Liste de cases (Ctrl+Maj+9)" pressed={state.taskList} onRun={run((c) => c.toggleTaskList())}>
          <Icon src={taskListIcon} />
        </Tool>
        <Tool label="Diminuer le retrait (Maj+Tab)" disabled={!state.canLift} onRun={() => editor.chain().focus().liftListItem(currentItem(editor) ?? 'listItem').run()}>
          <Icon src={outdentIcon} />
        </Tool>
        <Tool label="Augmenter le retrait (Tab)" disabled={!state.canSink} onRun={() => editor.chain().focus().sinkListItem(currentItem(editor) ?? 'listItem').run()}>
          <Icon src={indentIcon} />
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

      <div role="group" aria-label="Alignement" className="yc-tool-group">
        <ToolMenu
          buttonLabel={`Aligner : ${ALIGNS.find((a) => a.id === state.align)?.label.toLowerCase()}`}
          buttonClassName="yc-tool yc-tool-menu"
          buttonContent={
            <>
              <Icon src={ALIGNS.find((a) => a.id === state.align)?.icon ?? alignLeftIcon} />
              <Icon src={chevronIcon} size={16} />
            </>
          }
          menuLabel="Alignement"
        >
          {(close) => (
            <>
              <p aria-hidden="true" className="yc-menu-label">
                ALIGNEMENT
              </p>
              {ALIGNS.map((a) => (
                <MenuItem
                  key={a.id}
                  checked={a.id === state.align}
                  className="yc-menu-item"
                  onSelect={() => {
                    editor.chain().focus().setTextAlign(a.id).run()
                    close()
                  }}
                >
                  <Icon src={a.icon} />
                  <span className="yc-menu-item-label yc-menu-item-medium">{a.label}</span>
                  <kbd className="yc-menu-shortcut">{a.shortcut}</kbd>
                </MenuItem>
              ))}
            </>
          )}
        </ToolMenu>
      </div>

      <div role="group" aria-label="Blocs" className="yc-tool-group">
        <Tool label="Bloc de code (Ctrl+Alt+C)" pressed={state.codeBlock} onRun={run((c) => c.toggleCodeBlock())}>
          <Icon src={codeBlockIcon} />
        </Tool>
        <Tool label="Insérer un séparateur" onRun={run((c) => c.setHorizontalRule())}>
          <Icon src={dividerIcon} />
        </Tool>
      </div>
    </div>
  )
}
