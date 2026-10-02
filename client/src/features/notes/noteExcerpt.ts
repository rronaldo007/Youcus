import type { NoteDoc, NoteNode } from '@/features/notes/noteDoc'

const BLOCKS = new Set(['paragraph', 'heading', 'listItem', 'taskItem', 'blockquote', 'codeBlock'])

/**
 * The words of a note, one block after the other, for a preview (Figma « Détail de playlist »,
 * « Note de la playlist »). Charts, diagrams and images have no words: they are skipped.
 */
export function noteExcerpt(doc: NoteDoc | null | undefined): string {
  const parts: string[] = []
  const walk = (node: NoteNode) => {
    if (node.text) parts.push(node.text)
    node.content?.forEach(walk)
    if (BLOCKS.has(node.type)) parts.push(' ')
  }
  doc?.content.forEach(walk)
  return parts.join('').replace(/\s+/g, ' ').trim()
}
