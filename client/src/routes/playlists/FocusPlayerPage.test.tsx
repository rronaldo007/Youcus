import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isPlayerPath } from '@/components/layout/navItems'
import { FocusPlayerPage } from './FocusPlayerPage'

/** YC-76: the player of the new design, in focus mode, with its states. */
const v = (i: number, extra: object = {}) => ({
  id: `v${i}`, youtubeId: `yt${i}xxxxxx`, title: `Vidéo ${i}`, thumbnailUrl: null, position: i, durationSeconds: 600,
  completed: false, watchedSeconds: 0, availability: 'AVAILABLE', ...extra,
})
let videos: ReturnType<typeof v>[]
let PlayerMock: ReturnType<typeof vi.fn>

function renderPlayer(youtubeId: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/playlists/p1/watch/${youtubeId}`]}>
        <Routes>
          <Route path="/playlists/:id/watch/:videoId" element={<FocusPlayerPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('FocusPlayerPage, new design (YC-76)', () => {
  beforeEach(() => {
    videos = [v(0, { completed: true }), v(1), v(2, { availability: 'PRIVATE' }), v(3)]
    PlayerMock = vi.fn(() => ({ getCurrentTime: () => 0, seekTo: vi.fn(), playVideo: vi.fn(), pauseVideo: vi.fn(), getPlayerState: () => -1, setPlaybackRate: vi.fn(), destroy: vi.fn() }))
    vi.stubGlobal('YT', { Player: PlayerMock, PlayerState: { PLAYING: 1, PAUSED: 2, ENDED: 0 } })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/playlists/p1')) {
          return new Response(JSON.stringify({ id: 'p1', youtubeId: 'PL', title: 'fullstack', thumbnailUrl: null, videoCount: 4, description: null, videos, channelTitle: 'JS Mastery' }), { status: 200 })
        }
        if (url.includes('/note')) return new Response('null', { status: 200 })
        return new Response(JSON.stringify({ error: 'x' }), { status: 404 })
      }),
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('knows the player pages, where the app bar steps aside', () => {
    expect(isPlayerPath('/playlists/p1/watch/abc')).toBe(true)
    expect(isPlayerPath('/videos/abc')).toBe(true)
    expect(isPlayerPath('/playlists/p1')).toBe(false)
    expect(isPlayerPath('/')).toBe(false)
  })

  it('says where the video is in the playlist, goes back to it, and writes in « Mon cahier »', async () => {
    renderPlayer('yt1xxxxxx')
    expect(await screen.findByText('Vidéo 2 / 4 · 2 ensuite')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Retour à fullstack' })).toHaveAttribute('href', '/playlists/p1')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('2. Vidéo 1')
    expect(await screen.findByRole('heading', { name: 'Mon cahier' }, { timeout: 5000 })).toBeInTheDocument()
    // The notebook of the frame: the compact toolbar, no « Éditer / Aperçu » (reading is in the expanded view).
    expect(await screen.findByRole('toolbar', { name: 'Mise en forme' }, { timeout: 5000 })).toHaveClass('yc-toolbar-compact')
    expect(screen.queryByRole('group', { name: 'Mode des notes' })).not.toBeInTheDocument()
    // Previous and next skip the private one (YC-13).
    expect(screen.getByRole('link', { name: 'Vidéo précédente' })).toHaveAttribute('href', '/playlists/p1/watch/yt0xxxxxx')
    expect(screen.getByRole('link', { name: 'Vidéo suivante' })).toHaveAttribute('href', '/playlists/p1/watch/yt3xxxxxx')
  })

  it('opens the playlist\'s videos from « ☰ », on every size', async () => {
    renderPlayer('yt1xxxxxx')
    fireEvent.click(await screen.findByRole('button', { name: 'Vidéos de la playlist' }))
    const drawer = screen.getByRole('dialog', { name: 'Vidéos de la playlist' })
    expect(within(drawer).getByText('Vidéo 3')).toBeInTheDocument()
    fireEvent.click(within(drawer).getByRole('button', { name: 'Fermer la liste' }))
    expect(screen.queryByRole('dialog', { name: 'Vidéos de la playlist' })).not.toBeInTheDocument()
  })

  it('an unavailable video shows why, keeps the note, offers the next one; nothing to play or mark', async () => {
    renderPlayer('yt2xxxxxx')
    expect(await screen.findByRole('heading', { name: 'Vidéo indisponible' })).toBeInTheDocument()
    expect(screen.getByText(/YouTube ne la sert plus ici \(privée\)\. Ta note et tes repères sont conservés\./)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Vidéo suivante →' })).toHaveAttribute('href', '/playlists/p1/watch/yt3xxxxxx')
    expect(PlayerMock).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /Marquer comme vue/ })).toBeDisabled()
  })

  it('offline: the banner says the notes are kept, the stage waits for the network', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    renderPlayer('yt1xxxxxx')
    expect(await screen.findByRole('heading', { name: 'Pas de réseau' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Hors ligne. Tes notes sont enregistrées ici')
    expect(PlayerMock).not.toHaveBeenCalled()
  })

  it('the network back: the player returns without a reload', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    renderPlayer('yt1xxxxxx')
    await screen.findByRole('heading', { name: 'Pas de réseau' })
    online.mockReturnValue(true)
    fireEvent(window, new Event('online'))
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Pas de réseau' })).not.toBeInTheDocument())
  })
})
