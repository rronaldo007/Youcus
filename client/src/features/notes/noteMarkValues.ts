/**
 * Colours, highlights, fonts and sizes of a note (YC-42). A note stores the NAME of a colour
 * (« rouge »), never a hex: the CSS turns the name into a light or dark token, so a note stays
 * readable in both themes. The same lists are enforced by the server (server/src/lib/noteDoc.ts).
 */

export const TEXT_COLORS = ['encre', 'gris', 'rouge', 'orange', 'vert', 'bleu', 'violet', 'prune'] as const
export const HIGHLIGHTS = ['jaune', 'vert', 'bleu', 'rose', 'orange', 'violet', 'gris'] as const
export const FONTS = [
  { id: 'hanken', label: 'Hanken Grotesk', hint: 'par défaut' },
  { id: 'instrument', label: 'Instrument Serif', hint: 'titres' },
  { id: 'lora', label: 'Lora', hint: 'lecture' },
  { id: 'atkinson', label: 'Atkinson Hyperlegible', hint: 'lisibilité' },
  { id: 'jetbrains', label: 'JetBrains Mono', hint: 'code' },
  { id: 'caveat', label: 'Caveat', hint: 'manuscrite' },
] as const
export const SIZES = [12, 14, 16, 18, 20, 24, 28, 32] as const

export type TextColor = (typeof TEXT_COLORS)[number]
export type Highlight = (typeof HIGHLIGHTS)[number]
export type FontId = (typeof FONTS)[number]['id']
export type FontSize = (typeof SIZES)[number]

/** Unmarked text: ink, no highlight, Hanken Grotesk, 16 px. Choosing a default removes the mark. */
export const DEFAULT_COLOR: TextColor = 'encre'
export const DEFAULT_FONT: FontId = 'hanken'
export const DEFAULT_SIZE: FontSize = 16

export const COLOR_LABELS: Record<TextColor | Highlight, string> = {
  encre: 'Encre',
  gris: 'Gris',
  rouge: 'Rouge',
  orange: 'Orange',
  vert: 'Vert',
  bleu: 'Bleu',
  violet: 'Violet',
  prune: 'Prune',
  jaune: 'Jaune',
  rose: 'Rose',
}
