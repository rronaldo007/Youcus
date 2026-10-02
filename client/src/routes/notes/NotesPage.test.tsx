import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NoteList } from '@/features/notes/useNotes'
import { NotesPage } from './NotesPage'

let list: NoteList
let listCalls: number

// A fixed clock: « il y a 2 h » must not become « hier » when the suite runs between 00:00 and 02:00.
const NOW = new Date(2026, 9, 2, 20, 30)
const recent = new Date(NOW.getTime() - 2 * 3600_000).toISOString()

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/notes']}>
        <Routes>
          <Route path="/notes" element={<NotesPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('NotesPage (YC-78)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    window.history.replaceState(null, '', '/notes')
    listCalls = 0
    list = {
      notes: [
        {
          kind: 'video',
          id: 'n1',
          updatedAt: recent,
          excerpt: 'Après le rendu, jamais pendant.',
          markers: [
            { seconds: 245, text: 'Les dépendances décident quand.' },
            { seconds: 520, text: 'Toujours nettoyer l’effet.' },
          ],
          markerCount: 2,
          video: { id: 'v1', youtubeId: 'yt1', title: 'useEffect en profondeur' },
          playlists: [
            { id: 'p1', title: 'fullstack', position: 3 },
            { id: 'p2', title: 'games', position: 0 },
          ],
        },
        { kind: 'playlist', id: 'n2', updatedAt: recent, excerpt: 'Objectif', playlist: { id: 'p3', title: 'Databases', videoCount: 12 } },
        { kind: 'video', id: 'n3', updatedAt: recent, excerpt: 'seule', markers: [], markerCount: 0, video: { id: 'v9', youtubeId: 'yt9', title: 'Une vidéo seule' }, playlists: [] },
      ],
      totals: { notes: 3, markers: 2, playlists: 3 },
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/account/note-preferences')) return new Response(JSON.stringify({ paper: 'lignes', tint: 'creme', margin: true, timestamps: true, font: 'hanken', size: 16 }), { status: 200 })
        if (url.endsWith('/notes')) {
          listCalls++
          return new Response(JSON.stringify(list), { status: 200 })
        }
        if (url.endsWith('/videos/v1/note')) {
          return new Response(JSON.stringify({ doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Après le rendu' }] }] }, page: null, updatedAt: recent }), { status: 200 })
        }
        return new Response(JSON.stringify({ error: 'x' }), { status: 404 })
      }),
    )
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('counts the notes, the markers and the playlists, and greys the export until YC-86', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { level: 1, name: 'Mes notes' })).toBeInTheDocument()
    expect(screen.getByText('3 notes · 2 repères · 3 playlists')).toBeInTheDocument()
    expect(screen.getByText('Exporter en .docx · Bientôt')).toHaveAttribute('aria-disabled', 'true')
  })

  it('a video card: where it comes from, its note page, its markers opening the player at their moment', async () => {
    renderPage()
    const card = await screen.findByRole('article', { name: 'useEffect en profondeur' })
    expect(within(card).getByText('fullstack · Vidéo 4')).toBeInTheDocument()
    expect(within(card).getByRole('link', { name: 'useEffect en profondeur' })).toHaveAttribute('href', '/notes/videos/v1?playlist=p1')
    expect(within(card).getByRole('link', { name: 'Ouvrir la vidéo à 08:40' })).toHaveAttribute('href', '/playlists/p1/watch/yt1?t=520')
    // « Rouvrir » resumes where the user stopped: no moment in the address.
    expect(within(card).getByRole('link', { name: 'Rouvrir la vidéo →' })).toHaveAttribute('href', '/playlists/p1/watch/yt1')
    expect(within(card).getByText('Modifiée il y a 2 h · 2 repères')).toBeInTheDocument()
  })

  it('a playlist note and a video kept on its own have their own card', async () => {
    renderPage()
    const playlist = await screen.findByRole('article', { name: 'Databases' })
    expect(within(playlist).getByText('Note de playlist · 12 vidéos')).toBeInTheDocument()
    expect(within(playlist).getByRole('link', { name: 'Ouvrir la note →' })).toHaveAttribute('href', '/notes/playlists/p3')
    const single = screen.getByRole('article', { name: 'Une vidéo seule' })
    expect(within(single).getByText('Vidéo seule')).toBeInTheDocument()
    expect(within(single).getByRole('link', { name: 'Rouvrir la vidéo →' })).toHaveAttribute('href', '/videos/yt9')
    expect(within(single).getByText('Modifiée il y a 2 h · 0 repère')).toBeInTheDocument()
  })

  it('filters by playlist; the card then says the place of the video in THAT playlist', async () => {
    renderPage()
    const filters = await screen.findByRole('group', { name: 'Filtrer les notes' })
    expect(within(filters).getAllByRole('button').map((b) => b.textContent)).toEqual(['Récentes', 'fullstack', 'games', 'Databases'])
    expect(within(filters).getByRole('button', { name: 'Récentes' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(within(filters).getByRole('button', { name: 'games' }))
    expect(screen.getAllByRole('article').map((a) => a.getAttribute('aria-label'))).toEqual(['useEffect en profondeur'])
    expect(screen.getByText('games · Vidéo 1')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Rouvrir la vidéo →' })).toHaveAttribute('href', '/playlists/p2/watch/yt1')
  })

  it('« Agrandir » opens the note in its expanded view here; closing reads the list again', async () => {
    renderPage()
    const card = await screen.findByRole('article', { name: 'useEffect en profondeur' })
    fireEvent.click(within(card).getByRole('button', { name: 'Agrandir la note : useEffect en profondeur' }))
    const dialog = await screen.findByRole('dialog', {}, { timeout: 5000 })
    expect(within(dialog).getByRole('heading', { name: 'useEffect en profondeur' })).toBeInTheDocument()
    const before = listCalls
    fireEvent.click(within(dialog).getByRole('button', { name: 'Fermer (Échap)' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(listCalls).toBeGreaterThan(before))
  })

  it('an empty notebook says how to start', async () => {
    list = { notes: [], totals: { notes: 0, markers: 0, playlists: 0 } }
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Ton cahier est vide' })).toBeInTheDocument()
    expect(screen.getByText('Aucune note encore')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ouvrir le tableau de bord' })).toHaveAttribute('href', '/')
    expect(screen.queryByRole('group', { name: 'Filtrer les notes' })).not.toBeInTheDocument()
  })
})
