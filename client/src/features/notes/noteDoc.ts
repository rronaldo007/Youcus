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
  updatedAt: string
}
