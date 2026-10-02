import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VideoNotePage } from './VideoNotePage'

const docx = vi.hoisted(() => vi.fn(async () => new Blob(['docx'])))
vi.mock('@/features/notes/noteToDocx', () => ({ noteToDocx: docx, docxFileName: (t: string) => `${t}.docx` }))

const line = (text: string, marker?: number) => ({
  type: 'paragraph',
  ...(marker === undefined ? {} : { attrs: { marker } }),
  content: [{ type: 'text', text }],
})

let video: Record<string, unknown>
let note: unknown

function renderPage(url = '/notes/videos/v1') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/notes/videos/:videoId" element={<VideoNotePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('VideoNotePage (YC-77)', () => {
  let PlayerMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    video = {
      id: 'v1',
      youtubeId: 'dQw4w9WgXcQ',
      title: 'useEffect en profondeur',
      durationSeconds: 872,
      status: 'AVAILABLE',
      embeddable: true,
      channel: { youtubeId: 'UC1', title: 'Fireship', handle: null, avatarUrl: null },
      chapters: [
        { position: 0, startSeconds: 0, title: 'Intro' },
        { position: 1, startSeconds: 200, title: 'Le tableau de dépendances' },
      ],
      progress: { watchedSeconds: 245, completed: false },
    }
    note = {
      doc: { type: 'doc', content: [line('Le tableau de dépendances décide', 245), line('sans repère'), line('Toujours nettoyer', 520)] },
      page: null,
      updatedAt: '2026-10-02T12:32:00Z',
    }
    PlayerMock = vi.fn(() => ({
      getCurrentTime: () => 245,
      seekTo: vi.fn(),
      playVideo: vi.fn(),
      pauseVideo: vi.fn(),
      getPlayerState: () => 2,
      setPlaybackRate: vi.fn(),
      destroy: vi.fn(),
    }))
    vi.stubGlobal('YT', { Player: PlayerMock, PlayerState: { PLAYING: 1, PAUSED: 2, ENDED: 0 } })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/account/note-preferences')) return new Response(JSON.stringify({ paper: 'lignes', tint: 'creme', margin: true, timestamps: true, font: 'hanken', size: 16 }), { status: 200 })
        if (url.endsWith('/videos/v1/note')) return new Response(JSON.stringify(note), { status: 200 })
        if (url.endsWith('/videos/v1')) return new Response(JSON.stringify(video), { status: 200 })
        if (url.endsWith('/playlists/p1')) {
          return new Response(JSON.stringify({ id: 'p1', title: 'fullstack', videos: [{ id: 'v0', position: 2 }, { id: 'v1', position: 3 }] }), { status: 200 })
        }
        return new Response(JSON.stringify({ error: 'x' }), { status: 404 })
      }),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  /** The YouTube player once it said it is ready, as on the real page. */
  async function readyPlayer() {
    await waitFor(() => expect(PlayerMock).toHaveBeenCalled())
    const instance = PlayerMock.mock.results[0].value as { seekTo: ReturnType<typeof vi.fn> }
    const events = (PlayerMock.mock.calls[0][1] as { events: { onReady: (e: unknown) => void } }).events
    act(() => events.onReady({ target: instance }))
    return instance
  }

  it('names the playlist it was opened from, the place of the video, the channel and the length', async () => {
    renderPage('/notes/videos/v1?playlist=p1')
    expect(await screen.findByRole('heading', { level: 1, name: 'useEffect en profondeur' })).toBeInTheDocument()
    expect(await screen.findByText('fullstack · Vidéo 4 · Fireship · 14:32')).toBeInTheDocument()
  })

  it('without a playlist, says « Vidéo seule »', async () => {
    renderPage()
    expect(await screen.findByText('Vidéo seule · Fireship · 14:32')).toBeInTheDocument()
  })

  it('plays the video here from where the user stopped, and resumes there', async () => {
    renderPage()
    const instance = await readyPlayer()
    expect(instance.seekTo).toHaveBeenLastCalledWith(245, true)
    fireEvent.click(await screen.findByRole('button', { name: /Reprendre à 04:05/ }))
    expect(instance.seekTo).toHaveBeenLastCalledWith(245, true)
    // The chapter playing is under the video.
    expect(screen.getByText('04:05 · Le tableau de dépendances')).toBeInTheDocument()
  })

  it('lists the markers of the note in « Repères »: one playing, a click plays the video from it', async () => {
    renderPage()
    const instance = await readyPlayer()
    const card = await screen.findByRole('region', { name: 'Repères' })
    const rows = await within(card).findAllByRole('button')
    expect(rows.map((r) => r.textContent)).toEqual(['04:05Le tableau de dépendances décide● en cours', '08:40Toujours nettoyer'])
    fireEvent.click(rows[1])
    expect(instance.seekTo).toHaveBeenLastCalledWith(520, true)
    // The header counts them, after the save status.
    expect(screen.getByText(/· 2 repères$/)).toBeInTheDocument()
  })

  it('an unavailable video keeps the note and its markers, with no player and nothing to resume', async () => {
    video = { ...video, status: 'DELETED' }
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Vidéo indisponible' })).toBeInTheDocument()
    expect(PlayerMock).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /Reprendre/ })).not.toBeInTheDocument()
    const card = await screen.findByRole('region', { name: 'Repères' })
    await waitFor(() => expect(within(card).getAllByRole('button')).toHaveLength(2))
    within(card).getAllByRole('button').forEach((b) => expect(b).toBeDisabled())
  })

  it('« Exporter en .docx » in the header exports the note of the editor', async () => {
    const createObjectURL = vi.fn(() => 'blob:x')
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }))
    renderPage()
    await screen.findByRole('region', { name: 'Repères' })
    await waitFor(() => expect(screen.getAllByText(/Le tableau de dépendances décide/).length).toBeGreaterThan(1))
    fireEvent.click(screen.getByRole('button', { name: 'Exporter en .docx' }))
    await waitFor(() => expect(docx).toHaveBeenCalled())
    const [doc, meta] = docx.mock.calls[0] as unknown as [{ content: unknown[] }, { title: string }]
    expect(doc.content).toHaveLength(3)
    expect(meta.title).toBe('useEffect en profondeur')
  })

  it('the editor is the full bar and the page: the page draws the header, not the editor', async () => {
    renderPage()
    const toolbar = await screen.findByRole('toolbar', { name: 'Mise en forme' }, { timeout: 5000 })
    expect(toolbar).not.toHaveClass('yc-toolbar-compact')
    expect(screen.queryByRole('group', { name: 'Mode des notes' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Notes' })).not.toBeInTheDocument()
  })

  it('« Mes notes » is greyed until its page exists (YC-78)', async () => {
    renderPage()
    const back = await screen.findByText('← Mes notes · Bientôt')
    expect(back).toHaveAttribute('aria-disabled', 'true')
    expect(back.closest('a')).toBeNull()
  })

  it('says so when the video is not the user’s', async () => {
    renderPage('/notes/videos/autre')
    expect(await screen.findByRole('alert')).toHaveTextContent('ni dans tes playlists ni dans ta bibliothèque')
  })
})
