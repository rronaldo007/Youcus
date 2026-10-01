import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
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
import marginColumnIcon from './icons/margin-column.svg'
import markerIcon from './icons/marker.svg'
import clockIcon from './icons/clock.svg'
import { canSetMarker } from '@/features/notes/noteMarker'
import lineSpacingIcon from './icons/line-spacing.svg'
import insertIconIcon from './icons/insert-icon.svg'
import closeIcon from './icons/note/fermer.svg'
import expandIcon from './icons/expand.svg'
import collapseIcon from './icons/collapse.svg'
import { usePhone } from '@/features/notes/usePhone'
import { useModalDialog } from '@/features/notes/useModalDialog'
import { searchIcons, type NoteIconId } from '@/features/notes/noteIcons'
import {
  INDENTS,
  LINE_HEIGHTS,
  PARAGRAPH_SPACES,
  allowedOnRuled,
  drawnSpacing,
  isRuled,
  readSpacing,
  type ParagraphSpacing,
} from '@/features/notes/noteSpacing'
import { PAPERS, TINTS, paperLabel, type NotePage } from '@/features/notes/notePage'
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
export function Icon({ src, size = 24 }: { src: string; size?: number }) {
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

/**
 * A button of the « Mise en forme » sheet (YC-47): a dialog, so every button is a tab stop, and
 * like the toolbar it keeps the selection in the editor. `role` and `checked` make the swatches,
 * papers and styles radios, the switches switches; the others say they are pressed.
 */
function SheetButton({
  label,
  onRun,
  pressed,
  checked,
  role,
  disabled,
  className = 'yc-tool',
  children,
}: {
  label: string
  onRun: () => void
  pressed?: boolean
  checked?: boolean
  role?: 'radio' | 'switch'
  disabled?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role={role}
      className={className}
      aria-label={label}
      title={label}
      aria-pressed={role ? undefined : pressed}
      aria-checked={role ? !!checked : undefined}
      aria-disabled={disabled || undefined}
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

/**
 * The chain a tool runs: it gives the focus back to the editor, except from the phone sheet,
 * a modal dialog the focus must stay in (the phone keyboard would come up at every tap, YC-47).
 */
const chainOf = (editor: Editor, focus: boolean) => (focus ? editor.chain().focus() : editor.chain())

function applyStyle(editor: Editor, style: Style, focus = true) {
  let chain = chainOf(editor, focus)
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
function setNamed(editor: Editor, mark: string, attrs: Record<string, unknown>, isDefault: boolean, focus = true) {
  const chain = chainOf(editor, focus)
  if (isDefault) chain.unsetMark(mark).run()
  else chain.setMark(mark, attrs).run()
}

interface FormattingToolbarProps {
  editor: Editor
  /** Opens the link field (also bound to Ctrl+K in the editor). */
  onLink: () => void
  /** Paper, tint, margin and markers shown (YC-45, YC-56), changed from « Fond » and the Page tools. */
  page: NotePage
  onPageChange: (page: NotePage) => void
  /** Timestamps the current line at the player's position (YC-56); absent without a player, and so are the timestamp tools. */
  onMarker?: () => void
  /** Opens the note in its expanded view, or brings it back (YC-18). */
  onExpand?: () => void
  expanded?: boolean
}

export function FormattingToolbar({ editor, onLink, page, onPageChange, onMarker, onExpand, expanded = false }: FormattingToolbarProps) {
  const ref = useRef<HTMLDivElement>(null)
  // The colour tools reapply the last colour chosen in one click (Figma « Outil couleur », 31:88).
  const [lastColor, setLastColor] = useState<TextColor>('rouge')
  const [lastHighlight, setLastHighlight] = useState<Highlight>('jaune')
  // On a phone (YC-47): one scrolling row, and « Aa » opens the sheet with everything.
  const phone = usePhone()
  const [sheetOpen, setSheetOpen] = useState(false)
  const sheetOpenRef = useRef(false)
  sheetOpenRef.current = sheetOpen
  const ch = () => chainOf(editor, !sheetOpenRef.current)

  const baseFont = page.font ?? DEFAULT_FONT
  const baseSize = page.size ?? DEFAULT_SIZE

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
      // Without a mark, the text is in the note's base font and size (YC-48).
      font: ((e.getAttributes('textFont').font as FontId | undefined) ?? baseFont) as FontId,
      size: ((e.getAttributes('textSize').size as FontSize | undefined) ?? baseSize) as FontSize,
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
      canMarker: canSetMarker(e),
      inParagraph: e.isActive('paragraph'),
      inList: e.isActive('listItem') || e.isActive('taskItem'),
      spacing: readSpacing(e.getAttributes('paragraph')),
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

  // « Agrandir la note » (Figma 58:11787) becomes « Réduire la note » in the expanded view (YC-18).
  const expandTool = onExpand && (
    <Tool label={expanded ? 'Réduire la note' : 'Agrandir la note'} className="yc-tool yc-tool-expand" onRun={onExpand}>
      <Icon src={expanded ? collapseIcon : expandIcon} />
    </Tool>
  )

  // The focused tool becomes the tab stop.
  const rovingFocus = (e: { target: EventTarget }) => {
    if (!(e.target as HTMLElement).hasAttribute('data-tool')) return
    ref.current?.querySelectorAll<HTMLElement>('[data-tool]').forEach((t) => (t.tabIndex = t === e.target ? 0 : -1))
  }

  const run = (fn: (chain: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>) => () => fn(ch()).run()

  const applyColor = (color: TextColor) => {
    setNamed(editor, 'textColor', { color }, color === DEFAULT_COLOR, !sheetOpenRef.current)
    if (color !== DEFAULT_COLOR) setLastColor(color)
  }
  const applyHighlight = (color: Highlight | null) => {
    setNamed(editor, 'highlight', { color }, color === null, !sheetOpenRef.current)
    if (color) setLastHighlight(color)
  }
  // The note's base needs no mark: choosing it removes the mark.
  const applyFont = (font: FontId) => setNamed(editor, 'textFont', { font }, font === baseFont, !sheetOpenRef.current)
  const applySize = (size: FontSize) => setNamed(editor, 'textSize', { size }, size === baseSize, !sheetOpenRef.current)
  const stepSize = (step: 1 | -1) => {
    const next = SIZES[SIZES.indexOf(state.size) + step]
    if (next) applySize(next)
  }

  const styleLabel = STYLES.find((s) => s.id === state.style)?.label ?? 'Paragraphe'
  const fontLabel = FONTS.find((f) => f.id === state.font)?.label ?? 'Hanken Grotesk'

  /** Police (31:55), with the size stepper; in the toolbar or in the phone sheet. */
  const fontMenu = (inToolbar: boolean) => (
    <ToolMenu
      inToolbar={inToolbar}
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
  )

  /** Both colour tools open the same menu (33:207); each puts the focus in its own section. */
  const colorMenu = (focus: 'text' | 'highlight') => (
    <ToolMenu
      floating={phone}
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

  /** The sections of the phone sheet (Figma 35:3259), every tool of the large bar. */
  const sheetContent = () => (
    <>
      <SheetSection label="STYLE">
        <div role="radiogroup" aria-label="Style de paragraphe" className="yc-sheet-chips">
          {STYLES.filter((st) => st.id !== 'code').map((st) => (
            <SheetButton
              key={st.id}
              role="radio"
              checked={state.style === st.id}
              label={st.label}
              className={`yc-sheet-chip yc-chip-${st.id}`}
              onRun={() => applyStyle(editor, st.id, false)}
            >
              {st.label}
            </SheetButton>
          ))}
        </div>
      </SheetSection>

      <SheetSection label="PAGE">
        <div role="radiogroup" aria-label="Papier" className="yc-papers">
          {PAPERS.map((pp) => (
            <SheetButton
              key={pp.id}
              role="radio"
              checked={page.paper === pp.id}
              label={`Papier ${pp.label.toLowerCase()}`}
              className="yc-paper-choice"
              onRun={() => onPageChange({ ...page, paper: pp.id })}
            >
              <span className="yc-paper-preview" data-paper={pp.id} data-tint={page.tint} />
              <span className="yc-paper-name">{pp.label}</span>
            </SheetButton>
          ))}
        </div>
        <div role="radiogroup" aria-label="Teinte" className="yc-swatches">
          {TINTS.map((t) => (
            <SheetButton
              key={t.id}
              role="radio"
              checked={page.tint === t.id}
              label={`Teinte ${t.label.toLowerCase()}`}
              className="yc-swatch"
              onRun={() => onPageChange({ ...page, tint: t.id })}
            >
              <span className="yc-swatch-dot yc-tint-dot" data-tint={t.id} />
            </SheetButton>
          ))}
        </div>
        {onMarker && (
          <SheetButton
            role="switch"
            checked={page.timestamps}
            label="Horodatages dans la marge"
            className="yc-menu-item yc-menu-switch"
            onRun={() => onPageChange({ ...page, timestamps: !page.timestamps })}
          >
            <span className="yc-menu-item-label yc-menu-item-medium">Horodatages dans la marge</span>
            <span aria-hidden="true" className="yc-switch" />
          </SheetButton>
        )}
        <SheetButton
          role="switch"
          checked={page.margin}
          label="Colonne de marge"
          className="yc-menu-item yc-menu-switch"
          onRun={() => onPageChange({ ...page, margin: !page.margin })}
        >
          <span className="yc-menu-item-label yc-menu-item-medium">Colonne de marge</span>
          <span aria-hidden="true" className="yc-switch" />
        </SheetButton>
      </SheetSection>

      <SheetSection label="BLOCS">
        <div className="yc-sheet-row">
          <SheetButton label="Bloc de code (Ctrl+Alt+C)" pressed={state.codeBlock} onRun={run((c) => c.toggleCodeBlock())}>
            <Icon src={codeBlockIcon} />
          </SheetButton>
          <SheetButton label="Insérer un séparateur" onRun={run((c) => c.setHorizontalRule())}>
            <Icon src={dividerIcon} />
          </SheetButton>
        </div>
      </SheetSection>

      <SheetSection label="POLICE ET TAILLE">
        <div className="yc-sheet-row">
          {fontMenu(false)}
          <SheetButton label="Réduire la taille" className="yc-tool yc-tool-outline" disabled={state.size === SIZES[0]} onRun={() => stepSize(-1)}>
            <span className="yc-glyph yc-glyph-step">−</span>
          </SheetButton>
          <span className="yc-size-value" aria-live="polite">
            {state.size}
          </span>
          <SheetButton label="Agrandir la taille" className="yc-tool yc-tool-outline" disabled={state.size === SIZES[SIZES.length - 1]} onRun={() => stepSize(1)}>
            <span className="yc-glyph yc-glyph-step">+</span>
          </SheetButton>
        </div>
      </SheetSection>

      <SheetSection label="CARACTÈRES">
        <div className="yc-sheet-row">
          <SheetButton label="Gras (Ctrl+B)" pressed={state.bold} onRun={run((c) => c.toggleBold())}>
            <span className="yc-glyph yc-glyph-bold">B</span>
          </SheetButton>
          <SheetButton label="Italique (Ctrl+I)" pressed={state.italic} onRun={run((c) => c.toggleItalic())}>
            <span className="yc-glyph yc-glyph-italic">I</span>
          </SheetButton>
          <SheetButton label="Souligné (Ctrl+U)" pressed={state.underline} onRun={run((c) => c.toggleUnderline())}>
            <span className="yc-glyph yc-glyph-underline">U</span>
          </SheetButton>
          <SheetButton label="Barré (Ctrl+Maj+S)" pressed={state.strike} onRun={run((c) => c.toggleStrike())}>
            <span className="yc-glyph yc-glyph-strike">S</span>
          </SheetButton>
          <SheetButton label="Effacer la mise en forme" onRun={run((c) => c.unsetAllMarks().clearNodes())}>
            <Icon src={clearFormatIcon} />
          </SheetButton>
        </div>
      </SheetSection>

      <SheetSection label="COULEUR DU TEXTE">
        <div role="radiogroup" aria-label="Couleur du texte" className="yc-swatches">
          {TEXT_COLORS.map((c) => (
            <SheetButton key={c} role="radio" checked={state.color === c} label={`Texte ${COLOR_LABELS[c].toLowerCase()}`} className="yc-swatch" onRun={() => applyColor(c)}>
              <span className="yc-swatch-dot" data-swatch-color={c} />
            </SheetButton>
          ))}
        </div>
      </SheetSection>

      <SheetSection label="SURLIGNAGE">
        <div role="radiogroup" aria-label="Surlignage" className="yc-swatches">
          <SheetButton role="radio" checked={state.highlight === null} label="Aucun surlignage" className="yc-swatch" onRun={() => applyHighlight(null)}>
            <span className="yc-swatch-dot yc-swatch-none" />
          </SheetButton>
          {HIGHLIGHTS.map((c) => (
            <SheetButton key={c} role="radio" checked={state.highlight === c} label={`Surlignage ${COLOR_LABELS[c].toLowerCase()}`} className="yc-swatch" onRun={() => applyHighlight(c)}>
              <span className="yc-swatch-dot" data-swatch-highlight={c} />
            </SheetButton>
          ))}
        </div>
      </SheetSection>

      <SheetSection label="LISTES ET ALIGNEMENT">
        <div className="yc-sheet-row">
          <SheetButton label="Liste à puces (Ctrl+Maj+8)" pressed={state.bulletList} onRun={run((c) => c.toggleBulletList())}>
            <Icon src={bulletListIcon} />
          </SheetButton>
          <SheetButton label="Liste numérotée (Ctrl+Maj+7)" pressed={state.orderedList} onRun={run((c) => c.toggleOrderedList())}>
            <Icon src={orderedListIcon} />
          </SheetButton>
          <SheetButton label="Liste de cases (Ctrl+Maj+9)" pressed={state.taskList} onRun={run((c) => c.toggleTaskList())}>
            <Icon src={taskListIcon} />
          </SheetButton>
          <SheetButton label="Diminuer le retrait (Maj+Tab)" disabled={!state.canLift} onRun={() => ch().liftListItem(currentItem(editor) ?? 'listItem').run()}>
            <Icon src={outdentIcon} />
          </SheetButton>
          <SheetButton label="Augmenter le retrait (Tab)" disabled={!state.canSink} onRun={() => ch().sinkListItem(currentItem(editor) ?? 'listItem').run()}>
            <Icon src={indentIcon} />
          </SheetButton>
          {ALIGNS.slice(0, 2).map((a) => (
            <SheetButton key={a.id} label={`Aligner ${a.label.toLowerCase()} (${a.shortcut})`} pressed={state.align === a.id} onRun={() => ch().setTextAlign(a.id).run()}>
              <Icon src={a.icon} />
            </SheetButton>
          ))}
        </div>
      </SheetSection>

      <SheetSection label="ALIGNEMENT, ESPACEMENT, INSERTION">
        <div className="yc-sheet-row">
          {ALIGNS.slice(2).map((a) => (
            <SheetButton key={a.id} label={`Aligner ${a.label.toLowerCase()} (${a.shortcut})`} pressed={state.align === a.id} onRun={() => ch().setTextAlign(a.id).run()}>
              <Icon src={a.icon} />
            </SheetButton>
          ))}
          <SpacingMenu
            inToolbar={false}
            disabled={!state.inParagraph}
            inList={state.inList}
            spacing={state.spacing}
            ruled={isRuled(page.paper)}
            drawn={drawnSpacing(state.spacing, page.paper)}
            onChange={(values) => ch().setParagraphSpacing(values).run()}
          />
          <SheetButton
            label="Lien (Ctrl+K)"
            pressed={state.link}
            onRun={() => {
              // The link field opens under the bar: the sheet steps aside for it.
              setSheetOpen(false)
              onLink()
            }}
          >
            <Icon src={linkIcon} />
          </SheetButton>
          <SheetButton label="Citation (Ctrl+Maj+B)" pressed={state.quote} onRun={run((c) => c.toggleBlockquote())}>
            <Icon src={quoteIcon} />
          </SheetButton>
          <SheetButton label="Code en ligne (Ctrl+E)" pressed={state.code} onRun={run((c) => c.toggleCode())}>
            <Icon src={codeIcon} />
          </SheetButton>
          <IconPicker inToolbar={false} onPick={(name) => ch().insertNoteIcon(name).run()} />
        </div>
      </SheetSection>
    </>
  )

  if (phone) {
    return (
      <>
        <div className="yc-toolbar-compact-wrap">
          <div ref={ref} role="toolbar" aria-label="Mise en forme" className="yc-toolbar yc-toolbar-compact" onKeyDown={onKeyDown} onFocus={rovingFocus}>
            <button
              type="button"
              className="yc-tool yc-tool-aa"
              data-tool=""
              tabIndex={-1}
              aria-label="Toute la mise en forme"
              title="Toute la mise en forme"
              aria-haspopup="dialog"
              aria-expanded={sheetOpen}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setSheetOpen(true)}
            >
              <span className="yc-glyph yc-glyph-aa">Aa</span>
            </button>
            {expandTool}
            <span aria-hidden="true" className="yc-toolbar-separator" />
            <Tool label="Gras (Ctrl+B)" pressed={state.bold} onRun={run((c) => c.toggleBold())}>
              <span className="yc-glyph yc-glyph-bold">B</span>
            </Tool>
            <Tool label="Italique (Ctrl+I)" pressed={state.italic} onRun={run((c) => c.toggleItalic())}>
              <span className="yc-glyph yc-glyph-italic">I</span>
            </Tool>
            <Tool label="Souligné (Ctrl+U)" pressed={state.underline} onRun={run((c) => c.toggleUnderline())}>
              <span className="yc-glyph yc-glyph-underline">U</span>
            </Tool>
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
              <Tool label={`Surlignage : ${COLOR_LABELS[lastHighlight].toLowerCase()}`} className="yc-tool yc-tool-color" onRun={() => applyHighlight(lastHighlight)}>
                <span className="yc-color-pastille">
                  <Icon src={highlighterIcon} />
                  <span className="yc-color-bar" data-swatch-highlight={lastHighlight} />
                </span>
              </Tool>
              {colorMenu('highlight')}
            </div>
            <Tool label="Liste à puces (Ctrl+Maj+8)" pressed={state.bulletList} onRun={run((c) => c.toggleBulletList())}>
              <Icon src={bulletListIcon} />
            </Tool>
            <Tool label="Liste de cases (Ctrl+Maj+9)" pressed={state.taskList} onRun={run((c) => c.toggleTaskList())}>
              <Icon src={taskListIcon} />
            </Tool>
            <IconPicker floating onPick={(name) => ch().insertNoteIcon(name).run()} />
            <Tool label="Annuler (Ctrl+Z)" disabled={!state.canUndo} onRun={run((c) => c.undo())}>
              <Icon src={undoIcon} />
            </Tool>
          </div>
        </div>
        {sheetOpen && (
          <Sheet
            title="Mise en forme"
            onClose={() => {
              setSheetOpen(false)
              ref.current?.querySelector<HTMLElement>('.yc-tool-aa')?.focus()
            }}
          >
            {sheetContent()}
          </Sheet>
        )}
      </>
    )
  }

  return (
    <div ref={ref} role="toolbar" aria-label="Mise en forme" className="yc-toolbar" onKeyDown={onKeyDown} onFocus={rovingFocus}>
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
          buttonLabel={`Fond : ${paperLabel(page.paper)}`}
          buttonClassName="yc-select"
          buttonContent={
            <>
              <span>Fond : {paperLabel(page.paper)}</span>
              <Icon src={chevronIcon} size={18} />
            </>
          }
          menuLabel="Page"
          menuClassName="yc-menu-page"
        >
          {() => (
            <>
              <p aria-hidden="true" className="yc-menu-label">
                PAPIER
              </p>
              <div className="yc-papers">
                {PAPERS.map((p) => (
                  <MenuItem
                    key={p.id}
                    ariaLabel={`Papier ${p.label.toLowerCase()}`}
                    checked={page.paper === p.id}
                    className="yc-paper-choice"
                    onSelect={() => onPageChange({ ...page, paper: p.id })}
                  >
                    <span className="yc-paper-preview" data-paper={p.id} data-tint={page.tint} />
                    <span className="yc-paper-name">{p.label}</span>
                  </MenuItem>
                ))}
              </div>
              <p aria-hidden="true" className="yc-menu-label">
                TEINTE
              </p>
              <div className="yc-swatches">
                {TINTS.map((t) => (
                  <MenuItem
                    key={t.id}
                    ariaLabel={`Teinte ${t.label.toLowerCase()}`}
                    checked={page.tint === t.id}
                    className="yc-swatch"
                    onSelect={() => onPageChange({ ...page, tint: t.id })}
                  >
                    <span className="yc-swatch-dot yc-tint-dot" data-tint={t.id} />
                  </MenuItem>
                ))}
              </div>
              <div aria-hidden="true" className="yc-menu-rule" />
              {onMarker && (
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={page.timestamps}
                  tabIndex={-1}
                  className="yc-menu-item yc-menu-switch"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onPageChange({ ...page, timestamps: !page.timestamps })}
                >
                  <span className="yc-menu-item-label yc-menu-item-medium">Horodatages dans la marge</span>
                  <span aria-hidden="true" className="yc-switch" />
                </button>
              )}
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={page.margin}
                tabIndex={-1}
                className="yc-menu-item yc-menu-switch"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onPageChange({ ...page, margin: !page.margin })}
              >
                <span className="yc-menu-item-label yc-menu-item-medium">Colonne de marge (horodatages)</span>
                <span aria-hidden="true" className="yc-switch" />
              </button>
            </>
          )}
        </ToolMenu>

        {fontMenu(true)}

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
        <Tool label="Diminuer le retrait (Maj+Tab)" disabled={!state.canLift} onRun={() => ch().liftListItem(currentItem(editor) ?? 'listItem').run()}>
          <Icon src={outdentIcon} />
        </Tool>
        <Tool label="Augmenter le retrait (Tab)" disabled={!state.canSink} onRun={() => ch().sinkListItem(currentItem(editor) ?? 'listItem').run()}>
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
        <IconPicker onPick={(name) => ch().insertNoteIcon(name).run()} />
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
                    ch().setTextAlign(a.id).run()
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
        <SpacingMenu
          disabled={!state.inParagraph}
          inList={state.inList}
          spacing={state.spacing}
          ruled={isRuled(page.paper)}
          drawn={drawnSpacing(state.spacing, page.paper)}
          onChange={(values) => ch().setParagraphSpacing(values).run()}
        />
      </div>

      <div role="group" aria-label="Blocs" className="yc-tool-group">
        <Tool label="Bloc de code (Ctrl+Alt+C)" pressed={state.codeBlock} onRun={run((c) => c.toggleCodeBlock())}>
          <Icon src={codeBlockIcon} />
        </Tool>
        <Tool label="Insérer un séparateur" onRun={run((c) => c.setHorizontalRule())}>
          <Icon src={dividerIcon} />
        </Tool>
      </div>

      <div role="group" aria-label="Page" className="yc-tool-group">
        {/* Timestamps belong to a video: a playlist note has neither the marker nor the switch. */}
        {onMarker && (
          <>
            <Tool label="Ajouter un repère (M)" disabled={!state.canMarker} onRun={onMarker}>
              <Icon src={markerIcon} />
            </Tool>
            <Tool label="Horodatages" pressed={page.timestamps} onRun={() => onPageChange({ ...page, timestamps: !page.timestamps })}>
              <Icon src={clockIcon} />
            </Tool>
          </>
        )}
        <Tool label="Colonne de marge" pressed={page.margin} onRun={() => onPageChange({ ...page, margin: !page.margin })}>
          <Icon src={marginColumnIcon} />
        </Tool>
        {expandTool}
      </div>
    </div>
  )
}

const decimal = (v: number) => v.toFixed(v === 1.15 ? 2 : 1).replace('.', ',')

/**
 * « Interligne et espacement » (Figma 33:2680, adapted on 01/10 with Ronaldo): the line heights,
 * then a row of values for each space. On ruled paper only whole lines are offered, the other
 * values stay visible but unavailable, and the checked value is the one the paper draws.
 */
function SpacingMenu({
  disabled,
  inList,
  spacing,
  drawn,
  ruled,
  onChange,
  inToolbar = true,
}: {
  /** In the phone sheet, a normal tab stop (YC-47). */
  inToolbar?: boolean
  disabled: boolean
  /** In a list, the list's own indent replaces the first-line indent (YC-58). */
  inList: boolean
  spacing: ParagraphSpacing
  drawn: ParagraphSpacing
  ruled: boolean
  onChange: (values: Partial<ParagraphSpacing>) => void
}) {
  if (disabled) {
    return (
      <Tool label="Interligne et espacement (paragraphes seulement)" disabled onRun={() => {}}>
        <Icon src={lineSpacingIcon} />
      </Tool>
    )
  }
  const values = (
    key: 'spaceBefore' | 'spaceAfter' | 'indent',
    title: string,
    list: readonly number[],
    show: (v: number) => string,
  ) => (
    <div role="group" aria-label={title} className="yc-spacing-row">
      <p aria-hidden="true" className="yc-spacing-head">
        <span>{title}</span>
        <span className="yc-spacing-unit">px</span>
      </p>
      <div className="yc-spacing-values">
        {list.map((v) => {
          const why =
            key === 'indent'
              ? inList && 'pas dans une liste'
              : ruled && !allowedOnRuled.space(v as 0 | 8 | 16 | 32) && 'papier Uni seulement'
          const unavailable = !!why
          return (
            <button
              key={v}
              type="button"
              role="menuitemradio"
              aria-checked={drawn[key] === v && !(key === 'indent' && inList)}
              aria-disabled={unavailable || undefined}
              aria-label={`${title} : ${show(v)}${why ? ` (${why})` : ''}`}
              tabIndex={-1}
              className="yc-spacing-value"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (!unavailable) onChange({ [key]: v })
              }}
            >
              {show(v)}
            </button>
          )
        })}
      </div>
    </div>
  )
  return (
    <ToolMenu
      inToolbar={inToolbar}
      buttonLabel="Interligne et espacement"
      buttonClassName="yc-tool"
      buttonContent={<Icon src={lineSpacingIcon} />}
      menuLabel="Interligne et espacement"
      menuClassName="yc-menu-spacing"
    >
      {() => (
        <>
          <p aria-hidden="true" className="yc-menu-label">
            INTERLIGNE
          </p>
          {LINE_HEIGHTS.map((v) => {
            const unavailable = ruled && !allowedOnRuled.lineHeight(v)
            return (
              <button
                key={v}
                type="button"
                role="menuitemradio"
                aria-checked={drawn.lineHeight === v}
                aria-disabled={unavailable || undefined}
                aria-label={`Interligne ${decimal(v)}${unavailable ? ' (papier Uni seulement)' : ''}`}
                tabIndex={-1}
                className="yc-menu-item"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (!unavailable) onChange({ lineHeight: v })
                }}
              >
                <span className="yc-menu-item-label yc-menu-item-medium">{decimal(v)}</span>
                {unavailable ? (
                  <span className="yc-menu-shortcut">Uni seulement</span>
                ) : (
                  drawn.lineHeight === v && <Icon src={checkIcon} size={18} />
                )}
              </button>
            )
          })}
          <div aria-hidden="true" className="yc-menu-rule" />
          <p aria-hidden="true" className="yc-menu-label">
            ESPACEMENT DU PARAGRAPHE
          </p>
          {values('spaceBefore', 'Espace avant', PARAGRAPH_SPACES, String)}
          {values('spaceAfter', 'Espace après', PARAGRAPH_SPACES, String)}
          {values('indent', 'Retrait de première ligne', INDENTS, (v) => (v === 0 ? 'aucun' : String(v)))}
          {inList && <p className="yc-spacing-help">Dans une liste, Tab et Maj+Tab décalent le point : pas de retrait de première ligne.</p>}
          {ruled && (
            <p className="yc-spacing-help">
              Papier réglé : le texte reste sur les lignes. Les valeurs en pointillé sont réservées au papier Uni.
              {spacing.lineHeight !== drawn.lineHeight || spacing.spaceBefore !== drawn.spaceBefore || spacing.spaceAfter !== drawn.spaceAfter
                ? ' Ce paragraphe garde son réglage Uni, arrondi ici.'
                : ''}
            </p>
          )}
        </>
      )}
    </ToolMenu>
  )
}

/**
 * « Insérer une icône » (Figma 33:2705): a search field over the grid of icons; Entrée in the
 * field inserts the first one shown.
 */
function IconPicker({ onPick, inToolbar = true, floating = false }: { onPick: (name: NoteIconId) => void; inToolbar?: boolean; floating?: boolean }) {
  return (
    <ToolMenu
      inToolbar={inToolbar}
      floating={floating}
      buttonLabel="Insérer une icône"
      buttonClassName="yc-tool"
      buttonContent={<Icon src={insertIconIcon} />}
      menuLabel="Insérer une icône"
      menuClassName="yc-menu-icons"
      initialFocus="input"
    >
      {(close) => (
        <IconGrid
          onPick={(name) => {
            onPick(name)
            close()
          }}
        />
      )}
    </ToolMenu>
  )
}

function IconGrid({ onPick }: { onPick: (name: NoteIconId) => void }) {
  const [query, setQuery] = useState('')
  const shown = searchIcons(query)
  return (
    <>
      <p aria-hidden="true" className="yc-menu-label">
        INSÉRER UNE ICÔNE
      </p>
      <input
        type="search"
        className="yc-icon-search"
        placeholder="Rechercher une icône"
        aria-label="Rechercher une icône"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          // The caret moves in the field; the arrows up and down go to the grid (the menu's keys).
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) e.stopPropagation()
          if (e.key === 'Enter' && shown[0]) {
            e.preventDefault()
            onPick(shown[0].id)
          }
        }}
      />
      <div role="group" aria-label="Icônes" className="yc-icon-grid">
        {shown.map((icon) => (
          <button
            key={icon.id}
            type="button"
            role="menuitem"
            aria-label={icon.label}
            title={icon.label}
            tabIndex={-1}
            className="yc-icon-cell"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(icon.id)}
          >
            <span aria-hidden="true" className="yc-icon" data-icon={icon.id} />
          </button>
        ))}
        {!shown.length && <p className="yc-icon-empty">Aucune icône pour « {query} ».</p>}
      </div>
      <p className="yc-spacing-help">Taille et couleur suivent le texte. Tape « : » pour chercher.</p>
    </>
  )
}

function SheetSection({ label, children }: { label: string; children: ReactNode }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="yc-sheet-section">
      <h3 id={id} className="yc-sheet-label">
        {label}
      </h3>
      {children}
    </section>
  )
}

/**
 * The bottom sheet of the phone editor (Figma 35:3259): a modal dialog over a veil. The focus goes
 * to « Fermer » and stays inside; Échap, the veil and « Fermer » close it; the page under it does
 * not scroll while it is open.
 */
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const close = useRef(onClose)
  close.current = onClose
  const onKeyDown = useModalDialog(true, ref, onClose)

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('.yc-sheet-close')?.focus()
  }, [])

  return (
    <div className="yc-sheet-layer">
      <div className="yc-sheet-veil" aria-hidden="true" onMouseDown={(e) => e.preventDefault()} onClick={() => close.current()} />
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} className="yc-sheet" onKeyDown={onKeyDown}>
        <span aria-hidden="true" className="yc-sheet-handle" />
        <div className="yc-sheet-head">
          <h2 id={titleId} className="yc-sheet-title">
            {title}
          </h2>
          <button
            type="button"
            className="yc-tool yc-sheet-close"
            aria-label="Fermer"
            title="Fermer"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => close.current()}
          >
            <Icon src={closeIcon} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
