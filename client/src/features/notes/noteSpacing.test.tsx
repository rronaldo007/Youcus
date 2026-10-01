import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Editor } from '@tiptap/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NoteDoc, NoteNode } from './noteDoc'
import { VideoNotes } from './VideoNotes'

const para = (text: string, attrs?: Record<string, unknown>) => ({ type: 'paragraph', ...(attrs ? { attrs } : {}), content: [{ type: 'text', text }] })
let initialDoc: NoteDoc
let storedPage: unknown
let puts: { doc: NoteDoc }[]

/** The note loaded, the cursor in its first paragraph. */
async function readyEditor() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <VideoNotes videoId="v1" />
    </QueryClientProvider>,
  )
  const el = await screen.findByRole('textbox', { name: 'Note de la vidéo' }, { timeout: 5000 })
  await waitFor(() => expect(el).toHaveTextContent('premier'))
  const editor = (el as unknown as { editor: Editor }).editor
  act(() => {
    editor.commands.setTextSelection(3)
  })
  return { el, editor, toolbar: screen.getByRole('toolbar', { name: 'Mise en forme' }) }
}

const openMenu = (toolbar: HTMLElement) => {
  fireEvent.click(within(toolbar).getByRole('button', { name: 'Interligne et espacement' }))
  return screen.getByRole('menu', { name: 'Interligne et espacement' })
}
const attrsOf = (editor: Editor, i = 0) => (editor.getJSON().content as NoteNode[])[i].attrs ?? {}

describe('paragraph spacing (YC-55)', () => {
  beforeEach(() => {
    initialDoc = { type: 'doc', content: [para('premier paragraphe'), para('second paragraphe')] }
    storedPage = null
    puts = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'PUT') {
          const body = JSON.parse(init.body as string) as { doc: NoteDoc }
          puts.push(body)
          return new Response(JSON.stringify({ ...body, updatedAt: '2026-10-01T10:00:00Z' }), { status: 200 })
        }
        return new Response(JSON.stringify({ doc: initialDoc, page: storedPage, updatedAt: '2026-10-01T10:00:00Z' }), { status: 200 })
      }),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('sets the line height of the paragraph, draws it and saves it', async () => {
    const { el, editor, toolbar } = await readyEditor()
    fireEvent.click(within(openMenu(toolbar)).getByRole('menuitemradio', { name: 'Interligne 2,0' }))
    expect(attrsOf(editor)).toMatchObject({ lineHeight: 2 })
    expect(attrsOf(editor, 1)).toMatchObject({ lineHeight: null })
    expect(el.querySelector('p')).toHaveAttribute('data-line', '2')
    await waitFor(() => expect(puts.length).toBeGreaterThan(0), { timeout: 3000 })
    expect(puts[puts.length - 1].doc.content[0].attrs).toMatchObject({ lineHeight: 2 })
  })

  it('sets the spaces and the first-line indent from their values', async () => {
    const { el, editor, toolbar } = await readyEditor()
    const menu = openMenu(toolbar)
    fireEvent.click(within(within(menu).getByRole('group', { name: 'Espace avant' })).getByRole('menuitemradio', { name: 'Espace avant : 32' }))
    fireEvent.click(within(menu).getByRole('menuitemradio', { name: 'Espace après : 32' }))
    fireEvent.click(within(menu).getByRole('menuitemradio', { name: 'Retrait de première ligne : 64' }))
    expect(attrsOf(editor)).toMatchObject({ spaceBefore: 32, spaceAfter: 32, indent: 64 })
    const p = el.querySelector('p') as HTMLElement
    expect(p.dataset).toMatchObject({ before: '32', after: '32', indent: '64' })
    // The menu stays open: several values are set in a row.
    expect(screen.getByRole('menu', { name: 'Interligne et espacement' })).toBeInTheDocument()
  })

  it('the default value removes the setting instead of storing it', async () => {
    initialDoc = { type: 'doc', content: [para('premier paragraphe', { lineHeight: 2, indent: 32 }), para('second')] }
    const { el, editor, toolbar } = await readyEditor()
    const menu = openMenu(toolbar)
    fireEvent.click(within(menu).getByRole('menuitemradio', { name: 'Interligne 1,0' }))
    fireEvent.click(within(menu).getByRole('menuitemradio', { name: 'Retrait de première ligne : aucun' }))
    expect(attrsOf(editor)).toMatchObject({ lineHeight: null, indent: null })
    expect(el.querySelector('p')).not.toHaveAttribute('data-line')
  })

  it('applies to every paragraph of the selection', async () => {
    const { editor, toolbar } = await readyEditor()
    act(() => {
      editor.commands.setTextSelection({ from: 2, to: editor.state.doc.content.size - 2 })
    })
    fireEvent.click(within(openMenu(toolbar)).getByRole('menuitemradio', { name: 'Interligne 2,0' }))
    expect([attrsOf(editor, 0).lineHeight, attrsOf(editor, 1).lineHeight]).toEqual([2, 2])
  })

  it('on ruled paper, offers whole lines only: 1,15, 1,5, 8 and 16 are unavailable', async () => {
    const { editor, toolbar } = await readyEditor()
    const menu = openMenu(toolbar)
    for (const name of ['Interligne 1,15 (papier Uni seulement)', 'Interligne 1,5 (papier Uni seulement)']) {
      const item = within(menu).getByRole('menuitemradio', { name })
      expect(item).toHaveAttribute('aria-disabled', 'true')
      fireEvent.click(item)
    }
    for (const name of ['Espace avant : 8 (papier Uni seulement)', 'Espace après : 16 (papier Uni seulement)']) {
      fireEvent.click(within(menu).getByRole('menuitemradio', { name }))
    }
    expect(attrsOf(editor)).toMatchObject({ lineHeight: null, spaceBefore: null, spaceAfter: null })
    expect(within(menu).getByText(/Papier réglé : le texte reste sur les lignes/)).toBeInTheDocument()
  })

  it('on plain paper, every value is offered', async () => {
    storedPage = { paper: 'uni', tint: 'creme', margin: true }
    const { editor, toolbar } = await readyEditor()
    const menu = openMenu(toolbar)
    fireEvent.click(within(menu).getByRole('menuitemradio', { name: 'Interligne 1,15' }))
    fireEvent.click(within(menu).getByRole('menuitemradio', { name: 'Espace avant : 8' }))
    expect(attrsOf(editor)).toMatchObject({ lineHeight: 1.15, spaceBefore: 8 })
    expect(within(menu).queryByText(/Papier réglé/)).not.toBeInTheDocument()
  })

  it('a plain-paper value on ruled paper is shown rounded, and kept', async () => {
    initialDoc = { type: 'doc', content: [para('premier paragraphe', { lineHeight: 1.5, spaceBefore: 16 }), para('second')] }
    const { editor, toolbar } = await readyEditor()
    const menu = openMenu(toolbar)
    expect(within(menu).getByRole('menuitemradio', { name: 'Interligne 2,0' })).toHaveAttribute('aria-checked', 'true')
    expect(within(menu).getByRole('menuitemradio', { name: 'Espace avant : 32' })).toHaveAttribute('aria-checked', 'true')
    expect(within(menu).getByText(/garde son réglage Uni/)).toBeInTheDocument()
    expect(attrsOf(editor)).toMatchObject({ lineHeight: 1.5, spaceBefore: 16 })
  })

  it('Enter starts a paragraph with the same spacing', async () => {
    initialDoc = { type: 'doc', content: [para('premier paragraphe', { lineHeight: 2 })] }
    const { editor } = await readyEditor()
    act(() => {
      editor.commands.setTextSelection(1 + 'premier paragraphe'.length)
      editor.commands.splitBlock()
    })
    expect(attrsOf(editor, 1)).toMatchObject({ lineHeight: 2 })
  })

  it('is unavailable outside a paragraph (a heading)', async () => {
    initialDoc = { type: 'doc', content: [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'premier titre' }] }] }
    const { toolbar } = await readyEditor()
    expect(within(toolbar).getByRole('button', { name: 'Interligne et espacement (paragraphes seulement)' })).toHaveAttribute('aria-disabled', 'true')
  })

  it('in a list, the first-line indent is unavailable: the list has its own (YC-58)', async () => {
    const item = (text: string) => ({ type: 'listItem', content: [para(text, { indent: 32 })] })
    initialDoc = { type: 'doc', content: [{ type: 'bulletList', content: [item('premier point'), item('second point')] }] }
    const { editor, toolbar } = await readyEditor()
    const menu = openMenu(toolbar)
    for (const v of ['aucun', '32', '64']) {
      const pill = within(menu).getByRole('menuitemradio', { name: `Retrait de première ligne : ${v} (pas dans une liste)` })
      expect(pill).toHaveAttribute('aria-disabled', 'true')
      expect(pill).toHaveAttribute('aria-checked', 'false')
    }
    fireEvent.click(within(menu).getByRole('menuitemradio', { name: 'Retrait de première ligne : 64 (pas dans une liste)' }))
    expect(JSON.stringify(editor.getJSON())).not.toMatch(/"indent":\s*64/)
    expect(within(menu).getByText(/Dans une liste, Tab et Maj\+Tab décalent le point/)).toBeInTheDocument()
    // The interligne still applies in a list.
    fireEvent.click(within(menu).getByRole('menuitemradio', { name: 'Interligne 2,0' }))
    expect(JSON.stringify(editor.getJSON())).toMatch(/"lineHeight":\s*2/)
  })

  describe('Tab key (YC-57)', () => {
    const tab = (el: Element, shiftKey = false) => fireEvent.keyDown(el, { key: 'Tab', shiftKey })

    it('Tab steps the first-line indent up, Maj+Tab down, and the note keeps the focus', async () => {
      const { el, editor } = await readyEditor()
      expect(tab(el)).toBe(false) // handled: the browser does not move the focus
      expect(attrsOf(editor)).toMatchObject({ indent: 32 })
      tab(el)
      expect(attrsOf(editor)).toMatchObject({ indent: 64 })
      expect(tab(el)).toBe(false) // last step: still kept in the note
      expect(attrsOf(editor)).toMatchObject({ indent: 64 })
      tab(el, true)
      expect(attrsOf(editor)).toMatchObject({ indent: 32 })
      tab(el, true)
      expect(attrsOf(editor)).toMatchObject({ indent: null })
      expect(attrsOf(editor, 1)).toMatchObject({ indent: null })
    })

    it('steps every paragraph of the selection from its own value', async () => {
      initialDoc = { type: 'doc', content: [para('premier paragraphe', { indent: 32 }), para('second paragraphe')] }
      const { el, editor } = await readyEditor()
      act(() => {
        editor.commands.setTextSelection({ from: 2, to: editor.state.doc.content.size - 2 })
      })
      tab(el)
      expect([attrsOf(editor, 0).indent, attrsOf(editor, 1).indent]).toEqual([64, 32])
    })

    it('Échap then Tab leaves the note: the keyboard is never trapped', async () => {
      const { el, editor } = await readyEditor()
      fireEvent.keyDown(el, { key: 'Escape' })
      expect(tab(el)).toBe(true) // not handled: the browser moves the focus on
      expect(attrsOf(editor)).toMatchObject({ indent: null })
      // Any other key ends it: Tab indents again.
      fireEvent.keyDown(el, { key: 'ArrowRight' })
      tab(el)
      expect(attrsOf(editor)).toMatchObject({ indent: 32 })
    })

    it('a selection over a paragraph and a list indents the paragraph only', async () => {
      const item = (text: string) => ({ type: 'listItem', content: [para(text)] })
      initialDoc = { type: 'doc', content: [para('premier paragraphe'), { type: 'bulletList', content: [item('un point'), item('un autre')] }] }
      const { el, editor } = await readyEditor()
      act(() => {
        editor.commands.setTextSelection({ from: 3, to: editor.state.doc.content.size - 4 })
      })
      tab(el)
      expect(attrsOf(editor)).toMatchObject({ indent: 32 })
      expect(JSON.stringify((editor.getJSON().content as NoteNode[])[1])).not.toMatch(/"indent":\s*(32|64)/)
    })

    it('in a list, Tab still nests the item and indents no paragraph', async () => {
      const item = (text: string) => ({ type: 'listItem', content: [para(text)] })
      initialDoc = { type: 'doc', content: [{ type: 'bulletList', content: [item('premier point'), item('second point')] }] }
      const { el, editor } = await readyEditor()
      act(() => {
        editor.commands.setTextSelection(editor.state.doc.content.size - 4)
      })
      tab(el)
      const list = (editor.getJSON().content as NoteNode[])[0]
      expect(list.content).toHaveLength(1)
      expect(JSON.stringify(list)).toContain('"bulletList"')
      expect(JSON.stringify(editor.getJSON())).not.toMatch(/"indent":\s*(32|64)/)
    })
  })
})

