import type { NotePage } from '@/features/notes/notePage'

/**
 * Rich-editor note document (YC-40): TipTap / ProseMirror JSON. The server validates it and
 * only keeps the nodes and marks the editor offers (see server/src/lib/noteDoc.ts).
 */
export interface NoteNode {
  type: string
  attrs?: Record<string, unknown>
  content?: NoteNode[]
  marks?: { type: string; attrs?: Record<string, unknown> }[]
  text?: string
}

export interface NoteDoc {
  type: 'doc'
  content: NoteNode[]
}

export const EMPTY_DOC: NoteDoc = { type: 'doc', content: [] }

export interface NoteData {
  doc: NoteDoc
  /** Paper, tint and margin (YC-45); null = never chosen, the defaults apply. */
  page?: Partial<NotePage> | null
  updatedAt: string
}

/** What an autosave sends: the document, and the page when it was changed. */
export interface NoteSave {
  doc: NoteDoc
  page?: NotePage
}

/** Only what opens a web page or a mail client, like the server (server/src/lib/noteDoc.ts). */
export function isSafeHref(url: string): boolean {
  try {
    return ['http:', 'https:', 'mailto:'].includes(new URL(url).protocol)
  } catch {
    return false
  }
}

/** « exemple.fr » becomes « https://exemple.fr »; an address with a scheme is kept as typed. */
export function normalizeHref(value: string): string {
  const url = value.trim()
  if (!url) return ''
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url
  return url.includes('@') && !url.includes('/') ? `mailto:${url}` : `https://${url}`
}
