import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Editor } from '@tiptap/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NoteDoc } from './noteDoc'
import { VideoNotes } from './VideoNotes'

let puts: { doc: NoteDoc; page?: Record<string, unknown> }[]

/** A phone-wide screen, or not: the editor reads it through matchMedia. */
function screenWidth(phone: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: phone && query.includes('max-width: 480px'),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList,
  )
}

async function readyEditor(player = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <VideoNotes videoId="v1" player={player ? { seconds: 0, seek: () => {} } : undefined} />
    </QueryClientProvider>,
  )
  const el = await screen.findByRole('textbox', { name: 'Note de la vidéo' }, { timeout: 5000 })
  await waitFor(() => expect(el).toHaveTextContent('bonjour'))
  const editor = (el as unknown as { editor: Editor }).editor
  act(() => {
    editor.commands.setTextSelection({ from: 1, to: 8 })
  })
  return { el, editor, toolbar: screen.getByRole('toolbar', { name: 'Mise en forme' }) }
}

const openSheet = (toolbar: HTMLElement) => {
  fireEvent.click(within(toolbar).getByRole('button', { name: 'Toute la mise en forme' }))
  return screen.getByRole('dialog', { name: 'Mise en forme' })
}

describe('phone toolbar and sheet (YC-47)', () => {
  beforeEach(() => {
    puts = []
    screenWidth(true)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'PUT') {
          const body = JSON.parse(init.body as string) as { doc: NoteDoc }
          puts.push(body)
          return new Response(JSON.stringify({ ...body, updatedAt: '2026-10-01T10:00:00Z' }), { status: 200 })
        }
        const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'bonjour' }] }] }
        return new Response(JSON.stringify({ doc, updatedAt: '2026-10-01T10:00:00Z' }), { status: 200 })
      }),
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('shows one row with the tools of the mockup, and none of the large bar', async () => {
    const { toolbar } = await readyEditor()
    expect(toolbar).toHaveClass('yc-toolbar-compact')
    const names = within(toolbar)
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label'))
    expect(names).toEqual([
      'Toute la mise en forme',
      'Agrandir la note',
      'Gras (Ctrl+B)',
      'Italique (Ctrl+I)',
      'Souligné (Ctrl+U)',
      'Couleur du texte : rouge',
      'Choisir la couleur du texte',
      'Surlignage : jaune',
      'Choisir le surlignage',
      'Liste à puces (Ctrl+Maj+8)',
      'Liste de cases (Ctrl+Maj+9)',
      'Insérer une icône',
      'Annuler (Ctrl+Z)',
      // Figma compact bar 32:291: after « Annuler », the image, table, tabs, diagram and chart (YC-50 to 54).
      'Insérer une image',
      'Insérer un tableau',
      'Insérer des onglets',
      'Insérer un schéma',
      'Insérer un graphique',
    ])
  })

  it('« Aa » opens the sheet as a modal dialog, the focus on « Fermer »', async () => {
    const { toolbar } = await readyEditor()
    const aa = within(toolbar).getByRole('button', { name: 'Toute la mise en forme' })
    expect(aa).toHaveAttribute('aria-haspopup', 'dialog')
    const sheet = openSheet(toolbar)
    expect(sheet).toHaveAttribute('aria-modal', 'true')
    expect(aa).toHaveAttribute('aria-expanded', 'true')
    expect(within(sheet).getByRole('button', { name: 'Fermer' })).toHaveFocus()
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('Échap closes it and gives the focus back to « Aa »; the page scrolls again', async () => {
    const { toolbar } = await readyEditor()
    const sheet = openSheet(toolbar)
    fireEvent.keyDown(within(sheet).getByRole('button', { name: 'Fermer' }), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(within(toolbar).getByRole('button', { name: 'Toute la mise en forme' })).toHaveFocus()
    expect(document.body.style.overflow).toBe('')
  })

  it('the veil and « Fermer » close it too', async () => {
    const { toolbar } = await readyEditor()
    openSheet(toolbar)
    fireEvent.click(document.querySelector('.yc-sheet-veil') as Element)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const sheet = openSheet(toolbar)
    fireEvent.click(within(sheet).getByRole('button', { name: 'Fermer' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Tab stays inside the sheet', async () => {
    const { toolbar } = await readyEditor()
    const sheet = openSheet(toolbar)
    const close = within(sheet).getByRole('button', { name: 'Fermer' })
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
    const last = document.activeElement as HTMLElement
    expect(sheet.contains(last)).toBe(true)
    expect(last).not.toBe(close)
    fireEvent.keyDown(last, { key: 'Tab' })
    expect(close).toHaveFocus()
  })

  it('a style, a colour and the size apply to the selection, and show it', async () => {
    const { editor, toolbar } = await readyEditor()
    const sheet = openSheet(toolbar)
    fireEvent.click(within(within(sheet).getByRole('radiogroup', { name: 'Style de paragraphe' })).getByRole('radio', { name: 'Titre 2' }))
    expect(editor.getJSON().content?.[0]).toMatchObject({ type: 'heading', attrs: { level: 2 } })
    expect(within(sheet).getByRole('radio', { name: 'Titre 2' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(within(sheet).getByRole('radio', { name: 'Texte bleu' }))
    fireEvent.click(within(sheet).getByRole('button', { name: 'Agrandir la taille' }))
    const marks = JSON.stringify(editor.getJSON())
    expect(marks).toContain('"color":"bleu"')
    expect(marks).toContain('"size":18')
    expect(within(sheet).getByRole('radio', { name: 'Texte bleu' })).toHaveAttribute('aria-checked', 'true')
  })

  it('a tool of the sheet keeps the focus in the sheet, not in the editor (no phone keyboard over it)', async () => {
    const { el, toolbar } = await readyEditor()
    const sheet = openSheet(toolbar)
    // TipTap gives the focus back on the next frame: wait for it before looking.
    const frame = () => act(() => new Promise((r) => setTimeout(r, 50)))
    for (const radio of ['Titre 2', 'Texte bleu', 'Papier seyès']) {
      fireEvent.click(within(sheet).getByRole('radio', { name: radio }))
      await frame()
      expect(el).not.toHaveFocus()
      expect(sheet.contains(document.activeElement)).toBe(true)
    }
    fireEvent.click(within(sheet).getByRole('button', { name: 'Gras (Ctrl+B)' }))
    await frame()
    expect(sheet.contains(document.activeElement)).toBe(true)
  })

  it('the page section changes the paper, the tint and the margin, saved with the note', async () => {
    const { toolbar } = await readyEditor()
    const sheet = openSheet(toolbar)
    fireEvent.click(within(sheet).getByRole('radio', { name: 'Papier seyès' }))
    fireEvent.click(within(sheet).getByRole('radio', { name: 'Teinte sépia' }))
    fireEvent.click(within(sheet).getByRole('switch', { name: 'Colonne de marge' }))
    expect(within(sheet).getByRole('switch', { name: 'Colonne de marge' })).toHaveAttribute('aria-checked', 'false')
    await waitFor(() => expect(puts.some((p) => p.page)).toBe(true), { timeout: 3000 })
    expect(puts.filter((p) => p.page).at(-1)?.page).toMatchObject({ paper: 'seyes', tint: 'sepia', margin: false })
  })

  it('the timestamps switch is there for a video note only', async () => {
    const { toolbar } = await readyEditor(false)
    expect(within(openSheet(toolbar)).queryByRole('switch', { name: 'Horodatages dans la marge' })).not.toBeInTheDocument()
  })

  it('a video note with its player has the timestamps switch', async () => {
    const { toolbar } = await readyEditor(true)
    expect(within(openSheet(toolbar)).getByRole('switch', { name: 'Horodatages dans la marge' })).toBeInTheDocument()
  })

  it('« Lien » closes the sheet and opens the link field', async () => {
    const { toolbar } = await readyEditor()
    fireEvent.click(within(openSheet(toolbar)).getByRole('button', { name: 'Lien (Ctrl+K)' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('form', { name: 'Lien' })).toBeInTheDocument()
  })

  it('the sheet offers every block of the mockup: image, table, tabs, diagram and chart (YC-50 to 54)', async () => {
    const { toolbar } = await readyEditor()
    const sheet = openSheet(toolbar)
    for (const name of ['Insérer une image', 'Insérer un tableau', 'Insérer des onglets', 'Insérer un schéma', 'Insérer un graphique']) {
      expect(within(sheet).getByRole('button', { name })).toBeInTheDocument()
    }
  })

  it('on a wider screen, the large bar stays', async () => {
    screenWidth(false)
    const { toolbar } = await readyEditor()
    expect(toolbar).not.toHaveClass('yc-toolbar-compact')
    expect(within(toolbar).queryByRole('button', { name: 'Toute la mise en forme' })).not.toBeInTheDocument()
    expect(within(toolbar).getByRole('button', { name: 'Rétablir (Ctrl+Y)' })).toBeInTheDocument()
  })
})
