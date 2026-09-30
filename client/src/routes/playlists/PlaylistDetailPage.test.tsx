import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PlaylistDetailPage } from './PlaylistDetailPage'
import type { PlaylistDetail } from '@/types'

vi.mock('@/features/notes/PlaylistNotes', () => ({ PlaylistNotes: () => null }))

const video = (i: number, extra: object = {}) => ({
  id: `v${i}`, youtubeId: `y${i}`, title: `Titre ${i}`, thumbnailUrl: 't', position: i, durationSeconds: 600, ...extra,
})

function renderWith(detail: Partial<PlaylistDetail>) {
  const body: PlaylistDetail = {
    id: 'p1', youtubeId: 'PL', title: 'fullstack', thumbnailUrl: null, videoCount: 0, description: null, videos: [], ...detail,
  }
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })))
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/playlists/p1']}>
        <Routes>
          <Route path="/playlists/:id" element={<PlaylistDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PlaylistDetailPage, unavailable videos (YC-13)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('warns about them and shows each one dimmed, with its reason, and not as a link', async () => {
    renderWith({
      videoCount: 3,
      videos: [video(0), video(1, { availability: 'PRIVATE', title: 'Context API' }), video(2, { availability: 'DELETED' })],
      unavailable: { total: 2, private: 1, deleted: 1, notEmbeddable: 0, blocked: 0, upcoming: 0 },
    })
    expect(await screen.findByRole('status')).toHaveTextContent('2 vidéos indisponibles : 1 privée, 1 supprimée.')
    expect(screen.getByText('Privée')).toBeInTheDocument()
    expect(screen.getByText('Supprimée')).toBeInTheDocument()
    // The private one keeps the title we already knew, but is not a link to the player.
    expect(screen.getByText(/Context API/).closest('a')).toBeNull()
    expect(screen.getByText(/Titre 0/).closest('a')).toHaveAttribute('href', '/playlists/p1/watch/y0')
  })

  it('shows no warning when every video can be played', async () => {
    renderWith({
      videoCount: 1,
      videos: [video(0, { availability: 'AVAILABLE' })],
      unavailable: { total: 0, private: 0, deleted: 0, notEmbeddable: 0, blocked: 0, upcoming: 0 },
    })
    await screen.findByText(/Titre 0/)
    expect(screen.queryByRole('status')).toBeNull()
  })
})
