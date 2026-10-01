import { describe, expect, it } from 'vitest'
import { docToPlainText, parseNoteDoc, type NoteDoc } from '@/lib/noteDoc'

// Diagrams of a note (YC-53): shapes and arrows between them; what the editor sends is kept,
// anything else refused.

const p = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })
const doc = (...content: unknown[]) => ({ type: 'doc', content })
const shape = (id: string, over: Record<string, unknown> = {}) => ({
  id, kind: 'rect', x: 0, y: 0, w: 160, h: 64, text: '', color: 'bleu', ...over,
})
const arrow = (id: string, from: string, to: string, label = '') => ({ id, from, to, label })
const diagram = (shapes: unknown[], arrows: unknown[] = []) => ({ type: 'noteDiagram', attrs: { scene: { shapes, arrows } } })
const ok = (input: unknown) => parseNoteDoc(input).ok

describe('diagrams in a note (YC-53)', () => {
  it('keeps the shapes, their colours and the named arrows; a tab may hold a diagram', () => {
    const d = diagram(
      [shape('a', { text: 'Code modifié' }), shape('b', { kind: 'diamond', x: 260, color: 'orange' }), shape('c', { kind: 'ellipse', y: 200 })],
      [arrow('z', 'a', 'b'), arrow('y', 'b', 'c', 'oui')],
    )
    const input = doc(p('Avant'), d, { type: 'noteTabs', content: [{ type: 'noteTab', attrs: { title: 'Schéma' }, content: [d] }] })
    const parsed = parseNoteDoc(input)
    expect(parsed.ok).toBe(true)
    expect((parsed as { doc: NoteDoc }).doc).toEqual(input)
    expect(ok(doc(diagram([])))).toBe(true)
  })

  it('refuses an arrow to a shape that is not there, to itself, twice the same id', () => {
    expect(ok(doc(diagram([shape('a')], [arrow('z', 'a', 'b')])))).toBe(false)
    expect(ok(doc(diagram([shape('a')], [arrow('z', 'a', 'a')])))).toBe(false)
    expect(ok(doc(diagram([shape('a'), shape('a', { x: 300 })])))).toBe(false)
    expect(ok(doc(diagram([shape('a'), shape('b')], [arrow('a', 'a', 'b')])))).toBe(false)
  })

  it('refuses a wrong kind, colour, id, size, place, a long text, too many shapes', () => {
    expect(ok(doc(diagram([shape('a', { kind: 'star' })])))).toBe(false)
    expect(ok(doc(diagram([shape('a', { color: '#ff0000' })])))).toBe(false)
    expect(ok(doc(diagram([shape('A-1')])))).toBe(false)
    expect(ok(doc(diagram([shape('a', { w: 2 })])))).toBe(false)
    expect(ok(doc(diagram([shape('a', { x: 20_000 })])))).toBe(false)
    expect(ok(doc(diagram([shape('a', { y: Number.NaN })])))).toBe(false)
    expect(ok(doc(diagram([shape('a', { text: 'x'.repeat(201) })])))).toBe(false)
    expect(ok(doc(diagram(Array.from({ length: 101 }, (_, i) => shape(`s${i}`)))))).toBe(false)
    expect(ok(doc({ type: 'noteDiagram', attrs: {} }))).toBe(false)
  })

  it('refuses a diagram in a table cell', () => {
    const cell = { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [diagram([])] }] }] }
    expect(ok(doc(cell))).toBe(false)
  })

  it('reads the words of the drawing for search and export: shapes, then arrows', () => {
    const parsed = parseNoteDoc(doc(p('Avant'), diagram([shape('a', { text: 'Code' }), shape('b', { text: 'Tests' })], [arrow('z', 'a', 'b', 'lance')])))
    expect(docToPlainText((parsed as { doc: NoteDoc }).doc)).toBe('Avant\nCode\nTests\nlance')
  })
})
