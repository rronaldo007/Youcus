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
    expect(editor.getJSON().content?.[0]).toEqual({ ...para('bonjour'), attrs: { textAlign: null, marker: null } })
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
        'Bloc de code```',
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
      expect(editor.getJSON().content?.[0]).toEqual({ type: 'heading', attrs: { level: 1, textAlign: null, marker: null }, content: [{ type: 'text', text: 'bonjour' }] })
    })

    it('moves with the arrows, and Échap closes it with the focus back on its button', async () => {
      await readyEditor()
      const button = screen.getByRole('button', { name: 'Style de paragraphe : Paragraphe' })
      fireEvent.click(button)
      const menu = screen.getByRole('menu')
      key(menu, 'ArrowDown')
      expect(within(menu).getByRole('menuitemradio', { name: 'Citation' })).toHaveFocus()
      key(menu, 'ArrowDown')
      expect(within(menu).getByRole('menuitemradio', { name: /Bloc de code/ })).toHaveFocus()
      key(menu, 'ArrowDown')
      expect(within(menu).getByRole('menuitemradio', { name: /Titre 1/ })).toHaveFocus()
      key(menu, 'End')
      expect(within(menu).getByRole('menuitemradio', { name: /Bloc de code/ })).toHaveFocus()
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

  describe('colours, fonts and sizes (YC-42)', () => {
    const marksOf = (editor: Editor) => editor.getJSON().content?.[0].content?.[0].marks ?? []

    it('the palette offers 8 text colours and none + 7 highlights, and stores a name', async () => {
      const { editor } = await readyEditor()
      fireEvent.click(screen.getByRole('button', { name: 'Choisir la couleur du texte' }))
      const menu = screen.getByRole('menu', { name: 'Couleurs' })
      const names = within(menu).getAllByRole('menuitemradio').map((i) => i.getAttribute('aria-label'))
      expect(names).toEqual([
        'Texte encre', 'Texte gris', 'Texte rouge', 'Texte orange', 'Texte vert', 'Texte bleu', 'Texte violet', 'Texte prune',
        'Aucun surlignage', 'Surlignage jaune', 'Surlignage vert', 'Surlignage bleu', 'Surlignage rose', 'Surlignage orange', 'Surlignage violet', 'Surlignage gris',
      ])
      expect(within(menu).getByRole('menuitemradio', { name: 'Texte encre' })).toHaveFocus()
      fireEvent.click(within(menu).getByRole('menuitemradio', { name: 'Texte prune' }))
      expect(marksOf(editor)).toEqual([{ type: 'textColor', attrs: { color: 'prune' } }])
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
      expect(editor.getHTML()).toContain('data-color="prune"')
    })

    it('one click reapplies the last colour, and « encre » takes the colour off', async () => {
      const { editor } = await readyEditor()
      expect(screen.getByRole('button', { name: 'Couleur du texte : rouge' })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Choisir la couleur du texte' }))
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'Texte bleu' }))
      const apply = await screen.findByRole('button', { name: 'Couleur du texte : bleu' })
      fireEvent.click(screen.getByRole('button', { name: 'Choisir la couleur du texte' }))
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'Texte encre' }))
      expect(marksOf(editor)).toEqual([])
      fireEvent.click(apply)
      expect(marksOf(editor)).toEqual([{ type: 'textColor', attrs: { color: 'bleu' } }])
    })

    it('highlights by name, one click reapplies it, « Aucun » removes it', async () => {
      const { editor } = await readyEditor()
      fireEvent.click(screen.getByRole('button', { name: 'Surlignage : jaune' }))
      expect(marksOf(editor)).toEqual([{ type: 'highlight', attrs: { color: 'jaune' } }])
      expect(editor.getHTML()).toContain('<mark data-highlight="jaune">bonjour</mark>')
      fireEvent.click(screen.getByRole('button', { name: 'Choisir le surlignage' }))
      const current = screen.getByRole('menuitemradio', { name: 'Surlignage jaune' })
      expect(current).toHaveAttribute('aria-checked', 'true')
      expect(current).toHaveFocus()
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'Aucun surlignage' }))
      expect(marksOf(editor)).toEqual([])
    })

    it('Échap closes the colours menu and gives the focus back to its chevron', async () => {
      await readyEditor()
      const chevron = screen.getByRole('button', { name: 'Choisir le surlignage' })
      fireEvent.click(chevron)
      expect(screen.getByRole('menuitemradio', { name: 'Aucun surlignage' })).toHaveFocus()
      key(screen.getByRole('menu'), 'ArrowRight')
      expect(screen.getByRole('menuitemradio', { name: 'Surlignage jaune' })).toHaveFocus()
      key(screen.getByRole('menu'), 'Escape')
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
      expect(chevron).toHaveFocus()
    })

    it('sets a font from the list, the default font takes the mark off', async () => {
      const { editor } = await readyEditor()
      fireEvent.click(screen.getByRole('button', { name: 'Police : Hanken Grotesk' }))
      const menu = screen.getByRole('menu', { name: 'Police et taille' })
      expect(within(menu).getAllByRole('menuitemradio').map((i) => i.querySelector('.yc-menu-item-label')?.textContent)).toEqual([
        'Hanken Grotesk', 'Instrument Serif', 'Lora', 'Atkinson Hyperlegible', 'JetBrains Mono', 'Caveat',
      ])
      fireEvent.click(within(menu).getByRole('menuitemradio', { name: /Lora/ }))
      expect(marksOf(editor)).toEqual([{ type: 'textFont', attrs: { font: 'lora' } }])
      fireEvent.click(await screen.findByRole('button', { name: 'Police : Lora' }))
      fireEvent.click(screen.getByRole('menuitemradio', { name: /Hanken Grotesk/ }))
      expect(marksOf(editor)).toEqual([])
    })

    it('sets a size from 12 to 32, steps it with − and +, and 16 takes the mark off', async () => {
      const { editor } = await readyEditor()
      fireEvent.click(screen.getByRole('button', { name: 'Taille : 16 px' }))
      expect(screen.getAllByRole('menuitemradio').map((i) => i.textContent)).toEqual(['12 px', '14 px', '16 px', '18 px', '20 px', '24 px', '28 px', '32 px'])
      fireEvent.click(screen.getByRole('menuitemradio', { name: '18 px' }))
      expect(marksOf(editor)).toEqual([{ type: 'textSize', attrs: { size: 18 } }])
      fireEvent.click(await screen.findByRole('button', { name: 'Police : Hanken Grotesk' }))
      fireEvent.click(screen.getByRole('menuitem', { name: 'Agrandir la taille' }))
      expect(marksOf(editor)).toEqual([{ type: 'textSize', attrs: { size: 20 } }])
      fireEvent.click(screen.getByRole('menuitem', { name: 'Réduire la taille' }))
      await waitFor(() => expect(screen.getByText('18 px')).toBeInTheDocument())
      fireEvent.click(screen.getByRole('menuitem', { name: 'Réduire la taille' }))
      expect(marksOf(editor)).toEqual([])
    })

    it('keeps a pasted named colour, drops a pasted hex or CSS colour', async () => {
      const { editor } = await readyEditor()
      editor.commands.setContent(
        '<p><span data-color="rouge">nommé</span> <span style="color:#ff0000">hex</span> <span data-color="#ff0000">faux</span> <mark style="background:yellow">css</mark></p>',
      )
      const json = JSON.stringify(editor.getJSON())
      expect(json).toContain('{"type":"textColor","attrs":{"color":"rouge"}}')
      expect(json).not.toMatch(/#|yellow|style/)
    })
  })

  describe('task lists, indent and alignment (YC-43)', () => {
    const three = () => ({
      type: 'doc',
      content: [{ type: 'bulletList', content: ['un', 'deux', 'trois'].map((x) => ({ type: 'listItem', content: [para(x)] })) }],
    })
    const cursorIn = (editor: Editor, word: string) => {
      let pos = 0
      editor.state.doc.descendants((node, p) => {
        if (node.isText && node.text === word) pos = p + 1
      })
      editor.commands.setTextSelection(pos)
    }
    const depthOf = (editor: Editor, word: string) => {
      let depth = 0
      editor.state.doc.descendants((node, p) => {
        if (node.isText && node.text === word) depth = editor.state.doc.resolve(p).depth
      })
      return depth
    }

    it('makes a task list (button and Ctrl+Maj+9), and a box checks the item', async () => {
      const { el, editor, toolbar } = await readyEditor()
      fireEvent.click(within(toolbar).getByRole('button', { name: 'Liste de cases (Ctrl+Maj+9)' }))
      expect(editor.isActive('taskList')).toBe(true)
      const box = await screen.findByRole('checkbox', { name: 'À faire : bonjour' })
      fireEvent.click(box)
      await waitFor(() => expect((editor.getJSON().content?.[0].content?.[0] as { attrs?: unknown } | undefined)?.attrs).toEqual({ checked: true }))
      expect(await screen.findByRole('checkbox', { name: 'Fait : bonjour' })).toBeChecked()
      key(el, '9', { ctrlKey: true, shiftKey: true })
      expect(editor.isActive('taskList')).toBe(false)
    })

    it('indents and outdents a list item over three levels, buttons disabled outside a list', async () => {
      const { editor, toolbar } = await readyEditor()
      const indent = within(toolbar).getByRole('button', { name: 'Augmenter le retrait (Tab)' })
      const outdent = within(toolbar).getByRole('button', { name: 'Diminuer le retrait (Maj+Tab)' })
      expect(indent).toHaveAttribute('aria-disabled', 'true')
      expect(outdent).toHaveAttribute('aria-disabled', 'true')
      editor.commands.setContent(three())
      cursorIn(editor, 'deux')
      await waitFor(() => expect(indent).not.toHaveAttribute('aria-disabled'))
      const top = depthOf(editor, 'deux')
      fireEvent.click(indent)
      expect(depthOf(editor, 'deux')).toBe(top + 2)
      // The toolbar state follows the cursor a moment later: wait for the tool before each click.
      cursorIn(editor, 'trois')
      await waitFor(() => expect(indent).not.toHaveAttribute('aria-disabled'))
      fireEvent.click(indent)
      await waitFor(() => expect(indent).not.toHaveAttribute('aria-disabled'))
      fireEvent.click(indent)
      expect(depthOf(editor, 'trois')).toBe(top + 4)
      await waitFor(() => expect(outdent).not.toHaveAttribute('aria-disabled'))
      fireEvent.click(outdent)
      expect(depthOf(editor, 'trois')).toBe(top + 2)
    })

    it('Tab and Maj+Tab indent inside a list, and Tab leaves the note when it cannot indent', async () => {
      const { el, editor } = await readyEditor()
      editor.commands.setContent(three())
      cursorIn(editor, 'deux')
      const top = depthOf(editor, 'deux')
      key(el, 'Tab')
      expect(depthOf(editor, 'deux')).toBe(top + 2)
      key(el, 'Tab', { shiftKey: true })
      expect(depthOf(editor, 'deux')).toBe(top)
      // First item: nothing to indent under, so Tab is not swallowed (no keyboard trap).
      cursorIn(editor, 'un')
      expect(fireEvent.keyDown(el, { key: 'Tab' })).toBe(true)
    })

    it('aligns from the menu and with Ctrl+Maj+L/E/R/J, the button showing the current alignment', async () => {
      const { el, editor } = await readyEditor()
      fireEvent.click(screen.getByRole('button', { name: 'Aligner : à gauche' }))
      const menu = screen.getByRole('menu', { name: 'Alignement' })
      expect(within(menu).getAllByRole('menuitemradio').map((i) => i.textContent)).toEqual([
        'À gaucheCtrl+Maj+L', 'CentréCtrl+Maj+E', 'À droiteCtrl+Maj+R', 'JustifiéCtrl+Maj+J',
      ])
      fireEvent.click(within(menu).getByRole('menuitemradio', { name: /Centré/ }))
      expect(editor.getJSON().content?.[0].attrs).toEqual({ textAlign: 'center', marker: null })
      expect(await screen.findByRole('button', { name: 'Aligner : centré' })).toBeInTheDocument()
      for (const [k, align] of [['r', 'right'], ['j', 'justify'], ['l', 'left'], ['e', 'center']]) {
        key(el, k, { ctrlKey: true, shiftKey: true })
        expect(editor.getJSON().content?.[0].attrs).toEqual({ textAlign: align, marker: null })
      }
      expect(editor.getHTML()).toContain('<p style="text-align: center;">bonjour</p>')
    })
  })

  describe('code block (YC-44)', () => {
    const codeDoc = (text: string, attrs: Record<string, unknown> = { language: 'javascript' }) => ({
      type: 'doc',
      content: [{ type: 'codeBlock', attrs, content: [{ type: 'text', text }] }],
    })

    it('turns the paragraph into a code block from the toolbar and from Styles', async () => {
      const { editor, toolbar } = await readyEditor()
      fireEvent.click(within(toolbar).getByRole('button', { name: 'Bloc de code (Ctrl+Alt+C)' }))
      expect(editor.isActive('codeBlock')).toBe(true)
      expect(await screen.findByRole('button', { name: 'Style de paragraphe : Bloc de code' })).toBeInTheDocument()
      fireEvent.click(within(toolbar).getByRole('button', { name: 'Bloc de code (Ctrl+Alt+C)' }))
      expect(editor.isActive('codeBlock')).toBe(false)
      fireEvent.click(screen.getByRole('button', { name: /^Style de paragraphe/ }))
      fireEvent.click(screen.getByRole('menuitemradio', { name: /Bloc de code/ }))
      expect(editor.getJSON().content?.[0]).toMatchObject({ type: 'codeBlock', content: [{ type: 'text', text: 'bonjour' }] })
    })

    it('colours the code by language and shows one number per line', async () => {
      const { editor } = await readyEditor()
      editor.commands.setContent(codeDoc('const id = setInterval(tick, 1000)\n// nettoyage'))
      const code = await screen.findByText('const', { selector: '.hljs-keyword' })
      expect(code).toBeInTheDocument()
      expect(screen.getByText('1000', { selector: '.hljs-number' })).toBeInTheDocument()
      expect(screen.getByText('// nettoyage', { selector: '.hljs-comment' })).toBeInTheDocument()
      const gutter = document.querySelector('.yc-code-gutter')
      expect(gutter).toHaveAttribute('aria-hidden', 'true')
      expect(gutter?.textContent).toBe('12')
    })

    it('a language off the list becomes plain text, whatever brought it (``` rule, paste, setContent)', async () => {
      const { editor } = await readyEditor()
      editor.commands.setContent(codeDoc('fn main() {}', { language: 'rust' }))
      await waitFor(() => expect(editor.getJSON().content?.[0].attrs?.language).toBeNull())
      editor.commands.setContent('<pre><code class="language-brainfuck">+++</code></pre>')
      expect(editor.getJSON().content?.[0].attrs?.language).toBeNull()
      editor.commands.setContent('<pre><code class="language-python">print(1)</code></pre>')
      expect(editor.getJSON().content?.[0].attrs?.language).toBe('python')
    })

    it('changes the language and hides the line numbers from the block menu', async () => {
      const { editor } = await readyEditor()
      editor.commands.setContent(codeDoc('print(1)', { language: null }))
      fireEvent.click(await screen.findByRole('button', { name: 'Langage du bloc : Texte brut' }))
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'Python' }))
      expect(editor.getJSON().content?.[0].attrs).toMatchObject({ language: 'python', lineNumbers: true })
      fireEvent.click(await screen.findByRole('button', { name: 'Langage du bloc : Python' }))
      fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Numéros de ligne' }))
      expect(editor.getJSON().content?.[0].attrs).toMatchObject({ language: 'python', lineNumbers: false })
      await waitFor(() => expect(document.querySelector('.yc-code-gutter')).toBeNull())
    })

    it('Copier puts the code alone in the clipboard, never the line numbers', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
      const { editor } = await readyEditor()
      editor.commands.setContent(codeDoc('a()\nb()'))
      fireEvent.click(await screen.findByRole('button', { name: 'Copier le code' }))
      await waitFor(() => expect(writeText).toHaveBeenCalledWith('a()\nb()'))
      expect(await screen.findByText('Code copié')).toBeInTheDocument()
    })

    it('Tab indents inside the block; after Échap, Tab is left to the browser (no trap)', async () => {
      const { el, editor } = await readyEditor()
      editor.commands.setContent(codeDoc('x'))
      editor.commands.setTextSelection(1)
      key(el, 'Tab')
      expect(editor.getJSON().content?.[0].content?.[0]).toEqual({ type: 'text', text: '  x' })
      key(el, 'Escape')
      // fireEvent returns true when nothing called preventDefault: the browser moves the focus.
      expect(fireEvent.keyDown(el, { key: 'Tab' })).toBe(true)
      expect(editor.getJSON().content?.[0].content?.[0]).toEqual({ type: 'text', text: '  x' })
      // Any other key re-arms the indentation.
      key(el, 'ArrowRight')
      key(el, 'Tab')
      expect(editor.state.doc.textContent).toMatch(/^ {2}x {2}$|^ {4}x$| {2}x {2}/)
    })
  })

  it('is hidden in « Aperçu », where the note is read-only', async () => {
    await readyEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Aperçu' }))
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()
  })
})
