import { describe, expect, it } from 'vitest'
import { docToPlainText, parseNoteDoc, type NoteDoc } from '@/lib/noteDoc'

// Charts of a note (YC-54): a title, a kind, a small table; what the editor sends is kept,
// anything else refused.

const p = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })
const doc = (...content: unknown[]) => ({ type: 'doc', content })
const chart = (over: Record<string, unknown> = {}) => ({
  type: 'noteChart',
  attrs: { chart: { title: 'Temps d’étude (min)', kind: 'bar', rows: [{ label: 'L', value: 32 }, { label: 'M', value: null }], ...over } },
})
const ok = (input: unknown) => parseNoteDoc(input).ok

describe('charts in a note (YC-54)', () => {
  it('keeps the title, the kind and the rows, an empty value as null; a tab may hold a chart', () => {
    const input = doc(p('Avant'), chart({ kind: 'pie' }), { type: 'noteTabs', content: [{ type: 'noteTab', attrs: { title: 'Bilan' }, content: [chart({ kind: 'line' })] }] })
    const parsed = parseNoteDoc(input)
    expect(parsed.ok).toBe(true)
    expect((parsed as { doc: NoteDoc }).doc).toEqual(input)
  })

  it('refuses a wrong kind, a negative or huge value, a text value, no row, too many, long texts', () => {
    expect(ok(doc(chart({ kind: 'radar' })))).toBe(false)
    expect(ok(doc(chart({ rows: [{ label: 'a', value: -1 }] })))).toBe(false)
    expect(ok(doc(chart({ rows: [{ label: 'a', value: 2e9 }] })))).toBe(false)
    expect(ok(doc(chart({ rows: [{ label: 'a', value: '12' }] })))).toBe(false)
    expect(ok(doc(chart({ rows: [] })))).toBe(false)
    expect(ok(doc(chart({ rows: Array.from({ length: 25 }, (_, i) => ({ label: `${i}`, value: i })) })))).toBe(false)
    expect(ok(doc(chart({ title: 'x'.repeat(81) })))).toBe(false)
    expect(ok(doc(chart({ rows: [{ label: 'x'.repeat(25), value: 1 }] })))).toBe(false)
    expect(ok(doc({ type: 'noteChart', attrs: {} }))).toBe(false)
  })

  it('refuses a chart in a table cell', () => {
    const table = { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [chart()] }] }] }
    expect(ok(doc(table))).toBe(false)
  })

  it('reads the chart for search and export: its title, then each label and value', () => {
    const parsed = parseNoteDoc(doc(p('Avant'), chart({ rows: [{ label: 'L', value: 32 }, { label: 'M', value: null }, { label: '', value: null }] })))
    expect(docToPlainText((parsed as { doc: NoteDoc }).doc)).toBe('Avant\nTemps d’étude (min)\nL 32\nM')
  })
})
