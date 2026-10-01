import { describe, expect, it } from 'vitest'
import { docToPlainText, parseNoteDoc, type NoteDoc } from '@/lib/noteDoc'

// Tables of a note (YC-51): what the editor sends is kept, cleaned; anything else is refused.

const p = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })
// Exactly what TipTap sends: every cell with colspan 1, rowspan 1, colwidth null.
const tiptapCell = (type: string, text: string) => ({ type, attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [p(text)] })
const row = (...cells: unknown[]) => ({ type: 'tableRow', content: cells })
const doc = (...content: unknown[]) => ({ type: 'doc', content })
const table = (...rows: unknown[]) => ({ type: 'table', content: rows })

describe('a table in a note (YC-51)', () => {
  it('keeps what the editor sends, without the default cell attributes', () => {
    const parsed = parseNoteDoc(
      doc(table(row(tiptapCell('tableHeader', 'Dépendances'), tiptapCell('tableHeader', 'Quand')), row(tiptapCell('tableCell', '[]'), tiptapCell('tableCell', 'Une fois')))),
    )
    expect(parsed.ok).toBe(true)
    const stored = (parsed as { doc: NoteDoc }).doc.content[0]
    expect(stored).toEqual(
      table(row({ type: 'tableHeader', content: [p('Dépendances')] }, { type: 'tableHeader', content: [p('Quand')] }), row({ type: 'tableCell', content: [p('[]')] }, { type: 'tableCell', content: [p('Une fois')] })),
    )
  })

  it('a cell may hold a list, a heading, code', () => {
    const list = { type: 'bulletList', content: [{ type: 'listItem', content: [p('un')] }] }
    expect(parseNoteDoc(doc(table(row({ type: 'tableCell', content: [list, { type: 'codeBlock', content: [{ type: 'text', text: 'x' }] }] })))).ok).toBe(true)
  })

  it('refuses a table in a table, an image in a cell, merged cells, an uneven table', () => {
    const inner = table(row(tiptapCell('tableCell', 'x')))
    expect(parseNoteDoc(doc(table(row({ type: 'tableCell', content: [inner] })))).ok).toBe(false)
    const image = { type: 'noteImage', attrs: { id: '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e' } }
    expect(parseNoteDoc(doc(table(row({ type: 'tableCell', content: [image] })))).ok).toBe(false)
    expect(parseNoteDoc(doc(table(row({ type: 'tableCell', attrs: { colspan: 2 }, content: [p('x')] })))).ok).toBe(false)
    expect(parseNoteDoc(doc(table(row(tiptapCell('tableCell', 'a'), tiptapCell('tableCell', 'b')), row(tiptapCell('tableCell', 'c'))))).ok).toBe(false)
  })

  it('refuses an empty cell or row, and more than 20 columns', () => {
    expect(parseNoteDoc(doc(table(row({ type: 'tableCell', content: [] })))).ok).toBe(false)
    expect(parseNoteDoc(doc(table(row()))).ok).toBe(false)
    const wide = row(...Array.from({ length: 21 }, (_, i) => tiptapCell('tableCell', String(i))))
    expect(parseNoteDoc(doc(table(wide))).ok).toBe(false)
  })

  it('reads as one line per row, cells separated by tabs, for search and export', () => {
    const parsed = parseNoteDoc(doc(p('Avant'), table(row(tiptapCell('tableHeader', 'A'), tiptapCell('tableHeader', 'B')), row(tiptapCell('tableCell', '1'), tiptapCell('tableCell', '2'))), p('Après')))
    expect(docToPlainText((parsed as { doc: NoteDoc }).doc)).toBe('Avant\nA\tB\n1\t2\nAprès')
  })
})
