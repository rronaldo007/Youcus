import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Editor } from '@tiptap/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NoteDoc, NoteNode } from './noteDoc'
import { keepInScreen } from './noteSlashMenu'
import { VideoNotes } from './VideoNotes'

// « / » at the start of a line (YC-64), through the real editor.

const para = (text?: string): NoteNode => ({ type: 'paragraph', ...(text ? { content: [{ type: 'text', text }] } : {}) })
let storedDoc: NoteDoc

async function ready() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <VideoNotes videoId="v1" />
    </QueryClientProvider>,
  )
  const el = await screen.findByRole('textbox', { name: 'Note de la vidéo' }, { timeout: 5000 })
  await waitFor(() => expect(el).toHaveTextContent('Les hooks'))
  return { el, editor: (el as unknown as { editor: Editor }).editor }
}

/** The cursor at the end of the last line, then the text typed there. */
function typeAtEnd(editor: Editor, text: string) {
  act(() => {
    editor.commands.setTextSelection(editor.state.doc.content.size - 1)
    editor.commands.insertContent(text)
  })
}

const list = () => screen.queryByRole('listbox', { name: 'Insérer un bloc' })
const labels = () =>
  within(list()!)
    .getAllByRole('option')
    .map((o) => o.querySelector('.yc-menu-item-label')?.textContent)
const blocks = (editor: Editor) => ((editor.getJSON() as NoteDoc).content ?? []).map((n) => n.type)

describe('« / » menu (YC-64)', () => {
  beforeEach(() => {
    storedDoc = { type: 'doc', content: [para('Les hooks essentiels'), para()] }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'PUT') return new Response(JSON.stringify({ ...JSON.parse(init.body as string), updatedAt: '2026-10-01T10:00:00Z' }), { status: 200 })
        return new Response(JSON.stringify({ doc: storedDoc, updatedAt: '2026-10-01T10:00:00Z' }), { status: 200 })
      }),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('« / » on an empty line lists the ten entries of « + Insérer », blocks first', async () => {
    const { editor } = await ready()
    typeAtEnd(editor, '/')
    await waitFor(() => expect(list()).toBeInTheDocument())
    expect(labels()).toEqual(['Image', 'Tableau', 'Onglets', 'Schéma', 'Graphique', 'Lien', 'Bloc de code', 'Citation', 'Icône', 'Séparateur'])
    expect(within(list()!).getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true')
  })

  it('what follows the slash filters, accents aside, and Entrée inserts the block in place of « /schema »', async () => {
    const { el, editor } = await ready()
    typeAtEnd(editor, '/schema')
    await waitFor(() => expect(labels()).toEqual(['Schéma']))
    fireEvent.keyDown(el, { key: 'Enter' })
    await waitFor(() => expect(blocks(editor)).toContain('noteDiagram'))
    expect(el).not.toHaveTextContent('/schema')
    expect(list()).not.toBeInTheDocument()
  })

  it('English words find too, and the arrows move the choice', async () => {
    const { el, editor } = await ready()
    typeAtEnd(editor, '/c')
    await waitFor(() => expect(labels()).toEqual(['Graphique', 'Bloc de code', 'Citation']))
    fireEvent.keyDown(el, { key: 'ArrowDown' })
    fireEvent.keyDown(el, { key: 'Enter' })
    await waitFor(() => expect(blocks(editor)).toContain('codeBlock'))
  })

  it('a slash inside a line is only a slash, even after a space', async () => {
    const { editor } = await ready()
    act(() => {
      editor.commands.setTextSelection(editor.state.doc.content.size - 3)
      editor.commands.insertContent(' /')
    })
    await new Promise((r) => setTimeout(r, 50))
    expect(list()).not.toBeInTheDocument()
  })

  it('in a table, the blocks that cannot sit there are left out', async () => {
    storedDoc = {
      type: 'doc',
      content: [
        para('Les hooks essentiels'),
        { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [para()] }] }] },
      ],
    }
    const { editor } = await ready()
    // The editor keeps a paragraph after a table: the cursor goes in the cell itself.
    let inCell = 0
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'tableCell') inCell = pos + 2
    })
    act(() => {
      editor.commands.setTextSelection(inCell)
      editor.commands.insertContent('/')
    })
    expect(editor.isActive('table')).toBe(true)
    await waitFor(() => expect(list()).toBeInTheDocument())
    expect(labels()).toEqual(['Image', 'Lien', 'Bloc de code', 'Citation', 'Icône', 'Séparateur'])
  })

  it('« Lien » opens the link field, the slash gone', async () => {
    const { el, editor } = await ready()
    typeAtEnd(editor, '/lien')
    await waitFor(() => expect(labels()).toEqual(['Lien']))
    fireEvent.keyDown(el, { key: 'Enter' })
    expect(await screen.findByRole('form', { name: 'Lien' })).toBeInTheDocument()
    expect(el).not.toHaveTextContent('/lien')
  })

  it('Échap closes the list and leaves what was typed', async () => {
    const { el, editor } = await ready()
    typeAtEnd(editor, '/ta')
    await waitFor(() => expect(list()).toBeInTheDocument())
    fireEvent.keyDown(el, { key: 'Escape', keyCode: 27 })
    await waitFor(() => expect(list()).not.toBeInTheDocument())
    expect(el).toHaveTextContent('/ta')
    expect(blocks(editor)).not.toContain('table')
  })

  it('the list stays 8 px inside the screen on a phone', async () => {
    Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 390 })
    const at = (x: number) => keepInScreen.fn({ x, y: 50, rects: { floating: { width: 320, height: 400 } } } as never)
    expect(await at(116)).toEqual({ x: 62, y: 50 })
    expect(await at(-20)).toEqual({ x: 8, y: 50 })
    expect(await at(30)).toEqual({ x: 30, y: 50 })
  })
})
