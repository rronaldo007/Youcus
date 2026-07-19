import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlaylistLibrary } from './PlaylistLibrary'

const playlists = [
  { id: 'p1', youtubeId: 'y1', title: 'Cours React', thumbnailUrl: null, videoCount: 12 },
]

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

describe('PlaylistLibrary', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'DELETE') return new Response(JSON.stringify({ ok: true }), { status: 200 })
        return new Response(JSON.stringify(playlists), { status: 200 })
      }),
    )
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('affiche les playlists avec leur nombre de vidéos', async () => {
    renderLibrary()
    expect(await screen.findByText('Cours React')).toBeInTheDocument()
    expect(screen.getByText(/12 vidéos/)).toBeInTheDocument()
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
})
