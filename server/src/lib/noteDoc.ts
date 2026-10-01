import { z } from 'zod'

/**
 * The rich-editor note document (YC-40): a TipTap / ProseMirror JSON tree.
 *
 * The server never trusts it: only the node and mark types the editor offers are accepted,
 * link targets are limited to http(s) and mailto, unknown attributes are dropped, and the
 * size and nesting are capped. What is stored is the PARSED document, never the raw body.
 */

export const MAX_DOC_CHARS = 200_000
export const MAX_DOC_DEPTH = 20

/**
 * Colours, highlights, fonts and sizes (YC-42): a note stores their NAME, never a CSS value, so
 * the client can give each name a light and a dark value. Same lists as
 * client/src/features/notes/noteMarks.ts.
 */
export const TEXT_COLORS = ['encre', 'gris', 'rouge', 'orange', 'vert', 'bleu', 'violet', 'prune'] as const
export const HIGHLIGHTS = ['jaune', 'vert', 'bleu', 'rose', 'orange', 'violet', 'gris'] as const
export const FONTS = ['hanken', 'instrument', 'lora', 'atkinson', 'jetbrains', 'caveat'] as const
export const SIZES = [12, 14, 16, 18, 20, 24, 28, 32] as const

export type NoteMark =
  | { type: 'bold' | 'italic' | 'underline' | 'strike' | 'code' }
  | { type: 'link'; attrs: { href: string } }
  | { type: 'textColor'; attrs: { color: (typeof TEXT_COLORS)[number] } }
  | { type: 'highlight'; attrs: { color: (typeof HIGHLIGHTS)[number] } }
  | { type: 'textFont'; attrs: { font: (typeof FONTS)[number] } }
  | { type: 'textSize'; attrs: { size: (typeof SIZES)[number] } }

export type NoteNode = {
  type: string
  attrs?: Record<string, unknown>
  content?: NoteNode[]
  marks?: NoteMark[]
  text?: string
}

export interface NoteDoc {
  type: 'doc'
  content: NoteNode[]
}

/** A link may only open a web page or a mail client: no javascript:, data:, file:. */
export function isSafeHref(href: string): boolean {
  try {
    const url = new URL(href)
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:'
  } catch {
    return false
  }
}

const simpleMark = z.object({ type: z.enum(['bold', 'italic', 'underline', 'strike', 'code']) })
const linkMark = z.object({
  type: z.literal('link'),
  attrs: z.object({ href: z.string().max(2000).refine(isSafeHref, 'Lien non autorisé') }),
})
const textColorMark = z.object({ type: z.literal('textColor'), attrs: z.object({ color: z.enum(TEXT_COLORS) }) })
const highlightMark = z.object({ type: z.literal('highlight'), attrs: z.object({ color: z.enum(HIGHLIGHTS) }) })
const textFontMark = z.object({ type: z.literal('textFont'), attrs: z.object({ font: z.enum(FONTS) }) })
const textSizeMark = z.object({
  type: z.literal('textSize'),
  attrs: z.object({
    size: z.union([z.literal(12), z.literal(14), z.literal(16), z.literal(18), z.literal(20), z.literal(24), z.literal(28), z.literal(32)]),
  }),
})
const markSchema = z.union([simpleMark, linkMark, textColorMark, highlightMark, textFontMark, textSizeMark])

const textNode = z.object({
  type: z.literal('text'),
  text: z.string().min(1),
  marks: z.array(markSchema).max(10).optional(),
})
const hardBreak = z.object({ type: z.literal('hardBreak') })
/**
 * An icon in the text (YC-46), Figma « Menu de l'éditeur › Icônes » (33:2705): stored by name,
 * drawn by the client in the colour and size of the text, so it takes the text's marks. Same list
 * as client/src/features/notes/noteIcons.ts.
 */
export const NOTE_ICONS = [
  'ampoule', 'etoile', 'question', 'drapeau', 'alerte', 'coche', 'repere', 'horloge',
  'crayon', 'lien', 'code', 'lecture', 'plus', 'citation', 'fermer',
] as const
const noteIcon = z.object({
  type: z.literal('noteIcon'),
  attrs: z.object({ name: z.enum(NOTE_ICONS) }),
  marks: z.array(markSchema).max(10).optional(),
})
const inline = z.union([textNode, hardBreak, noteIcon])

/**
 * Alignment (YC-43): the editor sends `textAlign: null` on every block; only a real choice is
 * kept, so a plain paragraph is stored without attributes.
 */
const ALIGNMENTS = ['left', 'center', 'right', 'justify'] as const
const textAlign = z.enum(ALIGNMENTS).nullable().optional()
const withAlign = <T extends Record<string, unknown>>(attrs: T & { textAlign?: string | null }) => {
  const { textAlign: align, ...rest } = attrs
  return align && align !== 'left' ? { ...rest, textAlign: align } : rest
}

/**
 * Timestamped marker (YC-56): the second of the video a line was written at, shown in the
 * margin and clicked to jump there. The editor sends `marker: null` on every line; only a real
 * marker is kept. 100 hours covers the longest YouTube videos.
 */
export const MAX_MARKER_SECONDS = 360_000
const marker = z.number().int().min(0).max(MAX_MARKER_SECONDS).nullable().optional()
const withMarker = <T extends Record<string, unknown>>(attrs: T & { marker?: number | null }) => {
  const { marker: seconds, ...rest } = attrs
  return typeof seconds === 'number' ? { ...rest, marker: seconds } : rest
}

/**
 * Paragraph spacing (YC-55), Figma « Menu de l'éditeur › Interligne » (33:2680): line height,
 * space before and after, first-line indent. The defaults (1, 0, 0, none) are not stored; the
 * client draws each value on the paper (on ruled paper, rounded to whole lines).
 */
export const LINE_HEIGHTS = [1, 1.15, 1.5, 2] as const
export const PARAGRAPH_SPACES = [0, 8, 16, 32] as const
export const INDENTS = [0, 32, 64] as const
const oneOf = <T extends readonly number[]>(values: T) =>
  z.number().refine((v) => (values as readonly number[]).includes(v)).nullable().optional()
const spacing = { lineHeight: oneOf(LINE_HEIGHTS), spaceBefore: oneOf(PARAGRAPH_SPACES), spaceAfter: oneOf(PARAGRAPH_SPACES), indent: oneOf(INDENTS) }
const DEFAULT_SPACING: Record<keyof typeof spacing, number> = { lineHeight: 1, spaceBefore: 0, spaceAfter: 0, indent: 0 }
const withSpacing = <T extends Record<string, unknown>>(attrs: T) => {
  const kept: Record<string, unknown> = { ...attrs }
  for (const key of Object.keys(spacing) as (keyof typeof spacing)[]) {
    const value = kept[key]
    if (typeof value !== 'number' || value === DEFAULT_SPACING[key]) delete kept[key]
  }
  return kept
}

const paragraph = z
  .object({
    type: z.literal('paragraph'),
    attrs: z.object({ textAlign, marker, ...spacing }).optional(),
    content: z.array(inline).optional(),
  })
  .transform(({ attrs, ...node }) => {
    const kept = attrs ? withSpacing(withMarker(withAlign(attrs))) : {}
    return Object.keys(kept).length ? { ...node, attrs: kept } : node
  })
const heading = z
  .object({
    type: z.literal('heading'),
    attrs: z.object({ level: z.union([z.literal(1), z.literal(2), z.literal(3)]), textAlign, marker }),
    content: z.array(inline).optional(),
  })
  .transform((node) => ({ ...node, attrs: withMarker(withAlign(node.attrs)) }))

const horizontalRule = z.object({ type: z.literal('horizontalRule') })

/** Code block languages (YC-44), same ids as client/src/features/notes/codeLanguages.ts. */
export const CODE_LANGUAGES = ['javascript', 'typescript', 'python', 'html', 'css', 'json', 'bash', 'sql', 'java', 'php'] as const
// Plain text only inside: no marks, no hard breaks (lines are \n in the text).
const codeText = z.object({ type: z.literal('text'), text: z.string().min(1) })
const codeBlock = z
  .object({
    type: z.literal('codeBlock'),
    attrs: z.object({ language: z.enum(CODE_LANGUAGES).nullable().optional(), lineNumbers: z.boolean().optional() }).optional(),
    content: z.array(codeText).optional(),
  })
  .transform(({ attrs, ...node }) => {
    // Defaults (plain text, line numbers shown) are not stored.
    const kept: { language?: string; lineNumbers?: boolean } = {}
    if (attrs?.language) kept.language = attrs.language
    if (attrs?.lineNumbers === false) kept.lineNumbers = false
    return Object.keys(kept).length ? { ...node, attrs: kept } : node
  })

/**
 * An image block (YC-50), Figma « Bloc de note › Image » (65:2007). The note keeps the id of a
 * NoteImage only, never a URL: the client asks /api/note-images/:id, which serves its owner
 * alone, so no note can point at an outside address. Centred and at its own size by default:
 * the defaults are not stored.
 */
export const IMAGE_ALIGNS = ['left', 'center', 'full'] as const
export const MAX_IMAGE_TEXT = 300
const imageText = z.string().max(MAX_IMAGE_TEXT).nullable().optional()
const noteImage = z
  .object({
    type: z.literal('noteImage'),
    attrs: z.object({
      id: z.string().uuid(),
      alt: imageText,
      caption: imageText,
      align: z.enum(IMAGE_ALIGNS).nullable().optional(),
      width: z.number().int().min(20).max(100).nullable().optional(),
    }),
  })
  .transform(({ attrs, ...node }) => {
    const kept: Record<string, unknown> = { id: attrs.id }
    if (attrs.alt?.trim()) kept.alt = attrs.alt.trim()
    if (attrs.caption?.trim()) kept.caption = attrs.caption.trim()
    if (attrs.align && attrs.align !== 'center') kept.align = attrs.align
    if (typeof attrs.width === 'number' && attrs.width !== 100) kept.width = attrs.width
    return { ...node, attrs: kept }
  })

/**
 * A table (YC-51), Figma « Bloc de note › Tableau » (65:2071): rows of cells, the first row of
 * header cells when « En-tête » is on. No merged cells (the editor offers none): colspan and
 * rowspan are 1 and are not stored. A cell holds blocks, never another table.
 */
export const MAX_TABLE_ROWS = 100
export const MAX_TABLE_COLUMNS = 20
const cellAttrs = z
  .object({
    colspan: z.literal(1).optional(),
    rowspan: z.literal(1).optional(),
    colwidth: z.null().optional(),
  })
  .optional()
const cellOf = (type: 'tableCell' | 'tableHeader') =>
  z
    .object({ type: z.literal(type), attrs: cellAttrs, content: z.array(z.lazy(() => cellBlock)).min(1) })
    // colspan / rowspan 1 and colwidth null are the defaults: nothing to store.
    .transform((cell) => ({ type: cell.type, content: cell.content }))
const tableRow = z.object({
  type: z.literal('tableRow'),
  content: z.array(z.union([cellOf('tableHeader'), cellOf('tableCell')])).min(1).max(MAX_TABLE_COLUMNS),
})
const table = z
  .object({ type: z.literal('table'), content: z.array(tableRow).min(1).max(MAX_TABLE_ROWS) })
  .refine((t) => t.content.every((row) => row.content.length === t.content[0].content.length), 'Tableau irrégulier')

/**
 * A diagram (YC-53), Figma « Dessin de schéma » 64:2007: shapes, and arrows naming two of them.
 * Numbers are bounded, colours are names (drawn with the note tokens), an arrow must point at
 * shapes of the same diagram. Same rules as client/src/features/notes/diagram/scene.ts.
 */
export const DIAGRAM_COLORS = ['bleu', 'rouge', 'vert', 'orange', 'violet', 'gris'] as const
export const MAX_SHAPES = 100
export const MAX_ARROWS = 200
const COORD = z.number().finite().min(-10_000).max(10_000)
const SIZE = z.number().finite().min(8).max(4_000)
const diagramId = z.string().regex(/^[a-z0-9]{1,12}$/)
const shape = z.object({
  id: diagramId,
  kind: z.enum(['rect', 'ellipse', 'diamond', 'text']),
  x: COORD,
  y: COORD,
  w: SIZE,
  h: SIZE,
  text: z.string().max(200),
  color: z.enum(DIAGRAM_COLORS),
})
const arrow = z.object({ id: diagramId, from: diagramId, to: diagramId, label: z.string().max(200) })
const scene = z
  .object({ shapes: z.array(shape).max(MAX_SHAPES), arrows: z.array(arrow).max(MAX_ARROWS) })
  .refine((sc) => {
    const ids = [...sc.shapes.map((x) => x.id), ...sc.arrows.map((a) => a.id)]
    const shapes = new Set(sc.shapes.map((x) => x.id))
    return new Set(ids).size === ids.length && sc.arrows.every((a) => a.from !== a.to && shapes.has(a.from) && shapes.has(a.to))
  }, 'Schéma incohérent')
const noteDiagram = z.object({ type: z.literal('noteDiagram'), attrs: z.object({ scene }) })

/**
 * A chart (YC-54), Figma « Bloc de note › Graphique » 65:2230: a title, its kind, and a small table
 * of labels and values (none negative; an empty value is null). Same limits as
 * client/src/features/notes/chart/chart.ts.
 */
export const MAX_CHART_ROWS = 24
const chartRow = z.object({ label: z.string().max(24), value: z.number().finite().min(0).max(1_000_000_000).nullable() })
const chart = z.object({
  title: z.string().max(80),
  kind: z.enum(['bar', 'line', 'pie']),
  rows: z.array(chartRow).min(1).max(MAX_CHART_ROWS),
})
const noteChart = z.object({ type: z.literal('noteChart'), attrs: z.object({ chart }) })

/**
 * Tabs (YC-52), Figma « Bloc de note › Onglets » (65:2126): several pages in one note, each with
 * a title and its blocks. Which tab is shown is not stored: it is a state of the screen. A tab
 * holds the blocks of a note except tabs (no tabs in tabs).
 */
export const MAX_TABS = 8
export const MAX_TAB_TITLE = 40
const noteTab = z.object({
  type: z.literal('noteTab'),
  attrs: z.object({ title: z.string().trim().min(1).max(MAX_TAB_TITLE) }),
  content: z.array(z.lazy(() => tabBlock)).min(1),
})
const noteTabs = z.object({ type: z.literal('noteTabs'), content: z.array(noteTab).min(1).max(MAX_TABS) })

// Lists and quotes contain blocks, which contain lists: the schema is recursive.
const block: z.ZodType<NoteNode, z.ZodTypeDef, unknown> = z.lazy(() =>
  z.union([paragraph, heading, blockquote, bulletList, orderedList, taskList, codeBlock, horizontalRule, noteImage, table, noteTabs, noteDiagram, noteChart]),
)
// What a tab may hold: every block of a note but tabs.
const tabBlock: z.ZodType<NoteNode, z.ZodTypeDef, unknown> = z.lazy(() =>
  z.union([paragraph, heading, blockquote, bulletList, orderedList, taskList, codeBlock, horizontalRule, noteImage, table, noteDiagram, noteChart]),
)
// What a cell may hold: the blocks of a note, except a table (no table in a table) and an image.
const cellBlock: z.ZodType<NoteNode, z.ZodTypeDef, unknown> = z.lazy(() =>
  z.union([paragraph, heading, blockquote, bulletList, orderedList, taskList, codeBlock]),
)
const listItem = z.object({ type: z.literal('listItem'), content: z.array(block).min(1) })
const blockquote = z.object({ type: z.literal('blockquote'), content: z.array(block).min(1) })
const bulletList = z.object({ type: z.literal('bulletList'), content: z.array(listItem).min(1) })
// Task lists (YC-43): a checkbox per item, nested lists allowed.
const taskItem = z.object({
  type: z.literal('taskItem'),
  attrs: z.object({ checked: z.boolean() }),
  content: z.array(block).min(1),
})
const taskList = z.object({ type: z.literal('taskList'), content: z.array(taskItem).min(1) })
const orderedList = z.object({
  type: z.literal('orderedList'),
  attrs: z.object({ start: z.number().int().min(0).max(100_000) }).optional(),
  content: z.array(listItem).min(1),
})

const docSchema = z.object({ type: z.literal('doc'), content: z.array(block) })

function depthOf(value: unknown, depth = 0): number {
  if (depth > MAX_DOC_DEPTH) return depth
  if (!value || typeof value !== 'object') return depth
  const content = (value as { content?: unknown }).content
  if (!Array.isArray(content)) return depth
  return content.reduce<number>((max, child) => Math.max(max, depthOf(child, depth + 1)), depth)
}

export type ParsedDoc = { ok: true; doc: NoteDoc } | { ok: false; status: 400 | 413; message: string }

/** Validates a document sent by the client. Returns the cleaned document to store. */
export function parseNoteDoc(input: unknown): ParsedDoc {
  let size: number
  try {
    size = JSON.stringify(input ?? null).length
  } catch {
    return { ok: false, status: 400, message: 'Document de note invalide' }
  }
  if (size > MAX_DOC_CHARS) return { ok: false, status: 413, message: 'Note trop longue' }
  if (depthOf(input) > MAX_DOC_DEPTH) return { ok: false, status: 400, message: 'Note trop imbriquée' }
  const parsed = docSchema.safeParse(input)
  if (!parsed.success) return { ok: false, status: 400, message: 'Document de note invalide' }
  return { ok: true, doc: parsed.data as NoteDoc }
}

export const EMPTY_DOC: NoteDoc = { type: 'doc', content: [] }

/**
 * A line of a note for the search (YC-22): its text, the marker it was written at (its own, else
 * the last one above it: the nearest moment of the video) and the title it sits under.
 */
export type NoteLine = { text: string; marker: number | null; section: string | null }

/** The lines of a document, one per block, as `docToPlainText` writes them, with their place. */
export function noteLines(doc: NoteDoc): NoteLine[] {
  const out: NoteLine[] = []
  let marker: number | null = null
  let section: string | null = null
  // Every line is pushed through here: what is written, and where.
  const lines = {
    get length() {
      return out.length
    },
    push(...texts: string[]) {
      for (const text of texts) out.push({ text, marker, section })
    },
    splice(from: number) {
      return out.splice(from).map((l) => l.text)
    },
  }
  const walk = (node: NoteNode) => {
    if (node.type === 'noteImage') {
      // The caption says what the image shows; else its alternative text. Searchable either way.
      const text = (node.attrs?.caption ?? node.attrs?.alt) as string | undefined
      if (text) lines.push(text)
      return
    }
    if (node.type === 'noteDiagram') {
      // The words of the drawing, for search and export: its shapes, then its arrows.
      const sc = node.attrs?.scene as { shapes: { text: string }[]; arrows: { label: string }[] } | undefined
      for (const text of [...(sc?.shapes ?? []).map((x) => x.text), ...(sc?.arrows ?? []).map((a) => a.label)]) {
        if (text) lines.push(text)
      }
      return
    }
    if (node.type === 'noteChart') {
      // Its title, then each row « label value »: the search finds a chart by what it shows.
      const ch = node.attrs?.chart as { title: string; rows: { label: string; value: number | null }[] } | undefined
      if (ch?.title) lines.push(ch.title)
      for (const r of ch?.rows ?? []) {
        const line = [r.label, r.value ?? ''].join(' ').trim()
        if (line) lines.push(line)
      }
      return
    }
    if (node.type === 'noteTab') {
      // The title of the tab, then its lines: the search finds a word whichever tab holds it.
      lines.push(String(node.attrs?.title ?? ''))
      for (const child of node.content ?? []) walk(child)
      return
    }
    if (node.type === 'tableRow') {
      // One line per row, its cells separated by tabs, as a spreadsheet pastes them.
      const cells = (node.content ?? []).map((cell) => {
        const inner: string[] = []
        const before = lines.length
        for (const child of cell.content ?? []) walk(child)
        inner.push(...lines.splice(before))
        return inner.join(' ')
      })
      lines.push(cells.join('\t'))
      return
    }
    if (node.type === 'codeBlock') {
      lines.push((node.content ?? []).map((n) => n.text ?? '').join(''))
      return
    }
    if (node.type === 'paragraph' || node.type === 'heading') {
      const own = node.attrs?.marker
      if (typeof own === 'number') marker = own
      const text = (node.content ?? []).map((n) => (n.type === 'text' ? (n.text ?? '') : n.type === 'hardBreak' ? '\n' : '')).join('')
      if (node.type === 'heading' && text.trim()) section = text.trim()
      lines.push(text)
      return
    }
    for (const child of node.content ?? []) walk(child)
  }
  for (const node of doc.content) walk(node)
  return out
}

/** Plain text of a document, one line per block: kept in `content` for export and search. */
export function docToPlainText(doc: NoteDoc): string {
  return noteLines(doc)
    .map((l) => l.text)
    .join('\n')
}
