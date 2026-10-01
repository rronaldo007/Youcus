import { Mark, mergeAttributes } from '@tiptap/react'
import { FONTS, HIGHLIGHTS, SIZES, TEXT_COLORS } from '@/features/notes/noteMarkValues'

// The lists live apart, without TipTap, so that Réglages › Notes can use them without loading the
// editor (YC-48); they are re-exported here for everything else.
export * from '@/features/notes/noteMarkValues'

/**
 * A mark with one attribute taken from a fixed list, rendered as `data-*`. Pasted HTML keeps
 * the mark only if its value is in the list: a pasted `style="color:#f00"` is dropped.
 */
function namedMark<T extends string | number>(name: string, attr: string, dataAttr: string, values: readonly T[], tag = 'span') {
  const parse = (raw: string | null): T | null => values.find((v) => String(v) === raw) ?? null
  return Mark.create({
    name,
    addAttributes() {
      return {
        [attr]: {
          default: null,
          parseHTML: (el: HTMLElement) => parse(el.getAttribute(dataAttr)),
          renderHTML: (attrs: Record<string, unknown>) => ({ [dataAttr]: attrs[attr] }),
        },
      }
    },
    parseHTML() {
      return [{ tag: `${tag}[${dataAttr}]`, getAttrs: (el: HTMLElement) => (parse(el.getAttribute(dataAttr)) === null ? false : null) }]
    },
    renderHTML({ HTMLAttributes }) {
      return [tag, mergeAttributes(HTMLAttributes), 0]
    },
  })
}

export const TextColorMark = namedMark('textColor', 'color', 'data-color', TEXT_COLORS)
export const HighlightMark = namedMark('highlight', 'color', 'data-highlight', HIGHLIGHTS, 'mark')
export const TextFontMark = namedMark(
  'textFont',
  'font',
  'data-font',
  FONTS.map((f) => f.id),
)
export const TextSizeMark = namedMark('textSize', 'size', 'data-size', SIZES)
