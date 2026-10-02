import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ResumeItem, User } from '@/types'
import { Dashboard } from './Dashboard'

/** YC-74: the dashboard of the new design, on the API's real shapes. */
const user = { id: 'u1', displayName: 'Ronaldo Rukundo', email: 'r@example.com', avatarUrl: null } as unknown as User
const evening = new Date(2026, 8, 29, 21, 0)

let playlists: unknown[]
let resume: ResumeItem | null

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Dashboard user={user} now={evening} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Dashboard (YC-74)', () => {
  beforeEach(() => {
    playlists = [
      { id: 'p1', youtubeId: 'y1', title: 'fullstack', thumbnailUrl: null, videoCount: 17, availableCount: 17, completedCount: 3 },
      { id: 'p2', youtubeId: 'y2', title: 'architecture', thumbnailUrl: null, videoCount: 4, availableCount: 4, completedCount: 0 },
    ]
    resume = {
      youtubeId: 'abcdefghijk', title: 'useEffect en profondeur', thumbnailUrl: null, durationSeconds: 845, watchedSeconds: 245,
      playlist: { id: 'p1', title: 'fullstack', position: 4, total: 17 },
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/resume')) return new Response(JSON.stringify(resume), { status: 200 })
        if (url.includes('/library/videos')) return new Response('[]', { status: 200 })
        return new Response(JSON.stringify(playlists), { status: 200 })
      }),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('greets by first name and says how many videos are left', async () => {
    renderDashboard()
    // 17 − 3 in fullstack, 4 in architecture.
    expect(await screen.findByText(/18 vidéos à voir/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Bonsoir Ronaldo. On reprend ?')
  })

  it('offers to resume the last video at its saved position, in its playlist', async () => {
    renderDashboard()
    const banner = await screen.findByRole('region', { name: 'Reprendre' })
    expect(banner).toHaveTextContent('vidéo 4 sur 17')
    expect(banner).toHaveTextContent('10 min pour finir la vidéo')
    expect(within(banner).getByRole('link', { name: 'Reprendre à 04:05' })).toHaveAttribute('href', '/playlists/p1/watch/abcdefghijk')
  })

  it('opens a video kept on its own on its own page', async () => {
    resume = { ...(resume as ResumeItem), playlist: null }
    renderDashboard()
    const banner = await screen.findByRole('region', { name: 'Reprendre' })
    expect(banner).toHaveTextContent('vidéo seule')
    expect(within(banner).getByRole('link')).toHaveAttribute('href', '/videos/abcdefghijk')
  })

  it('shows no banner when nothing is started', async () => {
    resume = null
    renderDashboard()
    await screen.findByText('fullstack')
    expect(screen.queryByRole('region', { name: 'Reprendre' })).not.toBeInTheDocument()
  })

  it('offers « Fusionner » only with two playlists or more', async () => {
    renderDashboard()
    expect(await screen.findByRole('button', { name: 'Fusionner' })).toBeInTheDocument()
  })

  it('hides « Fusionner » with a single playlist', async () => {
    playlists = playlists.slice(0, 1)
    renderDashboard()
    await screen.findByText('fullstack')
    expect(screen.queryByRole('button', { name: 'Fusionner' })).not.toBeInTheDocument()
  })

  it('starts empty with an invitation to import, the catalogue greyed until it exists', async () => {
    playlists = []
    resume = null
    renderDashboard()
    expect(await screen.findByRole('heading', { level: 2, name: 'Rien ici pour l’instant' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('On commence ?')
    expect(screen.getByText(/Aucune playlist encore/)).toBeInTheDocument()
    expect(screen.getByText(/Voir le catalogue/)).toHaveAttribute('aria-disabled', 'true')
    expect(screen.queryByRole('link', { name: /Voir le catalogue/ })).not.toBeInTheDocument()
  })
})
