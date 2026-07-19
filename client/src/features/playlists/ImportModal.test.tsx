import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ImportModal } from './ImportModal'

const myPlaylists = [
  { youtubeId: 'p1', title: 'Cours React', thumbnailUrl: null, videoCount: 12, alreadyImported: false },
  { youtubeId: 'p2', title: 'Déjà là', thumbnailUrl: null, videoCount: 3, alreadyImported: true },
]

function renderModal() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ImportModal />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ImportModal', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'POST') return new Response(JSON.stringify({ imported: 1 }), { status: 201 })
        return new Response(JSON.stringify(myPlaylists), { status: 200 })
      }),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('liste les playlists, désactive les déjà importées, et importe la sélection', async () => {
    renderModal()
    expect(await screen.findByText('Cours React')).toBeInTheDocument()
    expect(screen.getByText(/Déjà importée/)).toBeInTheDocument()

    // La playlist déjà importée est désactivée.
    expect(screen.getByLabelText(/Sélectionner Déjà là/i)).toBeDisabled()

    fireEvent.click(screen.getByLabelText(/Sélectionner Cours React/i))
    fireEvent.click(screen.getByRole('button', { name: /Importer la sélection/i }))

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/playlists/import-batch'),
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ playlistIds: ['p1'] }) }),
      ),
    )
  })
})
