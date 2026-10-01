import { Extension } from '@tiptap/react'
import type { Paper } from '@/features/notes/notePage'

/**
 * Paragraph spacing (YC-55), Figma « Menu de l'éditeur › Interligne » (33:2680): line height,
 * space before and after, first-line indent, on the paragraphs of the selection.
 *
 * The note stores the value chosen; the CSS draws it on the paper. On ruled paper the text stays
 * on the 32 px rule: 1,15 is drawn as one line, 1,5 as two, 8 px as none, 16 px as one line, so a
 * value chosen on plain paper is never lost. Same lists as server/src/lib/noteDoc.ts.
 */
export const LINE_HEIGHTS = [1, 1.15, 1.5, 2] as const
export const PARAGRAPH_SPACES = [0, 8, 16, 32] as const
export const INDENTS = [0, 32, 64] as const

export type LineHeight = (typeof LINE_HEIGHTS)[number]
export type ParagraphSpace = (typeof PARAGRAPH_SPACES)[number]
export type Indent = (typeof INDENTS)[number]

export interface ParagraphSpacing {
  lineHeight: LineHeight
  spaceBefore: ParagraphSpace
  spaceAfter: ParagraphSpace
  indent: Indent
}

export const DEFAULT_SPACING: ParagraphSpacing = { lineHeight: 1, spaceBefore: 0, spaceAfter: 0, indent: 0 }

export const isRuled = (paper: Paper) => paper !== 'uni'

/** What ruled paper can draw: whole lines only. */
export const allowedOnRuled = {
  lineHeight: (v: LineHeight) => v === 1 || v === 2,
  space: (v: ParagraphSpace) => v === 0 || v === 32,
}

/** The value as the paper draws it: on ruled paper, rounded to whole lines. */
export function drawnSpacing(spacing: ParagraphSpacing, paper: Paper): ParagraphSpacing {
  if (!isRuled(paper)) return spacing
  const space = (v: ParagraphSpace): ParagraphSpace => (v >= 16 ? 32 : 0)
  return {
    lineHeight: spacing.lineHeight >= 1.5 ? 2 : 1,
    spaceBefore: space(spacing.spaceBefore),
    spaceAfter: space(spacing.spaceAfter),
    indent: spacing.indent,
  }
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    noteSpacing: {
      /** Sets spacing values on every paragraph of the selection; a default value is removed. */
      setParagraphSpacing: (values: Partial<ParagraphSpacing>) => ReturnType
    }
  }
}

const attribute = (key: keyof ParagraphSpacing, data: string) => ({
  default: null,
  parseHTML: (el: HTMLElement) => {
    const value = Number(el.getAttribute(`data-${data}`))
    return el.hasAttribute(`data-${data}`) && Number.isFinite(value) && value !== DEFAULT_SPACING[key] ? value : null
  },
  renderHTML: (attrs: Record<string, unknown>) => (typeof attrs[key] === 'number' ? { [`data-${data}`]: attrs[key] } : {}),
})

export const NoteSpacing = Extension.create({
  name: 'noteSpacing',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph'],
        attributes: {
          lineHeight: attribute('lineHeight', 'line'),
          spaceBefore: attribute('spaceBefore', 'before'),
          spaceAfter: attribute('spaceAfter', 'after'),
          indent: attribute('indent', 'indent'),
        },
      },
    ]
  },

  addCommands() {
    return {
      setParagraphSpacing:
        (values) =>
        ({ commands }) => {
          const attrs: Record<string, number | null> = {}
          for (const [key, value] of Object.entries(values) as [keyof ParagraphSpacing, number][]) {
            attrs[key] = value === DEFAULT_SPACING[key] ? null : value
          }
          return commands.updateAttributes('paragraph', attrs)
        },
    }
  },
})

/** The spacing of the paragraph holding the cursor, defaults filled in. */
export function readSpacing(attrs: Record<string, unknown>): ParagraphSpacing {
  const pick = <T extends number>(value: unknown, list: readonly T[], fallback: T) =>
    list.includes(value as T) ? (value as T) : fallback
  return {
    lineHeight: pick(attrs.lineHeight, LINE_HEIGHTS, 1),
    spaceBefore: pick(attrs.spaceBefore, PARAGRAPH_SPACES, 0),
    spaceAfter: pick(attrs.spaceAfter, PARAGRAPH_SPACES, 0),
    indent: pick(attrs.indent, INDENTS, 0),
  }
}
