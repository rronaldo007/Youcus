import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LibraryVideo } from '@/types'
import { PlaylistLibrary } from './PlaylistLibrary'

let playlists: unknown[]
let library: LibraryVideo[] | 'error'

const video = (over: Partial<LibraryVideo>): LibraryVideo => ({
  id: 'v1',
  youtubeId: 'dQw4w9WgXcQ',
  title: 'Comprendre useEffect',
  thumbnailUrl: null,
  durationSeconds: 612,
  channelTitle: 'Fireship',
  availability: 'AVAILABLE',
  addedAt: '2026-10-01T10:00:00Z',
  completed: false,
  watchedSeconds: 0,
  completedAt: null,
  ...over,
})

function renderLibrary() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <PlaylistLibrary />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const titles = () => screen.getAllByRole('listitem').map((li) => li.textContent ?? '')

describe('PlaylistLibrary', () => {
  beforeEach(() => {
    playlists = [{ id: 'p1', youtubeId: 'y1', title: 'Cours React', thumbnailUrl: null, videoCount: 12 }]
    library = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === 'DELETE') return new Response(JSON.stringify({ ok: true }), { status: 200 })
        if (url.includes('/library/videos')) {
          return library === 'error'
            ? new Response(JSON.stringify({ error: 'down' }), { status: 500 })
            : new Response(JSON.stringify(library), { status: 200 })
        }
        return new Response(JSON.stringify(playlists), { status: 200 })
      }),
    )
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('affiche les playlists avec ce qui reste à voir (YC-67)', async () => {
    renderLibrary()
    expect(await screen.findByText('Cours React')).toBeInTheDocument()
    expect(screen.getByText('12 restantes')).toBeInTheDocument()
    expect(screen.getByText('0/12')).toBeInTheDocument()
  })

  it('supprime une playlist via DELETE /playlists/:id', async () => {
    renderLibrary()
    fireEvent.click(await screen.findByRole('button', { name: /Supprimer/i }))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/playlists/p1'),
        expect.objectContaining({ method: 'DELETE' }),
      ),
    )
  })

  describe('videos kept on their own (YC-61)', () => {
    beforeEach(() => {
      library = [
        video({ id: 'v1', title: 'À voir encore' }),
        video({ id: 'v2', youtubeId: 'abcdefghijk', title: 'Commencée', watchedSeconds: 240 }),
        video({ id: 'v3', youtubeId: 'zyxwvutsrqp', title: 'Déjà vue', completed: true, watchedSeconds: 612, completedAt: '2026-09-28T18:00:00Z' }),
      ]
    })

    it('come after the playlists, in the same grid, each opening its player', async () => {
      renderLibrary()
      expect(await screen.findByText('À voir encore')).toBeInTheDocument()
      const items = titles()
      expect(items.findIndex((t) => t.includes('Cours React'))).toBeLessThan(items.findIndex((t) => t.includes('À voir encore')))
      expect(screen.getByRole('link', { name: /Commencée/ })).toHaveAttribute('href', '/videos/abcdefghijk')
    })

    it('say their state and what is left, in minutes', async () => {
      renderLibrary()
      const todo = (await screen.findByText('À voir encore')).closest('li') as HTMLElement
      expect(within(todo).getByText('○ À voir')).toBeInTheDocument()
      expect(within(todo).getByText('Pas encore commencée')).toBeInTheDocument()
      const started = screen.getByText('Commencée').closest('li') as HTMLElement
      expect(within(started).getByText('● En cours')).toBeInTheDocument()
      expect(within(started).getByText('7 min restantes')).toBeInTheDocument()
      expect(within(started).getByText('4:00 / 10:12')).toBeInTheDocument()
      const seen = screen.getByText('Déjà vue').closest('li') as HTMLElement
      expect(within(seen).getByText('✓ Vue')).toBeInTheDocument()
      expect(within(seen).getByText('Vue le 28 sept.')).toBeInTheDocument()
    })

    it('« Vidéos seules » shows them alone; « En cours » and « Terminées » sort them too', async () => {
      renderLibrary()
      await screen.findByText('À voir encore')
      fireEvent.click(screen.getByRole('button', { name: 'Vidéos seules' }))
      expect(screen.queryByText('Cours React')).not.toBeInTheDocument()
      expect(screen.getByText('À voir encore')).toBeInTheDocument()
      expect(screen.getByText('Déjà vue')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'En cours' }))
      expect(screen.getByText('Commencée')).toBeInTheDocument()
      expect(screen.queryByText('À voir encore')).not.toBeInTheDocument()
      expect(screen.queryByText('Déjà vue')).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Terminées' }))
      expect(screen.getByText('Déjà vue')).toBeInTheDocument()
      expect(screen.queryByText('Commencée')).not.toBeInTheDocument()
    })

    it('« Retirer » takes one out of the library, after a confirmation', async () => {
      renderLibrary()
      const item = (await screen.findByText('Commencée')).closest('li') as HTMLElement
      fireEvent.click(within(item).getByRole('button', { name: 'Retirer' }))
      expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Sa note est gardée'))
      await waitFor(() =>
        expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/library/videos/v2'), expect.objectContaining({ method: 'DELETE' })),
      )
    })

    it('a library with videos but no playlist is not empty', async () => {
      playlists = []
      renderLibrary()
      expect(await screen.findByText('À voir encore')).toBeInTheDocument()
      expect(screen.queryByText(/Aucune playlist/)).not.toBeInTheDocument()
    })

    it('says when there is no video on its own yet', async () => {
      library = []
      renderLibrary()
      await screen.findByText('Cours React')
      fireEvent.click(screen.getByRole('button', { name: 'Vidéos seules' }))
      expect(screen.getByText(/Aucune vidéo seule/)).toBeInTheDocument()
    })

    it('the playlists stay when the library cannot be read', async () => {
      library = 'error'
      renderLibrary()
      expect(await screen.findByText('Cours React')).toBeInTheDocument()
      expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de charger tes vidéos seules')
    })
  })
})
