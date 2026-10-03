import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SingleVideoPage } from './SingleVideoPage'

const ID = 'dQw4w9WgXcQ'
const video = {
  id: 'v1',
  youtubeId: ID,
  title: 'Comprendre useEffect',
  thumbnailUrl: null,
  durationSeconds: 612,
  channelTitle: 'Fireship',
  availability: 'AVAILABLE',
  addedAt: '2026-10-01T10:00:00Z',
  completed: false,
  watchedSeconds: 0,
  completedAt: null,
}
let inLibrary: boolean
const posts: { url: string; body: unknown }[] = []

function renderPage(url = `/videos/${ID}`) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/videos/:youtubeId" element={<SingleVideoPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SingleVideoPage (YC-61)', () => {
  let PlayerMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    inLibrary = true
    posts.length = 0
    PlayerMock = vi.fn(() => ({
      getCurrentTime: () => 612,
      seekTo: vi.fn(),
      playVideo: vi.fn(),
      pauseVideo: vi.fn(),
      getPlayerState: () => 0,
      setPlaybackRate: vi.fn(),
      destroy: vi.fn(),
    }))
    vi.stubGlobal('YT', { Player: PlayerMock, PlayerState: { PLAYING: 1, PAUSED: 2, ENDED: 0 } })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          posts.push({ url, body: JSON.parse(init.body as string) })
          return new Response(JSON.stringify({ videoId: 'v1', completed: true, watchedSeconds: 612 }), { status: 200 })
        }
        if (url.includes(`/library/videos/${ID}`)) {
          return inLibrary ? new Response(JSON.stringify(video), { status: 200 }) : new Response(JSON.stringify({ error: 'x' }), { status: 404 })
        }
        if (url.includes('/note')) return new Response('null', { status: 200 })
        return new Response(JSON.stringify({ error: 'x' }), { status: 404 })
      }),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('says so when the video is not in the library', async () => {
    inLibrary = false
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('n’est pas dans ta bibliothèque')
  })

  it('a video with chapters: the bar cut at them, under the video (YC-88)', async () => {
    const detail = { id: 'v1', youtubeId: ID, title: 'Comprendre useEffect', durationSeconds: 612, chapters: [{ position: 0, startSeconds: 0, title: 'Intro' }, { position: 1, startSeconds: 245, title: 'Les dépendances' }] }
    const base = vi.mocked(fetch).getMockImplementation() as (url: string, init?: RequestInit) => Promise<Response>
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => (url.endsWith('/videos/v1') ? new Response(JSON.stringify(detail), { status: 200 }) : base(url, init))))
    renderPage()
    const slider = await screen.findByRole('slider', { name: 'Position dans la vidéo' })
    expect(slider.querySelectorAll('[data-chapter-segment]')).toHaveLength(2)
    expect(slider).toHaveAttribute('aria-valuemax', '612')
  })

  it('plays the video, with its title, the study controls and its note', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Comprendre useEffect' })).toBeInTheDocument()
    await waitFor(() => expect(PlayerMock).toHaveBeenCalled())
    expect((PlayerMock.mock.calls[0][1] as { videoId: string }).videoId).toBe(ID)
    expect(screen.getByRole('button', { name: /Vitesse de lecture/ })).toBeInTheDocument()
    // Focus mode (YC-76): the round back button, no app bar.
    expect(screen.getByRole('link', { name: 'Retour au tableau de bord' })).toHaveAttribute('href', '/')
  })

  it('starts where it was left; ?t= (a note found by the search, YC-22) starts at that moment', async () => {
    video.watchedSeconds = 90
    try {
      renderPage()
      await waitFor(() => expect(PlayerMock).toHaveBeenCalled())
      expect((PlayerMock.mock.calls[0][1] as { playerVars: { start: number } }).playerVars.start).toBe(90)
    } finally {
      video.watchedSeconds = 0
    }
  })

  it('?t= comes before the resume', async () => {
    video.watchedSeconds = 90
    try {
      renderPage(`/videos/${ID}?t=245`)
      await waitFor(() => expect(PlayerMock).toHaveBeenCalled())
      expect((PlayerMock.mock.calls[0][1] as { playerVars: { start: number } }).playerVars.start).toBe(245)
    } finally {
      video.watchedSeconds = 0
    }
  })

  it('at the end: the « vidéo seule » end card, and seen, with no playlist named', async () => {
    renderPage()
    await waitFor(() => expect(PlayerMock).toHaveBeenCalled())
    const events = (PlayerMock.mock.calls[0][1] as { events: { onReady: (e: unknown) => void; onStateChange: (e: { data: number }) => void } }).events
    act(() => events.onReady({ target: PlayerMock.mock.results[0].value }))
    act(() => events.onStateChange({ data: 0 }))
    expect(await screen.findByText('VIDÉO SEULE · TERMINÉE ✓')).toBeInTheDocument()
    // The end card's own link home, beside the back button of the focus mode (YC-76).
    expect(screen.getAllByRole('link', { name: 'Retour au tableau de bord' }).every((a) => a.getAttribute('href') === '/')).toBe(true)
    expect(screen.getAllByRole('link', { name: 'Retour au tableau de bord' })).toHaveLength(2)
    await waitFor(() => expect(posts.some((p) => (p.body as { completed?: boolean }).completed === true)).toBe(true))
    const seen = posts.find((p) => (p.body as { completed?: boolean }).completed === true)
    expect(seen?.url).toContain('/progress')
    expect(seen?.body).toEqual({ videoId: 'v1', completed: true })
  })
})
