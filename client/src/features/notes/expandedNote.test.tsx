import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Editor } from '@tiptap/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NoteDoc } from './noteDoc'
import { PlaylistNotes } from './PlaylistNotes'
import { VideoNotes } from './VideoNotes'

const para = (text: string, marker?: number) => ({ type: 'paragraph', ...(marker === undefined ? {} : { attrs: { marker } }), content: [{ type: 'text', text }] })
let storedDoc: NoteDoc
const seek = vi.fn()

function stubApi() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/account/note-preferences')) return new Response(JSON.stringify({ paper: 'lignes', tint: 'creme', margin: true, timestamps: true, font: 'hanken', size: 16 }), { status: 200 })
      if (init?.method === 'PUT') return new Response(JSON.stringify({ ...JSON.parse(init.body as string), updatedAt: '2026-10-01T10:00:00Z' }), { status: 200 })
      return new Response(JSON.stringify({ doc: storedDoc, page: null, updatedAt: '2026-10-01T10:00:00Z' }), { status: 200 })
    }),
  )
}

const client = () => new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })

async function videoNote(seconds = 530) {
  render(
    <QueryClientProvider client={client()}>
      <VideoNotes videoId="v1" player={{ seconds, seek }} context={{ eyebrow: 'Fullstack · Vidéo 4 · 14:32', heading: 'useEffect en profondeur' }} />
    </QueryClientProvider>,
  )
  const el = await screen.findByRole('textbox', { name: 'Note de la vidéo' }, { timeout: 5000 })
  await waitFor(() => expect(el).toHaveTextContent('Les hooks'))
  return { el, editor: (el as unknown as { editor: Editor }).editor }
}

const expandTool = () => screen.getByRole('button', { name: 'Agrandir la note' })
const open = () => {
  fireEvent.click(expandTool())
  return screen.getByRole('dialog', { name: 'useEffect en profondeur' })
}

describe('expanded view of a note (YC-18)', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/playlists/p1/watch/v1')
    storedDoc = {
      type: 'doc',
      content: [para('Les hooks essentiels'), para('Le tableau de dépendances', 245), para('Fonction de nettoyage', 520), para('Pièges courants', 754)],
    }
    seek.mockReset()
    stubApi()
  })
  afterEach(async () => {
    vi.unstubAllGlobals()
    // A back() of the test is asynchronous in jsdom: let it land before the next test sets its URL.
    await new Promise((r) => setTimeout(r, 30))
    window.history.replaceState(null, '', '/')
  })

  it('« Agrandir la note » opens a modal dialog with the context of the note, in the address', async () => {
    await videoNote()
    const dialog = open()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(within(dialog).getByText('Fullstack · Vidéo 4 · 14:32')).toBeInTheDocument()
    expect(window.location.search).toBe('?note=agrandie')
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('it is the same editor: nothing typed is lost, nothing is mounted twice', async () => {
    const { el, editor } = await videoNote()
    act(() => {
      editor.commands.insertContentAt(editor.state.doc.content.size - 1, ' (pas encore enregistré)')
    })
    const dialog = open()
    const inside = within(dialog).getByRole('textbox', { name: 'Note de la vidéo' })
    expect(inside).toBe(el)
    expect((inside as unknown as { editor: Editor }).editor).toBe(editor)
    expect(inside).toHaveTextContent('(pas encore enregistré)')
    expect(screen.getAllByRole('textbox', { name: 'Note de la vidéo' })).toHaveLength(1)
  })

  it('Lire hides the toolbar, Modifier shows it with « Réduire la note »', async () => {
    await videoNote()
    const dialog = open()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lire' }))
    expect(within(dialog).queryByRole('toolbar')).not.toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Modifier' }))
    expect(within(within(dialog).getByRole('toolbar')).getByRole('button', { name: 'Réduire la note' })).toBeInTheDocument()
  })

  it('the tick of « saved » shows only once saved', async () => {
    const { editor } = await videoNote()
    const dialog = open()
    const status = () => dialog.querySelector('.yc-x-status') as HTMLElement
    expect(status()).toHaveTextContent('Enregistré à')
    expect(status().querySelector('.yc-tool-icon')).not.toBeNull()
    act(() => {
      editor.commands.insertContentAt(editor.state.doc.content.size - 1, ' x')
    })
    expect(status()).toHaveTextContent('Modifié')
    expect(status().querySelector('.yc-tool-icon')).toBeNull()
  })

  it('« Exporter en .docx » downloads what the editor holds, named after the title (YC-49)', async () => {
    const { editor } = await videoNote()
    act(() => {
      editor.commands.insertContentAt(editor.state.doc.content.size - 1, ' (tapé à l’instant)')
    })
    const made: Blob[] = []
    const createObjectURL = vi.fn((blob: Blob) => {
      made.push(blob)
      return 'blob:note'
    })
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }))
    const names: string[] = []
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download)
    })
    const dialog = open()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Exporter en .docx' }))
    await waitFor(() => expect(names).toEqual(['useEffect-en-profondeur.docx']), { timeout: 5000 })
    expect(made[0].type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    expect(made[0].size).toBeGreaterThan(1000)
    expect(within(dialog).getByRole('button', { name: 'Exporter en .docx' })).not.toHaveAttribute('aria-busy')
    click.mockRestore()
  })

  it('lists the markers in time order, the seen ones and the one playing', async () => {
    await videoNote(530)
    const side = within(open()).getByRole('complementary', { name: 'Repères' })
    const rows = within(side)
      .getAllByRole('button')
      .filter((b) => b.classList.contains('yc-x-marker'))
      .map((b) => b.textContent)
    expect(rows).toEqual(['04:05Le tableau de dépendances✓ vu', '08:40Fonction de nettoyage● en cours', '12:34Pièges courants'])
    expect(within(screen.getByRole('dialog')).getByText(/3 repères/)).toBeInTheDocument()
  })

  it('a marker closes the view and plays the video there', async () => {
    await videoNote()
    const side = within(open()).getByRole('complementary', { name: 'Repères' })
    fireEvent.click(within(side).getByRole('button', { name: /12:34/ }))
    expect(seek).toHaveBeenCalledWith(754)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('« Reprendre » plays from where the player is', async () => {
    await videoNote(530)
    fireEvent.click(within(open()).getByRole('button', { name: 'Reprendre à 08:50' }))
    expect(seek).toHaveBeenCalledWith(530)
  })

  it('Échap closes, the focus back on « Agrandir la note », the page scrolls again', async () => {
    await videoNote()
    const dialog = open()
    fireEvent.keyDown(within(dialog).getByRole('button', { name: 'Fermer (Échap)' }), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(expandTool()).toHaveFocus())
    expect(document.body.style.overflow).toBe('')
  })

  it('Échap typed in the note closes the view, as Chrome sends it (keyCode 27, marked handled by ProseMirror)', async () => {
    const { el } = await videoNote()
    open()
    fireEvent.keyDown(el, { key: 'Escape', keyCode: 27 })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('Échap with the « : » list open closes the list only', async () => {
    const { el, editor } = await videoNote()
    open()
    act(() => {
      editor.commands.insertContent(' :amp')
    })
    await screen.findByRole('listbox', { name: 'Icônes' })
    fireEvent.keyDown(el, { key: 'Escape', keyCode: 27 })
    await waitFor(() => expect(screen.queryByRole('listbox', { name: 'Icônes' })).not.toBeInTheDocument())
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('Échap in the data of a chart closes that table only (YC-54)', async () => {
    storedDoc = { type: 'doc', content: [para('Les hooks essentiels'), { type: 'noteChart', attrs: { chart: { title: 'T', kind: 'bar', rows: [{ label: 'A', value: 1 }] } } }] }
    await videoNote()
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Modifier les données' }))
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Valeur, ligne 1' }), { key: 'Escape', keyCode: 27 })
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Données du graphique' })).not.toBeInTheDocument())
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('Échap in a diagram drops the tool first, then closes the view (YC-63)', async () => {
    storedDoc = { type: 'doc', content: [para('Les hooks essentiels'), { type: 'noteDiagram', attrs: { scene: { shapes: [], arrows: [] } } }] }
    await videoNote()
    open()
    const rect = screen.getByRole('button', { name: 'Rectangle' })
    fireEvent.click(rect)
    expect(rect).toHaveAttribute('aria-pressed', 'true')
    const drawing = document.querySelector('.yc-diagram') as HTMLElement
    fireEvent.keyDown(drawing, { key: 'Escape', keyCode: 27 })
    expect(rect).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    // Nothing left to drop: the next Échap is the view's.
    fireEvent.keyDown(drawing, { key: 'Escape', keyCode: 27 })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('Échap while renaming a tab cancels the name only (YC-63)', async () => {
    const tab = (title: string) => ({ type: 'noteTab', attrs: { title }, content: [para(`Dans ${title}`)] })
    storedDoc = { type: 'doc', content: [para('Les hooks essentiels'), { type: 'noteTabs', content: [tab('Théorie'), tab('Exemples')] }] }
    await videoNote()
    open()
    fireEvent.click(screen.getByRole('tab', { selected: true }))
    const field = screen.getByRole('textbox', { name: "Nom de l'onglet" })
    fireEvent.keyDown(field, { key: 'Escape', keyCode: 27 })
    await waitFor(() => expect(screen.queryByRole('textbox', { name: "Nom de l'onglet" })).not.toBeInTheDocument())
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('the veil and « Réduire » close it too', async () => {
    await videoNote()
    open()
    fireEvent.click(document.querySelector('.yc-x-veil') as Element)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    fireEvent.click(within(open()).getByRole('button', { name: 'Réduire (revenir à la note)' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('Retour (the history) closes it', async () => {
    await videoNote()
    open()
    act(() => {
      window.history.back()
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(window.location.search).toBe('')
  })

  it('a shared link with ?note=agrandie opens the view', async () => {
    window.history.replaceState(null, '', '/playlists/p1/watch/v1?note=agrandie')
    await videoNote()
    expect(screen.getByRole('dialog', { name: 'useEffect en profondeur' })).toBeInTheDocument()
  })

  it('Échap in a menu of the toolbar closes the menu, not the view', async () => {
    await videoNote()
    const dialog = open()
    fireEvent.click(within(dialog).getByRole('button', { name: /^Fond/ }))
    const menu = screen.getByRole('menu', { name: 'Page' })
    fireEvent.keyDown(within(menu).getAllByRole('menuitemradio')[0], { key: 'Escape' })
    expect(screen.queryByRole('menu', { name: 'Page' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('a playlist note, without a player, has no markers panel', async () => {
    render(
      <QueryClientProvider client={client()}>
        <PlaylistNotes playlistId="p1" context={{ eyebrow: 'Note de playlist · 4 vidéos', heading: 'Fullstack' }} />
      </QueryClientProvider>,
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Agrandir la note' }, { timeout: 5000 }))
    const dialog = screen.getByRole('dialog', { name: 'Fullstack' })
    expect(within(dialog).queryByRole('complementary', { name: 'Repères' })).not.toBeInTheDocument()
    expect(within(dialog).queryByText(/repère/)).not.toBeInTheDocument()
  })
})
