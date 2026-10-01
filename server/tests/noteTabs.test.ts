import { describe, expect, it } from 'vitest'
import { docToPlainText, parseNoteDoc, type NoteDoc } from '@/lib/noteDoc'

// Tabs of a note (YC-52): pages with a title; what the editor sends is kept, anything else refused.

const p = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })
const tab = (title: string, ...content: unknown[]) => ({ type: 'noteTab', attrs: { title }, content })
const tabs = (...content: unknown[]) => ({ type: 'noteTabs', content })
const doc = (...content: unknown[]) => ({ type: 'doc', content })

describe('tabs in a note (YC-52)', () => {
  it('keeps the tabs, their titles and pages; a tab may hold a table and an image', () => {
    const table = { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [p('x')] }] }] }
    const image = { type: 'noteImage', attrs: { id: '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e' } }
    const input = doc(tabs(tab('Théorie', p('Un effet')), tab('Exemple', table, image)))
    const parsed = parseNoteDoc(input)
    expect(parsed.ok).toBe(true)
    expect((parsed as { doc: NoteDoc }).doc).toEqual(input)
  })

  it('refuses tabs in tabs, tabs in a table cell, an empty or long title, an empty tab, more than 8', () => {
    expect(parseNoteDoc(doc(tabs(tab('A', tabs(tab('B', p('x'))))))).ok).toBe(false)
    const cellWithTabs = { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [tabs(tab('A', p('x')))] }] }] }
    expect(parseNoteDoc(doc(cellWithTabs)).ok).toBe(false)
    expect(parseNoteDoc(doc(tabs(tab('   ', p('x'))))).ok).toBe(false)
    expect(parseNoteDoc(doc(tabs(tab('a'.repeat(41), p('x'))))).ok).toBe(false)
    expect(parseNoteDoc(doc(tabs({ type: 'noteTab', attrs: { title: 'A' }, content: [] }))).ok).toBe(false)
    expect(parseNoteDoc(doc(tabs(...Array.from({ length: 9 }, (_, i) => tab(`T${i}`, p('x')))))).ok).toBe(false)
    expect(parseNoteDoc(doc({ type: 'noteTabs', content: [] })).ok).toBe(false)
  })

  it('reads every tab for search and export: its title, then its lines', () => {
    const parsed = parseNoteDoc(doc(p('Avant'), tabs(tab('Théorie', p('Un effet')), tab('Exemple', p('Le code'))), p('Après')))
    expect(docToPlainText((parsed as { doc: NoteDoc }).doc)).toBe('Avant\nThéorie\nUn effet\nExemple\nLe code\nAprès')
  })
})
