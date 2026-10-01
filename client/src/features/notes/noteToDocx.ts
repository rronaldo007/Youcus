import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type IParagraphOptions,
  type IRunOptions,
  type ParagraphChild,
} from 'docx'
import { formatTimestamp } from '@/lib/format'
import type { NoteDoc, NoteNode } from '@/features/notes/noteDoc'
import type { NotePage } from '@/features/notes/notePage'
import { noteImageUrl } from '@/features/notes/noteImageUpload'
import { readScene, sceneToSvg } from '@/features/notes/diagram/scene'

/**
 * A note as a Word document (YC-49), built from the editor's JSON, node by node: no HTML goes
 * through, so there is nothing to sanitise, and what is exported is what the editor holds (the
 * text typed a second ago too). Word has no dark theme: the colours are the light ones.
 * Loaded only when « Exporter en .docx » is clicked (lazy import), with its library.
 */

// Light values of the note's colour names (note-editor.css, YC-42) and of its accent (YC-56).
const TEXT_COLOURS: Record<string, string> = {
  encre: '17150F',
  gris: '5A554A',
  rouge: 'B0311C',
  orange: '8F4709',
  vert: '1E6E40',
  bleu: '1D4E89',
  violet: '5E3A94',
  prune: '8E2F5E',
}
const HIGHLIGHTS: Record<string, string> = {
  jaune: 'F6DE84',
  vert: 'CDE8C4',
  bleu: 'CFE0F5',
  rose: 'F5D2DE',
  orange: 'F8D8B6',
  violet: 'E2D7F2',
  gris: 'E4DDCF',
}
const ACCENT = 'B0311C'
const SUNKEN = 'EAE4D7'
const FONTS: Record<string, string> = {
  hanken: 'Hanken Grotesk',
  instrument: 'Instrument Serif',
  lora: 'Lora',
  atkinson: 'Atkinson Hyperlegible',
  jetbrains: 'JetBrains Mono',
  caveat: 'Caveat',
}
const MONO = 'JetBrains Mono'
// The icons of YC-46 as the symbols every Word has.
const ICONS: Record<string, string> = {
  ampoule: '💡',
  etoile: '★',
  question: '?',
  drapeau: '⚑',
  alerte: '⚠',
  coche: '✓',
  repere: '🔖',
  horloge: '⏱',
  crayon: '✎',
  lien: '🔗',
  code: '‹›',
  lecture: '▶',
  plus: '+',
  citation: '“',
  fermer: '✕',
}
const ALIGN = { center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED } as const

/** px of the screen → twentieths of a point (Word's unit for spacing) and half-points (sizes). */
const twips = (px: number) => Math.round(px * 15)
const halfPoints = (px: number) => Math.round(px * 1.5)

type Mark = { type: string; attrs?: Record<string, unknown> }

/**
 * The run options of a piece of text: its marks, over the note's base font and size. In a heading
 * there is no base (`null`): the heading style gives font and size, a base on each run would
 * override it (seen in the LibreOffice render: a title 1 at the size of the text).
 */
function runOptions(marks: Mark[] = [], base: { font: string; size: number } | null): IRunOptions {
  const run: Record<string, unknown> = base ? { font: base.font, size: halfPoints(base.size) } : {}
  for (const mark of marks) {
    const value = mark.attrs ?? {}
    if (mark.type === 'bold') run.bold = true
    else if (mark.type === 'italic') run.italics = true
    else if (mark.type === 'underline') run.underline = {}
    else if (mark.type === 'strike') run.strike = true
    else if (mark.type === 'code') {
      run.font = MONO
      run.shading = { type: ShadingType.CLEAR, fill: SUNKEN, color: 'auto' }
    } else if (mark.type === 'textColor' && TEXT_COLOURS[value.color as string]) run.color = TEXT_COLOURS[value.color as string]
    else if (mark.type === 'highlight' && HIGHLIGHTS[value.color as string])
      run.shading = { type: ShadingType.CLEAR, fill: HIGHLIGHTS[value.color as string], color: 'auto' }
    else if (mark.type === 'textFont' && FONTS[value.font as string]) run.font = FONTS[value.font as string]
    else if (mark.type === 'textSize' && typeof value.size === 'number') run.size = halfPoints(value.size)
  }
  return run as IRunOptions
}

/** The inline content of a line: text, line breaks, icons, links. */
function inlines(nodes: NoteNode[] = [], base: { font: string; size: number } | null): ParagraphChild[] {
  const out: ParagraphChild[] = []
  for (const node of nodes) {
    const marks = (node.marks ?? []) as Mark[]
    if (node.type === 'hardBreak') out.push(new TextRun({ break: 1 }))
    else if (node.type === 'noteIcon') out.push(new TextRun({ ...runOptions(marks, base), text: ICONS[node.attrs?.name as string] ?? '•' }))
    else if (node.type === 'text') {
      const link = marks.find((m) => m.type === 'link')
      const run = new TextRun({ ...runOptions(marks.filter((m) => m.type !== 'link'), base), text: node.text ?? '', ...(link ? { style: 'Hyperlink' } : {}) })
      out.push(link ? new ExternalHyperlink({ link: String(link.attrs?.href ?? ''), children: [run] }) : run)
    }
  }
  return out
}

interface Context {
  base: { font: string; size: number }
  /**
   * The list a line is in: its kind, its depth, its instance for Word's numbering. Only the first
   * line of an item carries the bullet or number (`continued` for the next ones); a task carries
   * its box instead.
   */
  list?: { kind: 'bullet' | 'ordered' | 'task'; level: number; instance: number; continued?: boolean }
  quote: boolean
  /** The images ready for Word, by id (YC-50). */
  images?: Map<string, DocxImage>
  /** The diagrams drawn as pictures (YC-53). */
  diagrams?: Map<NoteNode, DocxImage>
  task?: boolean
}

let instances = 0

/** The marker of a line, « [04:05] » in the accent, before its text (YC-56). */
function markerRun(attrs: Record<string, unknown> | undefined): ParagraphChild[] {
  return typeof attrs?.marker === 'number' ? [new TextRun({ text: `[${formatTimestamp(attrs.marker)}] `, bold: true, color: ACCENT, font: MONO, size: 20 })] : []
}

/** Paragraph options shared by every line: alignment, spacing (YC-55), list, quote. */
function lineOptions(attrs: Record<string, unknown> | undefined, ctx: Context): Partial<IParagraphOptions> {
  const options: Record<string, unknown> = {}
  const align = ALIGN[attrs?.textAlign as keyof typeof ALIGN]
  if (align) options.alignment = align
  const lineHeight = typeof attrs?.lineHeight === 'number' ? attrs.lineHeight : 1
  options.spacing = {
    before: twips(typeof attrs?.spaceBefore === 'number' ? attrs.spaceBefore : 0),
    after: twips(typeof attrs?.spaceAfter === 'number' ? attrs.spaceAfter : 6),
    line: Math.round(276 * lineHeight),
  }
  if (typeof attrs?.indent === 'number' && !ctx.list) options.indent = { firstLine: twips(attrs.indent) }
  if (ctx.list) {
    const level = Math.min(ctx.list.level, 8)
    if (ctx.list.kind === 'task' || ctx.list.continued) options.indent = { left: twips(28 * (level + 1)) }
    else options.numbering = { reference: ctx.list.kind, level, instance: ctx.list.instance }
  }
  if (ctx.quote) {
    options.indent = { left: twips(24) }
    options.border = { left: { style: BorderStyle.SINGLE, size: 12, color: 'D8D0BF', space: 8 } }
  }
  return options as Partial<IParagraphOptions>
}

/** The Word paragraphs of a block, recursively through lists and quotes. */
/** What a note becomes in Word: paragraphs, and tables (YC-51). */
type Block = Paragraph | Table

function blocks(nodes: NoteNode[] = [], ctx: Context): Block[] {
  const out: Block[] = []
  for (const node of nodes) {
    const attrs = node.attrs
    if (node.type === 'paragraph') {
      const checkbox = ctx.task !== undefined ? [new TextRun({ text: ctx.task ? '☑ ' : '☐ ', font: 'Segoe UI Symbol' })] : []
      out.push(new Paragraph({ ...lineOptions(attrs, ctx), children: [...markerRun(attrs), ...checkbox, ...inlines(node.content, ctx.base)] }))
      ctx = { ...ctx, task: undefined }
    } else if (node.type === 'heading') {
      const level = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3][(Number(attrs?.level) || 1) - 1]
      out.push(new Paragraph({ ...lineOptions(attrs, ctx), heading: level, children: [...markerRun(attrs), ...inlines(node.content, null)] }))
    } else if (node.type === 'bulletList' || node.type === 'orderedList') {
      const kind = node.type === 'bulletList' ? 'bullet' : 'ordered'
      const level = ctx.list ? ctx.list.level + 1 : 0
      // A new instance restarts the numbering of each ordered list at 1.
      const instance = ++instances
      for (const item of node.content ?? []) out.push(...listItem(item, { ...ctx, list: { kind, level, instance } }))
    } else if (node.type === 'taskList') {
      const level = ctx.list ? ctx.list.level + 1 : 0
      for (const item of node.content ?? [])
        out.push(...listItem(item, { ...ctx, list: { kind: 'task', level, instance: 0 }, task: item.attrs?.checked === true }))
    } else if (node.type === 'blockquote') {
      out.push(...blocks(node.content, { ...ctx, quote: true }))
    } else if (node.type === 'codeBlock') {
      const text = (node.content ?? []).map((n) => n.text ?? '').join('')
      for (const line of text.split('\n'))
        out.push(
          new Paragraph({
            spacing: { before: 0, after: 0 },
            shading: { type: ShadingType.CLEAR, fill: 'F1ECE2', color: 'auto' },
            children: [new TextRun({ text: line || ' ', font: MONO, size: 19 })],
          }),
        )
    } else if (node.type === 'noteDiagram') {
      out.push(...diagramBlock(node, ctx))
    } else if (node.type === 'noteTabs') {
      // Word has no tabs: each tab is a title on a sunken band, then its page, one after the other.
      for (const tab of node.content ?? []) {
        out.push(
          new Paragraph({
            spacing: { before: 200, after: 80 },
            shading: { type: ShadingType.CLEAR, fill: SUNKEN, color: 'auto' },
            border: { top: { style: BorderStyle.SINGLE, size: 12, color: ACCENT, space: 2 } },
            children: [new TextRun({ text: String(tab.attrs?.title ?? ''), bold: true })],
          }),
        )
        out.push(...blocks(tab.content, ctx))
      }
    } else if (node.type === 'table') {
      out.push(tableBlock(node, ctx))
    } else if (node.type === 'noteImage') {
      out.push(...imageBlock(attrs ?? {}, ctx))
    } else if (node.type === 'horizontalRule') {
      out.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'D8D0BF', space: 1 } }, children: [] }))
    }
  }
  return out
}

/** What fits between the margins of an A4 page in Word (6.27 in at 96 px per inch). */
const PAGE_WIDTH_PX = 600

/**
 * An image block (YC-50): the picture itself, at its width and alignment, with its alternative
 * text (Word reads it aloud), then its caption in italics. An image that could not be read for
 * the export says so in its place rather than vanishing.
 */
function imageBlock(attrs: Record<string, unknown>, ctx: Context): Paragraph[] {
  const id = attrs.id as string | undefined
  const alt = (attrs.alt as string | undefined) || (attrs.caption as string | undefined) || 'Image sans description'
  const caption = attrs.caption as string | undefined
  const align = (attrs.align as string | undefined) ?? 'center'
  const image = id ? ctx.images?.get(id) : undefined
  const alignment = align === 'left' ? AlignmentType.LEFT : AlignmentType.CENTER
  const out: Paragraph[] = []
  if (image) {
    const share = align === 'full' ? 1 : typeof attrs.width === 'number' ? attrs.width / 100 : null
    const width = Math.round(share !== null ? PAGE_WIDTH_PX * share : Math.min(image.width, PAGE_WIDTH_PX))
    const height = Math.round((width * image.height) / image.width)
    out.push(
      new Paragraph({
        alignment,
        spacing: { before: 120, after: caption ? 60 : 120 },
        children: [new ImageRun({ type: 'png', data: image.data, transformation: { width, height }, altText: { name: alt, description: alt, title: alt } })],
      }),
    )
  } else {
    out.push(new Paragraph({ alignment, children: [new TextRun({ text: `[Image : ${alt}]`, italics: true, color: '5A554A' })] }))
  }
  if (caption) out.push(new Paragraph({ alignment, spacing: { after: 120 }, children: [new TextRun({ text: caption, italics: true, color: '5A554A', size: 21 })] }))
  return out
}

/**
 * A table (YC-51) as a Word table: the full width, its columns even, the header row sunken and
 * bold, and repeated at the top of each page when the table runs over a page break.
 */
function tableBlock(node: NoteNode, ctx: Context): Table {
  const rows = node.content ?? []
  const columns = Math.max(1, ...rows.map((r) => r.content?.length ?? 0))
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: Array.from({ length: columns }, () => Math.floor(9000 / columns)),
    rows: rows.map((row) => {
      const header = row.content?.[0]?.type === 'tableHeader'
      return new TableRow({
        tableHeader: header,
        children: (row.content ?? []).map((cell) => {
          // A header cell is one line of bold text; a body cell keeps its blocks (lists, code…).
          const inside = header ? [boldParagraph(cell)] : blocks(cell.content, { ...ctx, list: undefined, task: undefined })
          return new TableCell({
            shading: header ? { type: ShadingType.CLEAR, fill: SUNKEN, color: 'auto' } : undefined,
            margins: { top: 60, bottom: 60, left: 120, right: 120 },
            // Word refuses a cell without a paragraph.
            children: inside.length ? inside : [new Paragraph({ children: [] })],
          })
        }),
      })
    }),
  })
}

/** A header cell's text in bold: Word has no « header cell » style of its own. */
function boldParagraph(cell: NoteNode): Paragraph {
  const text = (cell.content ?? []).map((n) => (n.content ?? []).map((t) => t.text ?? '').join('')).join(' ')
  return new Paragraph({ children: text ? [new TextRun({ text, bold: true })] : [] })
}

/**
 * A diagram (YC-53) as a PNG picture, which every Word reads, drawn in the light colours, at its
 * size up to the page width; when it could not be drawn, its words take its place.
 */
function diagramBlock(node: NoteNode, ctx: Context): Paragraph[] {
  const image = ctx.diagrams?.get(node)
  const scene = readScene(node.attrs?.scene)
  const words = [...scene.shapes.map((s) => s.text), ...scene.arrows.map((a) => a.label)].filter(Boolean).join(', ')
  if (!image) return [new Paragraph({ children: [new TextRun({ text: `[Schéma : ${words || 'vide'}]`, italics: true, color: '5A554A' })] })]
  const width = Math.min(image.width, PAGE_WIDTH_PX)
  const height = Math.round((width * image.height) / image.width)
  const alt = words ? `Schéma : ${words}` : 'Schéma'
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 120 },
      children: [new ImageRun({ type: 'png', data: image.data, transformation: { width, height }, altText: { name: alt, description: alt, title: alt } })],
    }),
  ]
}

/** An item: its first line takes the bullet, number or box; the next lines only its indent. */
function listItem(item: NoteNode, ctx: Context): Block[] {
  const [first, ...rest] = item.content ?? []
  if (!first) return []
  return [...blocks([first], ctx), ...blocks(rest, { ...ctx, task: undefined, list: ctx.list && { ...ctx.list, continued: true } })]
}

/** Bullets for the levels of a list (•, ◦, ▪…) and numbers (1., a., i.…), indented step by step. */
const levels = (formats: { format: (typeof LevelFormat)[keyof typeof LevelFormat]; text: (i: number) => string }[]) =>
  Array.from({ length: 9 }, (_, i) => {
    const f = formats[i % formats.length]
    return { level: i, format: f.format, text: f.text(i), alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: twips(28 * (i + 1)), hanging: twips(18) } } } }
  })

/** An image ready for Word: PNG bytes (Word reads no WebP) and its size in pixels. */
export interface DocxImage {
  data: Uint8Array
  width: number
  height: number
}

export interface DocxMeta {
  /** « FULLSTACK · VIDÉO 4 · 14:32 », above the title. */
  eyebrow?: string
  title: string
  page: NotePage
  /** The images of the note by id (YC-50); one missing is written as its description. */
  images?: Map<string, DocxImage>
  /** The diagrams drawn as pictures, by their node (YC-53). */
  diagrams?: Map<NoteNode, DocxImage>
}

/** The Word document of a note; `noteToDocx` packs it for the browser, the tests for Node. */
export function buildNoteDocument(doc: NoteDoc, meta: DocxMeta): Document {
  instances = 0
  const base = { font: FONTS[meta.page.font ?? 'hanken'] ?? FONTS.hanken, size: meta.page.size ?? 16 }
  const head: Paragraph[] = [
    ...(meta.eyebrow ? [new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: meta.eyebrow.toUpperCase(), font: MONO, size: 18, color: '5A554A' })] })] : []),
    new Paragraph({ heading: HeadingLevel.TITLE, spacing: { after: 240 }, children: [new TextRun({ text: meta.title, font: 'Instrument Serif', size: 56 })] }),
  ]
  const document = new Document({
    creator: 'Youcus',
    title: meta.title,
    styles: {
      default: { document: { run: { font: base.font, size: halfPoints(base.size), color: '17150F' } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', run: { font: 'Instrument Serif', size: 48 }, paragraph: { spacing: { before: 240, after: 120 } } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', run: { font: 'Instrument Serif', size: 36 }, paragraph: { spacing: { before: 200, after: 100 } } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', run: { font: 'Hanken Grotesk', size: 27, bold: true }, paragraph: { spacing: { before: 160, after: 80 } } },
      ],
    },
    numbering: {
      config: [
        { reference: 'bullet', levels: levels([{ format: LevelFormat.BULLET, text: () => '•' }, { format: LevelFormat.BULLET, text: () => '◦' }, { format: LevelFormat.BULLET, text: () => '▪' }]) },
        {
          reference: 'ordered',
          levels: levels([
            { format: LevelFormat.DECIMAL, text: (i) => `%${i + 1}.` },
            { format: LevelFormat.LOWER_LETTER, text: (i) => `%${i + 1}.` },
            { format: LevelFormat.LOWER_ROMAN, text: (i) => `%${i + 1}.` },
          ]),
        },
      ],
    },
    sections: [{ children: [...head, ...blocks(doc.content, { base, quote: false, images: meta.images, diagrams: meta.diagrams })] }],
  })
  return document
}

/** The ids of the images of a note, wherever they sit (lists, quotes). */
export function imageIds(nodes: NoteNode[] = []): string[] {
  return nodes.flatMap((n) => (n.type === 'noteImage' && typeof n.attrs?.id === 'string' ? [n.attrs.id] : imageIds(n.content)))
}

/** One image of the note, read from the API and redrawn as PNG; null when it cannot be read. */
async function loadDocxImage(id: string): Promise<DocxImage | null> {
  try {
    const res = await fetch(noteImageUrl(id), { credentials: 'include' })
    if (!res.ok) return null
    const bitmap = await createImageBitmap(await res.blob())
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0)
    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!png) return null
    return { data: new Uint8Array(await png.arrayBuffer()), width: bitmap.width, height: bitmap.height }
  } catch {
    return null
  }
}

/** The diagrams of a note, wherever they sit (tabs). */
export function diagramNodes(nodes: NoteNode[] = []): NoteNode[] {
  return nodes.flatMap((n) => (n.type === 'noteDiagram' ? [n] : diagramNodes(n.content)))
}

/** A diagram drawn as a PNG, twice its size for a sharp print; null if the browser cannot. */
async function drawDiagram(node: NoteNode): Promise<DocxImage | null> {
  try {
    const { svg, width, height } = sceneToSvg(readScene(node.attrs?.scene))
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      const canvas = document.createElement('canvas')
      canvas.width = width * 2
      canvas.height = height * 2
      const ctx2d = canvas.getContext('2d')
      if (!ctx2d) return null
      ctx2d.scale(2, 2)
      ctx2d.drawImage(img, 0, 0, width, height)
      const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
      return png ? { data: new Uint8Array(await png.arrayBuffer()), width, height } : null
    } finally {
      URL.revokeObjectURL(url)
    }
  } catch {
    return null
  }
}

/** The .docx of a note, as a Blob to download, its images and diagrams inside. */
export async function noteToDocx(doc: NoteDoc, meta: DocxMeta): Promise<Blob> {
  const images = new Map<string, DocxImage>()
  for (const id of new Set(imageIds(doc.content))) {
    const image = await loadDocxImage(id)
    if (image) images.set(id, image)
  }
  const diagrams = new Map<NoteNode, DocxImage>()
  for (const node of diagramNodes(doc.content)) {
    const picture = await drawDiagram(node)
    if (picture) diagrams.set(node, picture)
  }
  return Packer.toBlob(buildNoteDocument(doc, { ...meta, images, diagrams }))
}

/** « useEffect en profondeur » → « useEffect-en-profondeur.docx »: no character a file system refuses. */
export function docxFileName(title: string): string {
  const name = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\- ]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80)
  return `${name || 'note'}.docx`
}
