import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NoteDoc } from '@/features/notes/noteDoc'
import { noteExcerpt } from '@/features/notes/noteExcerpt'
import { PlaylistNotePreview } from './PlaylistNotePreview'

/** YC-75, corrected by Ronaldo on 02/10: a preview, and « Ouvrir dans le cahier » opens the expanded note. */
const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })
let stored: { doc: NoteDoc; page: null; updatedAt: string } | null

function renderPreview() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.endsWith('/account/note-preferences')) return new Response(JSON.stringify({ paper: 'lignes', tint: 'creme', margin: true, timestamps: true, font: 'hanken', size: 16 }), { status: 200 })
      return new Response(JSON.stringify(stored), { status: 200 })
    }),
  )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PlaylistNotePreview playlistId="p1" context={{ eyebrow: 'Note de playlist · 17 vidéos', heading: 'fullstack' }} />
    </QueryClientProvider>,
  )
}

describe('noteExcerpt', () => {
  it('keeps the words, a space between blocks, nothing else', () => {
    const doc = { type: 'doc' as const, content: [
      { type: 'heading', content: [{ type: 'text', text: 'Objectif' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'construire une app ' }, { type: 'text', text: 'React', marks: [{ type: 'bold' }] }] },
      { type: 'chart', attrs: { rows: [] } },
    ] }
    expect(noteExcerpt(doc)).toBe('Objectif construire une app React')
    expect(noteExcerpt(null)).toBe('')
  })
})

describe('PlaylistNotePreview (YC-75)', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/playlists/p1')
    stored = { doc: { type: 'doc', content: [para('Objectif : construire une application React complète.')] }, page: null, updatedAt: '2026-10-02T10:00:00Z' }
  })
  afterEach(async () => {
    vi.unstubAllGlobals()
    await new Promise((r) => setTimeout(r, 30))
    window.history.replaceState(null, '', '/')
  })

  it('shows what the note says and that it is saved, never the editor inline', async () => {
    renderPreview()
    expect(await screen.findByText('Objectif : construire une application React complète.')).toBeInTheDocument()
    expect(screen.getByText('Enregistré')).toBeInTheDocument()
    await screen.findByRole('textbox', { name: 'Contenu de la note de la playlist', hidden: true }, { timeout: 5000 })
    expect(screen.queryByRole('textbox', { name: 'Contenu de la note de la playlist' })).not.toBeInTheDocument()
  })

  it('« Ouvrir dans le cahier » opens the expanded note; closing gives the focus back', async () => {
    renderPreview()
    const hiddenEditor = await screen.findByRole('textbox', { name: 'Contenu de la note de la playlist', hidden: true }, { timeout: 5000 })
    await waitFor(() => expect(hiddenEditor).toHaveTextContent('Objectif'))
    const button = screen.getByRole('button', { name: 'Ouvrir dans le cahier' })
    fireEvent.click(button)
    const dialog = screen.getByRole('dialog', { name: 'fullstack' })
    expect(window.location.search).toBe('?note=agrandie')
    expect(within(dialog).getByRole('textbox', { name: 'Contenu de la note de la playlist' })).toHaveTextContent('Objectif')
    fireEvent.keyDown(within(dialog).getByRole('button', { name: 'Fermer (Échap)' }), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(button).toHaveFocus())
  })

  it('invites to write when there is no note yet', async () => {
    stored = null
    renderPreview()
    expect(await screen.findByText(/Aucune note pour l’instant/)).toBeInTheDocument()
    expect(screen.queryByText('Enregistré')).not.toBeInTheDocument()
  })
})
