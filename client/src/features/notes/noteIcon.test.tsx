import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Editor } from '@tiptap/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NoteDoc } from './noteDoc'
import { VideoNotes } from './VideoNotes'

let puts: { doc: NoteDoc }[]

/** An empty note, the cursor in its paragraph. */
async function readyEditor() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <VideoNotes videoId="v1" />
    </QueryClientProvider>,
  )
  const el = await screen.findByRole('textbox', { name: 'Note de la vidéo' }, { timeout: 5000 })
  await waitFor(() => expect(el).toHaveTextContent('Idée'))
  const editor = (el as unknown as { editor: Editor }).editor
  act(() => {
    editor.commands.setTextSelection(editor.state.doc.content.size - 1)
  })
  return { el, editor, toolbar: screen.getByRole('toolbar', { name: 'Mise en forme' }) }
}

/** The inline content of the first paragraph, as stored. */
const line = (editor: Editor) => (editor.getJSON().content ?? [])[0].content ?? []
const type = (editor: Editor, text: string) =>
  act(() => {
    editor.commands.insertContent(text)
  })

describe('icons in the text (YC-46)', () => {
  beforeEach(() => {
    puts = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'PUT') {
          const body = JSON.parse(init.body as string) as { doc: NoteDoc }
          puts.push(body)
          return new Response(JSON.stringify({ ...body, updatedAt: '2026-10-01T10:00:00Z' }), { status: 200 })
        }
        const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Idée ' }] }] }
        return new Response(JSON.stringify({ doc, updatedAt: '2026-10-01T10:00:00Z' }), { status: 200 })
      }),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('the toolbar menu shows the 15 icons and inserts the one clicked, then closes', async () => {
    const { el, editor, toolbar } = await readyEditor()
    fireEvent.click(within(toolbar).getByRole('button', { name: 'Insérer une icône' }))
    const menu = screen.getByRole('menu', { name: 'Insérer une icône' })
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(15)
    expect(within(menu).getByRole('searchbox', { name: 'Rechercher une icône' })).toHaveFocus()
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Ampoule' }))
    expect(line(editor)).toEqual([{ type: 'text', text: 'Idée ' }, { type: 'noteIcon', attrs: { name: 'ampoule' } }])
    expect(within(el).getByRole('img', { name: 'Ampoule' })).toHaveAttribute('data-icon', 'ampoule')
    expect(screen.queryByRole('menu', { name: 'Insérer une icône' })).not.toBeInTheDocument()
    await waitFor(() => expect(puts.length).toBeGreaterThan(0), { timeout: 3000 })
    expect(JSON.stringify(puts[puts.length - 1].doc)).toContain('"noteIcon"')
  })

  it('the search finds by name or keyword, accents aside, and Entrée inserts the first one', async () => {
    const { editor, toolbar } = await readyEditor()
    fireEvent.click(within(toolbar).getByRole('button', { name: 'Insérer une icône' }))
    const menu = screen.getByRole('menu', { name: 'Insérer une icône' })
    const search = within(menu).getByRole('searchbox')
    fireEvent.change(search, { target: { value: 'etoi' } })
    expect(within(menu).getAllByRole('menuitem').map((b) => b.getAttribute('aria-label'))).toEqual(['Étoile'])
    fireEvent.change(search, { target: { value: 'piège' } })
    expect(within(menu).getAllByRole('menuitem').map((b) => b.getAttribute('aria-label'))).toEqual(['Alerte'])
    fireEvent.keyDown(search, { key: 'Enter' })
    expect(line(editor).at(-1)).toEqual({ type: 'noteIcon', attrs: { name: 'alerte' } })
  })

  it('says when nothing matches', async () => {
    const { toolbar } = await readyEditor()
    fireEvent.click(within(toolbar).getByRole('button', { name: 'Insérer une icône' }))
    const menu = screen.getByRole('menu', { name: 'Insérer une icône' })
    fireEvent.change(within(menu).getByRole('searchbox'), { target: { value: 'licorne' } })
    expect(within(menu).queryAllByRole('menuitem')).toHaveLength(0)
    expect(within(menu).getByText('Aucune icône pour « licorne ».')).toBeInTheDocument()
  })

  it('takes the colour of the text it is typed into', async () => {
    const { editor } = await readyEditor()
    act(() => {
      editor.chain().setMark('textColor', { color: 'rouge' }).insertNoteIcon('alerte').run()
    })
    expect(line(editor).at(-1)).toEqual({ type: 'noteIcon', attrs: { name: 'alerte' }, marks: [{ type: 'textColor', attrs: { color: 'rouge' } }] })
  })

  it('« :amp » lists the bulb, and Entrée puts it in place of what was typed', async () => {
    const { el, editor } = await readyEditor()
    type(editor, ':amp')
    const list = await screen.findByRole('listbox', { name: 'Icônes' })
    expect(within(list).getAllByRole('option').map((o) => o.textContent)).toEqual(['Ampoule'])
    fireEvent.keyDown(el, { key: 'Enter' })
    expect(line(editor)).toEqual([{ type: 'text', text: 'Idée ' }, { type: 'noteIcon', attrs: { name: 'ampoule' } }])
    await waitFor(() => expect(screen.queryByRole('listbox', { name: 'Icônes' })).not.toBeInTheDocument())
  })

  it('the arrows choose in the list', async () => {
    const { el, editor } = await readyEditor()
    type(editor, ':c')
    const list = await screen.findByRole('listbox', { name: 'Icônes' })
    // Names first, then « Fermer » found by its keyword « croix ».
    expect(within(list).getAllByRole('option').map((o) => o.textContent)).toEqual(['Coche', 'Crayon', 'Code', 'Citation', 'Fermer'])
    fireEvent.keyDown(el, { key: 'ArrowDown' })
    fireEvent.keyDown(el, { key: 'Enter' })
    expect(line(editor).at(-1)).toEqual({ type: 'noteIcon', attrs: { name: 'crayon' } })
  })

  it('a French colon opens nothing: « Pièges : » and « 12:30 » stay text', async () => {
    const { editor } = await readyEditor()
    const settle = () => act(() => new Promise((r) => setTimeout(r, 30)))
    type(editor, 'Pièges :')
    await settle()
    expect(screen.queryByRole('listbox', { name: 'Icônes' })).not.toBeInTheDocument()
    // « code » is an icon: a colon right after a letter must still open nothing.
    // The list looks at the text right before the cursor: stop there.
    type(editor, ' voir la note:code')
    await settle()
    expect(screen.queryByRole('listbox', { name: 'Icônes' })).not.toBeInTheDocument()
    type(editor, ' à 12:30')
    await settle()
    expect(screen.queryByRole('listbox', { name: 'Icônes' })).not.toBeInTheDocument()
    expect(editor.getText()).toBe('Idée Pièges : voir la note:code à 12:30')
  })

  it('Échap closes the list and keeps what was typed', async () => {
    const { el, editor } = await readyEditor()
    type(editor, ':amp')
    await screen.findByRole('listbox', { name: 'Icônes' })
    fireEvent.keyDown(el, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('listbox', { name: 'Icônes' })).not.toBeInTheDocument())
    expect(editor.getText()).toBe('Idée :amp')
  })
})
