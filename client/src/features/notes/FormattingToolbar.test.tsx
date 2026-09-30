import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Editor } from '@tiptap/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NoteDoc } from './noteDoc'
import { VideoNotes } from './VideoNotes'

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })
let initialDoc: NoteDoc

function renderNotes() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <VideoNotes videoId="v1" />
    </QueryClientProvider>,
  )
}

/** The note loaded with « bonjour », all of it selected: every command applies to it. */
async function readyEditor() {
  renderNotes()
  const el = await screen.findByRole('textbox', { name: 'Note de la vidéo' }, { timeout: 5000 })
  await waitFor(() => expect(el).toHaveTextContent('bonjour'))
  const editor = (el as unknown as { editor: Editor }).editor
  // A text selection, as a user makes one (selectAll gives an AllSelection that no block command takes).
  editor.commands.setTextSelection({ from: 1, to: editor.state.doc.content.size - 1 })
  return { el, editor, toolbar: screen.getByRole('toolbar', { name: 'Mise en forme' }) }
}

const key = (el: Element, k: string, mods: { ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean } = {}) =>
  fireEvent.keyDown(el, { key: k, ...mods })

describe('FormattingToolbar (YC-41)', () => {
  beforeEach(() => {
    initialDoc = { type: 'doc', content: [para('bonjour')] }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const doc = init?.method === 'PUT' ? (JSON.parse(init.body as string) as { doc: NoteDoc }).doc : initialDoc
        return new Response(JSON.stringify({ doc, updatedAt: '2026-09-30T10:00:00Z' }), { status: 200 })
      }),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('gives every tool a name with its shortcut, and 44 px targets through one class', async () => {
    const { toolbar } = await readyEditor()
    for (const name of [
      'Annuler (Ctrl+Z)',
      'Rétablir (Ctrl+Y)',
      'Gras (Ctrl+B)',
      'Italique (Ctrl+I)',
      'Souligné (Ctrl+U)',
      'Barré (Ctrl+Maj+S)',
      'Liste à puces (Ctrl+Maj+8)',
      'Liste numérotée (Ctrl+Maj+7)',
      'Lien (Ctrl+K)',
      'Citation (Ctrl+Maj+B)',
      'Code en ligne (Ctrl+E)',
      'Effacer la mise en forme',
      'Insérer un séparateur',
    ]) {
      expect(within(toolbar).getByRole('button', { name })).toHaveClass('yc-tool')
    }
    expect(within(toolbar).getByRole('button', { name: 'Style de paragraphe : Paragraphe' })).toHaveAttribute('aria-haspopup', 'menu')
  })

  it.each([
    ['Gras (Ctrl+B)', 'bold'],
    ['Italique (Ctrl+I)', 'italic'],
    ['Souligné (Ctrl+U)', 'underline'],
    ['Barré (Ctrl+Maj+S)', 'strike'],
    ['Code en ligne (Ctrl+E)', 'code'],
  ])('« %s » toggles the %s mark and shows it pressed', async (name, mark) => {
    const { editor, toolbar } = await readyEditor()
    const tool = within(toolbar).getByRole('button', { name })
    expect(tool).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(tool)
    expect(editor.isActive(mark)).toBe(true)
    await waitFor(() => expect(tool).toHaveAttribute('aria-pressed', 'true'))
    fireEvent.click(tool)
    expect(editor.isActive(mark)).toBe(false)
  })

  it.each([
    ['b', { ctrlKey: true }, 'bold'],
    ['i', { ctrlKey: true }, 'italic'],
    ['u', { ctrlKey: true }, 'underline'],
    ['s', { ctrlKey: true, shiftKey: true }, 'strike'],
    ['e', { ctrlKey: true }, 'code'],
  ])('the shortcut Ctrl+%s applies %s', async (k, mods, mark) => {
    const { el, editor } = await readyEditor()
    key(el, k, mods)
    expect(editor.isActive(mark)).toBe(true)
  })

  it.each([
    ['1', 1],
    ['2', 2],
    ['3', 3],
  ])('Ctrl+Alt+%s sets « Titre %s », Ctrl+Alt+0 goes back to « Paragraphe »', async (k, level) => {
    const { el, editor } = await readyEditor()
    key(el, k, { ctrlKey: true, altKey: true })
    expect(editor.isActive('heading', { level })).toBe(true)
    expect(await screen.findByRole('button', { name: `Style de paragraphe : Titre ${level}` })).toBeInTheDocument()
    key(el, '0', { ctrlKey: true, altKey: true })
    expect(editor.isActive('paragraph')).toBe(true)
  })

  it('undoes and redoes, the buttons disabled when there is nothing to do', async () => {
    const { editor, toolbar } = await readyEditor()
    const undo = within(toolbar).getByRole('button', { name: 'Annuler (Ctrl+Z)' })
    const redo = within(toolbar).getByRole('button', { name: 'Rétablir (Ctrl+Y)' })
    expect(undo).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(within(toolbar).getByRole('button', { name: 'Gras (Ctrl+B)' }))
    await waitFor(() => expect(undo).not.toHaveAttribute('aria-disabled'))
    fireEvent.click(undo)
    expect(editor.getHTML()).not.toContain('<strong>')
    await waitFor(() => expect(redo).not.toHaveAttribute('aria-disabled'))
    fireEvent.click(redo)
    expect(editor.getHTML()).toContain('<strong>bonjour</strong>')
  })

  it('toggles lists and quote, and « Effacer » brings back a plain paragraph', async () => {
    const { editor, toolbar } = await readyEditor()
    fireEvent.click(within(toolbar).getByRole('button', { name: 'Liste à puces (Ctrl+Maj+8)' }))
    expect(editor.isActive('bulletList')).toBe(true)
    fireEvent.click(within(toolbar).getByRole('button', { name: 'Liste numérotée (Ctrl+Maj+7)' }))
    expect(editor.isActive('orderedList')).toBe(true)
    fireEvent.click(within(toolbar).getByRole('button', { name: 'Gras (Ctrl+B)' }))
    fireEvent.click(within(toolbar).getByRole('button', { name: 'Effacer la mise en forme' }))
    // TipTap keeps a trailing empty paragraph: only the first block matters.
    expect(editor.getJSON().content?.[0]).toEqual(para('bonjour'))
    fireEvent.click(within(toolbar).getByRole('button', { name: 'Citation (Ctrl+Maj+B)' }))
    expect(editor.isActive('blockquote')).toBe(true)
  })

  it('inserts a separator that the save keeps', async () => {
    const { editor, toolbar } = await readyEditor()
    editor.commands.setTextSelection(editor.state.doc.content.size - 1)
    fireEvent.click(within(toolbar).getByRole('button', { name: 'Insérer un séparateur' }))
    expect(editor.getJSON().content?.map((n) => n.type)).toContain('horizontalRule')
  })

  describe('style menu', () => {
    it('opens on the current style, applies a choice, and closes', async () => {
      const { editor } = await readyEditor()
      fireEvent.click(screen.getByRole('button', { name: 'Style de paragraphe : Paragraphe' }))
      const menu = screen.getByRole('menu', { name: 'Style de paragraphe' })
      const items = within(menu).getAllByRole('menuitemradio')
      expect(items.map((i) => i.textContent)).toEqual([
        'Titre 1Ctrl+Alt+1',
        'Titre 2Ctrl+Alt+2',
        'Titre 3Ctrl+Alt+3',
        'ParagrapheCtrl+Alt+0',
        'Citation',
      ])
      const current = within(menu).getByRole('menuitemradio', { checked: true })
      expect(current).toHaveTextContent('Paragraphe')
      expect(current).toHaveFocus()
      fireEvent.click(within(menu).getByRole('menuitemradio', { name: /Titre 2/ }))
      expect(editor.isActive('heading', { level: 2 })).toBe(true)
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    it('« Citation » wraps the paragraph, a heading takes it back out of the quote', async () => {
      const { editor } = await readyEditor()
      fireEvent.click(screen.getByRole('button', { name: /^Style de paragraphe/ }))
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'Citation' }))
      expect(editor.isActive('blockquote')).toBe(true)
      expect(await screen.findByRole('button', { name: 'Style de paragraphe : Citation' })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: /^Style de paragraphe/ }))
      fireEvent.click(screen.getByRole('menuitemradio', { name: /Titre 1/ }))
      expect(editor.getJSON().content?.[0]).toEqual({ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'bonjour' }] })
    })

    it('moves with the arrows, and Échap closes it with the focus back on its button', async () => {
      await readyEditor()
      const button = screen.getByRole('button', { name: 'Style de paragraphe : Paragraphe' })
      fireEvent.click(button)
      const menu = screen.getByRole('menu')
      key(menu, 'ArrowDown')
      expect(within(menu).getByRole('menuitemradio', { name: 'Citation' })).toHaveFocus()
      key(menu, 'ArrowDown')
      expect(within(menu).getByRole('menuitemradio', { name: /Titre 1/ })).toHaveFocus()
      key(menu, 'End')
      expect(within(menu).getByRole('menuitemradio', { name: 'Citation' })).toHaveFocus()
      key(menu, 'Escape')
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
      expect(button).toHaveFocus()
    })

    it('closes on a click outside', async () => {
      await readyEditor()
      fireEvent.click(screen.getByRole('button', { name: /^Style de paragraphe/ }))
      fireEvent.pointerDown(document.body)
      await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    })
  })

  describe('keyboard', () => {
    it('has a single tab stop and moves with the arrows, Home and End', async () => {
      const { toolbar } = await readyEditor()
      const tools = Array.from(toolbar.querySelectorAll<HTMLElement>('[data-tool]'))
      await waitFor(() => expect(tools.filter((t) => t.tabIndex === 0)).toEqual([tools[0]]))
      tools[0].focus()
      key(tools[0], 'ArrowRight')
      expect(tools[1]).toHaveFocus()
      expect(tools.filter((t) => t.tabIndex === 0)).toEqual([tools[1]])
      key(tools[1], 'End')
      expect(tools[tools.length - 1]).toHaveFocus()
      key(tools[tools.length - 1], 'ArrowRight')
      expect(tools[0]).toHaveFocus()
      key(tools[0], 'ArrowLeft')
      expect(tools[tools.length - 1]).toHaveFocus()
      key(tools[tools.length - 1], 'Home')
      expect(tools[0]).toHaveFocus()
    })
  })

  describe('link', () => {
    it('Ctrl+K opens the field; an address without scheme becomes https', async () => {
      const { el, editor } = await readyEditor()
      key(el, 'k', { ctrlKey: true })
      const input = await screen.findByLabelText('Adresse du lien')
      expect(input).toHaveFocus()
      fireEvent.change(input, { target: { value: 'react.dev' } })
      fireEvent.submit(input.closest('form')!)
      expect(editor.getAttributes('link').href).toBe('https://react.dev')
      expect(screen.queryByLabelText('Adresse du lien')).not.toBeInTheDocument()
    })

    it('refuses a javascript: address and says why', async () => {
      const { editor, toolbar } = await readyEditor()
      fireEvent.click(within(toolbar).getByRole('button', { name: 'Lien (Ctrl+K)' }))
      const input = await screen.findByLabelText('Adresse du lien')
      fireEvent.change(input, { target: { value: 'javascript:alert(1)' } })
      fireEvent.submit(input.closest('form')!)
      expect(await screen.findByRole('alert')).toHaveTextContent('seuls http, https et mailto')
      expect(editor.isActive('link')).toBe(false)
    })

    it('Échap closes the field and gives the focus back to the note', async () => {
      const { el } = await readyEditor()
      key(el, 'k', { ctrlKey: true })
      const input = await screen.findByLabelText('Adresse du lien')
      key(input, 'Escape')
      expect(screen.queryByLabelText('Adresse du lien')).not.toBeInTheDocument()
      await waitFor(() => expect(el).toHaveFocus())
    })

    it('removes an existing link', async () => {
      initialDoc = {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'bonjour', marks: [{ type: 'link', attrs: { href: 'https://react.dev' } }] }] }],
      }
      const { editor, toolbar } = await readyEditor()
      fireEvent.click(within(toolbar).getByRole('button', { name: 'Lien (Ctrl+K)' }))
      expect(await screen.findByLabelText('Adresse du lien')).toHaveValue('https://react.dev')
      fireEvent.click(screen.getByRole('button', { name: 'Retirer le lien' }))
      expect(editor.getHTML()).not.toContain('<a')
    })
  })

  it('is hidden in « Aperçu », where the note is read-only', async () => {
    await readyEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Aperçu' }))
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()
  })
})
