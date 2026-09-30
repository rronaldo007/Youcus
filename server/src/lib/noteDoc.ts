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
const inline = z.union([textNode, hardBreak])

const paragraph = z.object({ type: z.literal('paragraph'), content: z.array(inline).optional() })
const heading = z.object({
  type: z.literal('heading'),
  attrs: z.object({ level: z.union([z.literal(1), z.literal(2), z.literal(3)]) }),
  content: z.array(inline).optional(),
})

const horizontalRule = z.object({ type: z.literal('horizontalRule') })

// Lists and quotes contain blocks, which contain lists: the schema is recursive.
const block: z.ZodType<NoteNode> = z.lazy(() =>
  z.union([paragraph, heading, blockquote, bulletList, orderedList, horizontalRule]),
)
const listItem = z.object({ type: z.literal('listItem'), content: z.array(block).min(1) })
const blockquote = z.object({ type: z.literal('blockquote'), content: z.array(block).min(1) })
const bulletList = z.object({ type: z.literal('bulletList'), content: z.array(listItem).min(1) })
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

/** Plain text of a document, one line per block: kept in `content` for export and search. */
export function docToPlainText(doc: NoteDoc): string {
  const lines: string[] = []
  const walk = (node: NoteNode) => {
    if (node.type === 'paragraph' || node.type === 'heading') {
      lines.push(
        (node.content ?? []).map((n) => (n.type === 'text' ? (n.text ?? '') : n.type === 'hardBreak' ? '\n' : '')).join(''),
      )
      return
    }
    for (const child of node.content ?? []) walk(child)
  }
  for (const node of doc.content) walk(node)
  return lines.join('\n')
}
