import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
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

describe('PlaylistDetailPage, new design (YC-75)', () => {
  afterEach(() => vi.unstubAllGlobals())

  const detail = {
    videoCount: 4,
    // The private one was seen before it went private: it no longer counts (YC-13).
    videos: [video(0, { completed: true }), video(1, { watchedSeconds: 120 }), video(2), video(3, { availability: 'PRIVATE', completed: true })],
    contentChannel: { title: 'JavaScript Mastery', avatarUrl: null },
    multipleChannels: false,
    privacyStatus: 'PUBLIC' as const,
    lastAddedAt: '2026-09-02T10:00:00Z',
    youtubeUrl: 'https://www.youtube.com/playlist?list=PL',
  }

  it('says whose videos, how many and how long, and what is seen', async () => {
    renderWith(detail)
    expect(await screen.findByText('JavaScript Mastery · 4 vidéos · 40 min')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'fullstack' })).toBeInTheDocument()
    // Counted on the three playable videos (YC-13).
    expect(screen.getByText('1/3 vues')).toBeInTheDocument()
  })

  it('resumes at the video started, marked in the list', async () => {
    renderWith(detail)
    expect(await screen.findByRole('link', { name: /Reprendre à la vidéo 2/ })).toHaveAttribute('href', '/playlists/p1/watch/y1')
    expect(screen.getByText(/2\. Titre 1/).closest('a')).toHaveAttribute('aria-current', 'step')
  })

  it('shows only what YouTube gave: count, length, last addition, visibility, and a link to YouTube', async () => {
    renderWith(detail)
    const facts = await screen.findByRole('list', { name: 'En chiffres' })
    expect(within(facts).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '4 vidéos', '40 min au total', 'Dernier ajout le 2 sept. 2026', 'Publique',
    ])
    expect(screen.queryByText(/Créée le|Langue|Sujets/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voir sur YouTube' })).toHaveAttribute('href', 'https://www.youtube.com/playlist?list=PL')
  })

  it('a merged playlist has no link to YouTube and says « Plusieurs chaînes »', async () => {
    renderWith({ ...detail, youtubeUrl: null, contentChannel: null, multipleChannels: true })
    expect(await screen.findByText(/^Plusieurs chaînes · 4 vidéos/)).toBeInTheDocument()
    expect(screen.queryByText('Voir sur YouTube')).not.toBeInTheDocument()
  })

  it('greys the per-playlist export until it exists (YC-86)', async () => {
    renderWith(detail)
    const exportNotes = await screen.findByText(/Exporter les notes/)
    expect(exportNotes).toHaveAttribute('aria-disabled', 'true')
    expect(screen.queryByRole('link', { name: /Exporter les notes/ })).not.toBeInTheDocument()
  })

  it('never shows a broken channel image: a disc takes its place', async () => {
    renderWith({ ...detail, contentChannel: { title: 'JavaScript Mastery', avatarUrl: 'https://yt3.ggpht.com/x' } })
    const name = await screen.findByText('JavaScript Mastery', { selector: 'p' })
    const img = name.querySelector('img') as HTMLImageElement
    expect(img).toHaveAttribute('src', 'https://yt3.ggpht.com/x')
    fireEvent.error(img)
    expect(name.querySelector('img')).toBeNull()
  })
})
