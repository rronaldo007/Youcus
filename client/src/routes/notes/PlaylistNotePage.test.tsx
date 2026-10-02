import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlaylistNotePage } from './PlaylistNotePage'

const video = (id: string, position: number, title: string, more: Record<string, unknown> = {}) => ({
  id,
  youtubeId: `yt-${id}`,
  title,
  thumbnailUrl: null,
  position,
  durationSeconds: 600,
  completed: false,
  watchedSeconds: 0,
  availability: 'AVAILABLE',
  ...more,
})

let videoNotes: { videoId: string; markers: number }[]

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/notes/playlists/p1']}>
        <Routes>
          <Route path="/notes/playlists/:id" element={<PlaylistNotePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PlaylistNotePage (YC-77)', () => {
  beforeEach(() => {
    videoNotes = [
      { videoId: 'a', markers: 2 },
      { videoId: 'c', markers: 1 },
      { videoId: 'b', markers: 0 },
    ]
    const playlist = {
      id: 'p1',
      youtubeId: 'PL1',
      title: 'fullstack',
      thumbnailUrl: null,
      videoCount: 4,
      description: null,
      contentChannel: { title: 'JavaScript Mastery', avatarUrl: null },
      multipleChannels: false,
      videos: [
        video('a', 0, 'Introduction', { completed: true }),
        video('b', 1, 'JSX et composants', { watchedSeconds: 120 }),
        video('c', 2, 'Le state'),
        video('d', 3, 'Supprimée', { availability: 'DELETED' }),
      ],
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/account/note-preferences')) return new Response(JSON.stringify({ paper: 'lignes', tint: 'creme', margin: true, timestamps: true, font: 'hanken', size: 16 }), { status: 200 })
        if (url.endsWith('/playlists/p1/video-notes')) return new Response(JSON.stringify(videoNotes), { status: 200 })
        if (url.endsWith('/playlists/p1/note')) return new Response('null', { status: 200 })
        if (url.endsWith('/playlists/p1')) return new Response(JSON.stringify(playlist), { status: 200 })
        return new Response(JSON.stringify({ error: 'x' }), { status: 404 })
      }),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('names the playlist, its videos, its length and its channel, and shows what is left', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { level: 1, name: 'Note de la playlist' })).toBeInTheDocument()
    expect(screen.getByText('fullstack · 4 vidéos · 40 min · JavaScript Mastery')).toBeInTheDocument()
    // Three playable videos, one seen.
    expect(screen.getByRole('progressbar', { name: 'Progression de fullstack' })).toHaveAttribute('aria-valuenow', '1')
    expect(screen.getByText('2 restantes')).toBeInTheDocument()
  })

  it('resumes the playlist at the video started', async () => {
    renderPage()
    expect(await screen.findByRole('link', { name: /Reprendre à la vidéo 2/ })).toHaveAttribute('href', '/playlists/p1/watch/yt-b')
  })

  it('lists each video with what its note holds and where it stands, each opening its note page', async () => {
    renderPage()
    const list = await screen.findByRole('region', { name: 'Vidéos et leurs notes' })
    const rows = await within(list).findAllByRole('link')
    expect(rows.map((r) => r.textContent)).toEqual([
      '1. Introduction2 repères✓ Vue',
      '2. JSX et composantsNote sans repère● En cours',
      '3. Le state1 repère○ À voir',
      '4. Suppriméeaucune noteIndisponible',
    ])
    expect(rows[1]).toHaveAttribute('aria-current', 'step')
    expect(rows[0]).not.toHaveAttribute('aria-current')
    expect(rows[2]).toHaveAttribute('href', '/notes/videos/c?playlist=p1')
  })

  it('the note of the playlist is the full editor, without its own header', async () => {
    renderPage()
    const toolbar = await screen.findByRole('toolbar', { name: 'Mise en forme' }, { timeout: 5000 })
    expect(toolbar).not.toHaveClass('yc-toolbar-compact')
    expect(screen.queryByRole('group', { name: 'Mode des notes' })).not.toBeInTheDocument()
    // No player: no marker can be added to a playlist note.
    expect(screen.queryByRole('button', { name: /\+ Repère/ })).not.toBeInTheDocument()
  })
})
