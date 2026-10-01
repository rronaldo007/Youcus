import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Editor } from '@tiptap/react'
import { TextSelection } from '@tiptap/pm/state'
import { Packer } from 'docx'
import JSZip from 'jszip'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NoteDoc, NoteNode } from './noteDoc'
import { DEFAULT_PAGE } from './notePage'
import { buildNoteDocument } from './noteToDocx'
import { VideoNotes } from './VideoNotes'

// Tables in a note (YC-51), through the real editor, Figma « Bloc de note › Tableau » 65:2071.

const para = (text: string): NoteNode => ({ type: 'paragraph', content: text ? [{ type: 'text', text }] : undefined })
const cell = (text: string, type = 'tableCell'): NoteNode => ({ type, content: [para(text)] })
const row = (...cells: NoteNode[]): NoteNode => ({ type: 'tableRow', content: cells })
let initialDoc: NoteDoc
let puts: { doc: NoteDoc }[]

async function ready() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const view = render(
    <QueryClientProvider client={client}>
      <VideoNotes videoId="v1" />
    </QueryClientProvider>,
  )
  const el = await screen.findByRole('textbox', { name: 'Note de la vidéo' }, { timeout: 5000 })
  await waitFor(() => expect(el).toHaveTextContent('première'))
  return { ...view, editor: (el as unknown as { editor: Editor }).editor }
}

/** The table as text, row by row; a header cell starts with #. */
const grid = (editor: Editor) => {
  const table = (editor.getJSON() as { content?: NoteNode[] }).content?.find((n) => n.type === 'table')
  return (table?.content ?? []).map((r) =>
    (r.content ?? []).map((c) => {
      const text = (c.content ?? []).map((p) => (p.content ?? []).map((t) => t.text).join('')).join(' ')
      return c.type === 'tableHeader' ? `#${text}` : text
    }),
  )
}

/** Puts the cursor in the cell holding `text`. */
function cursorIn(editor: Editor, text: string) {
  let at = -1
  editor.state.doc.descendants((node, pos) => {
    if (at < 0 && node.isText && node.text === text) at = pos
    return at < 0
  })
  act(() => {
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, at + 1)))
  })
}

const sample = (): NoteNode => ({
  type: 'table',
  content: [
    row(cell('Dépendances', 'tableHeader'), cell('Quand', 'tableHeader')),
    row(cell('[a, b]'), cell('Quand a ou b change')),
    row(cell('[]'), cell('Une fois')),
    row(cell('aucun'), cell('Après chaque rendu')),
  ],
})

describe('tables in a note (YC-51)', () => {
  beforeEach(() => {
    initialDoc = { type: 'doc', content: [para('première ligne')] }
    puts = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'PUT') {
          const body = JSON.parse(init.body as string) as { doc: NoteDoc }
          puts.push(body)
          return new Response(JSON.stringify({ ...body, updatedAt: '2026-10-01T10:00:00Z' }), { status: 200 })
        }
        return new Response(JSON.stringify({ doc: initialDoc, page: null, updatedAt: '2026-10-01T10:00:00Z' }), { status: 200 })
      }),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('« + Insérer » shows 3 × 4 under the pointer and inserts that table, header row first', async () => {
    const { editor } = await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Insérer' }))
    const menu = screen.getByRole('menu', { name: 'Insérer' })
    expect(within(menu).getByText('3 lignes × 4 colonnes')).toBeInTheDocument()
    fireEvent.mouseEnter(within(menu).getByRole('menuitem', { name: 'Tableau de 2 lignes × 5 colonnes' }))
    expect(within(menu).getByText('2 lignes × 5 colonnes')).toBeInTheDocument()
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Tableau de 3 lignes × 4 colonnes' }))
    expect(grid(editor)).toEqual([['#', '#', '#', '#'], ['', '', '', ''], ['', '', '', '']])
    // The table's bar comes with the cursor inside it, and no table goes into a table.
    expect(screen.getByRole('toolbar', { name: 'Tableau' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Insérer un tableau' })).toHaveAttribute('aria-disabled', 'true')
  })

  it('« Insérer un tableau » in the bar puts a 3 × 3 table, saved with the note', async () => {
    const { editor } = await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Insérer un tableau' }))
    expect(grid(editor)).toEqual([['#', '#', '#'], ['', '', ''], ['', '', '']])
    await waitFor(() => expect(puts.length).toBeGreaterThan(0), { timeout: 2500 })
    expect(puts[puts.length - 1].doc.content.some((n) => n.type === 'table')).toBe(true)
  })

  it('Tab goes to the next cell, never indents; after the last cell it adds a row', async () => {
    initialDoc = { type: 'doc', content: [para('première ligne'), sample()] }
    const { editor } = await ready()
    cursorIn(editor, '[a, b]')
    fireEvent.keyDown(editor.view.dom, { key: 'Tab' })
    expect(editor.state.selection.$from.parent.textContent).toBe('Quand a ou b change')
    // Tab moved the cursor, it did not indent the paragraph (YC-55's Tab).
    const table = (editor.getJSON() as { content?: NoteNode[] }).content?.find((n) => n.type === 'table')
    expect(table?.content?.[1].content?.[0].content?.[0].attrs?.indent ?? null).toBeNull()
    cursorIn(editor, 'Après chaque rendu')
    fireEvent.keyDown(editor.view.dom, { key: 'Tab' })
    expect(grid(editor)).toHaveLength(5)
  })

  describe('its bar, Figma 65:2071', () => {
    const withTable = async (text = 'Une fois') => {
      initialDoc = { type: 'doc', content: [para('première ligne'), sample()] }
      const out = await ready()
      cursorIn(out.editor, text)
      return { ...out, bar: screen.getByRole('toolbar', { name: 'Tableau' }) }
    }

    it('+ Ligne and + Colonne add after the cursor; « Ajouter une ligne » adds at the end', async () => {
      const { editor, bar } = await withTable('[a, b]')
      fireEvent.click(within(bar).getByRole('button', { name: '+ Ligne' }))
      expect(grid(editor)[2]).toEqual(['', ''])
      fireEvent.click(within(bar).getByRole('button', { name: '+ Colonne' }))
      expect(grid(editor)[1]).toEqual(['[a, b]', '', 'Quand a ou b change'])
      fireEvent.click(screen.getByRole('button', { name: 'Ajouter une ligne' }))
      expect(grid(editor)[grid(editor).length - 1]).toEqual(['', '', ''])
    })

    it('« En-tête » turns the first row into a header, and back', async () => {
      const { editor, bar } = await withTable()
      const header = within(bar).getByRole('button', { name: 'En-tête' })
      expect(header).toHaveAttribute('aria-pressed', 'true')
      fireEvent.click(header)
      expect(grid(editor)[0]).toEqual(['Dépendances', 'Quand'])
      expect(within(screen.getByRole('toolbar', { name: 'Tableau' })).getByRole('button', { name: 'En-tête' })).toHaveAttribute('aria-pressed', 'false')
    })

    it('« Trier » sorts the rows by the column of the cursor, the header stays on top; again, the other way', async () => {
      const { editor, bar } = await withTable('[]')
      const sort = within(bar).getByRole('button', { name: 'Trier par la colonne du curseur' })
      fireEvent.click(sort)
      expect(grid(editor).map((r) => r[0])).toEqual(['#Dépendances', '[]', '[a, b]', 'aucun'])
      // The cursor stayed in its row, moved with it.
      expect(editor.state.selection.$from.parent.textContent).toBe('[]')
      fireEvent.click(sort)
      expect(grid(editor).map((r) => r[0])).toEqual(['#Dépendances', 'aucun', '[a, b]', '[]'])
    })

    it('sorts numbers as numbers', async () => {
      initialDoc = {
        type: 'doc',
        content: [para('première ligne'), { type: 'table', content: [row(cell('10')), row(cell('9')), row(cell('100'))] }],
      }
      const { editor } = await ready()
      cursorIn(editor, '9')
      fireEvent.click(within(screen.getByRole('toolbar', { name: 'Tableau' })).getByRole('button', { name: 'Trier par la colonne du curseur' }))
      expect(grid(editor).map((r) => r[0])).toEqual(['9', '10', '100'])
    })

    it('« Supprimer le tableau » removes it, and its bar with it', async () => {
      const { editor, bar } = await withTable()
      fireEvent.click(within(bar).getByRole('button', { name: 'Supprimer le tableau' }))
      expect(editor.getJSON().content?.some((n) => n.type === 'table')).toBe(false)
      expect(screen.queryByRole('toolbar', { name: 'Tableau' })).not.toBeInTheDocument()
    })

    it('in « Aperçu », there is no bar', async () => {
      await withTable()
      fireEvent.click(screen.getByRole('button', { name: 'Aperçu' }))
      await waitFor(() => expect(screen.queryByRole('toolbar', { name: 'Tableau' })).not.toBeInTheDocument())
    })
  })
})

describe('tables in the .docx (YC-51)', () => {
  it('writes a real Word table: its rows and cells, the header sunken, bold and repeated', async () => {
    const buffer = await Packer.toBuffer(buildNoteDocument({ type: 'doc', content: [sample()] } as NoteDoc, { title: 'Note', page: DEFAULT_PAGE }))
    const xml = await (await JSZip.loadAsync(buffer)).file('word/document.xml')!.async('string')
    expect(xml.match(/<w:tbl>/g)).toHaveLength(1)
    expect(xml.match(/<w:tr>|<w:tr /g)).toHaveLength(4)
    expect(xml.match(/<w:tc>/g)).toHaveLength(8)
    expect(xml).toContain('<w:tblHeader/>')
    expect(xml).toContain('w:fill="EAE4D7"')
    expect(xml).toMatch(/<w:b\/>[\s\S]*?>Dépendances<\/w:t>/)
    expect(xml).toContain('>Quand a ou b change</w:t>')
  })
})
