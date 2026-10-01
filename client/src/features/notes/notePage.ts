/**
 * The page of a note (YC-45), Figma « Papier de note » (37:1447) and menu « Page » (38:707).
 * Stored per note as names; the CSS gives each tint a light and a dark value. Same lists as
 * server/src/lib/notePage.ts.
 */
export const PAPERS = [
  { id: 'lignes', label: 'Lignes' },
  { id: 'seyes', label: 'Seyès' },
  { id: 'carreaux', label: 'Carreaux' },
  { id: 'points', label: 'Points' },
  { id: 'uni', label: 'Uni' },
] as const

export const TINTS = [
  { id: 'creme', label: 'Crème' },
  { id: 'blanc', label: 'Blanc' },
  { id: 'sepia', label: 'Sépia' },
  { id: 'bleu', label: 'Bleu pâle' },
  { id: 'vert', label: 'Vert pâle' },
] as const

export type Paper = (typeof PAPERS)[number]['id']
export type Tint = (typeof TINTS)[number]['id']

export interface NotePage {
  paper: Paper
  tint: Tint
  /** The margin column on the left, with its red rule (timestamps go there, YC-56). */
  margin: boolean
  /** Whether the timestamped markers are shown (YC-56); hiding them deletes none. */
  timestamps: boolean
}

/** A note never given a page: lined cream paper with its margin, as in the mockup (34:217). */
export const DEFAULT_PAGE: NotePage = { paper: 'lignes', tint: 'creme', margin: true, timestamps: true }

/** A stored page with what it lacks taken from the defaults: pages saved before YC-56 have no `timestamps`. */
export const readPage = (stored: Partial<NotePage> | null | undefined): NotePage => ({ ...DEFAULT_PAGE, ...stored })

export const paperLabel = (id: Paper) => PAPERS.find((p) => p.id === id)?.label ?? 'Lignes'
