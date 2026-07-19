import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MergePlaylistsModal } from './MergePlaylistsModal'
import type { Playlist } from '@/types'

const sources: Playlist[] = [
  { id: 'a', youtubeId: 'PLa', title: 'A', thumbnailUrl: null, videoCount: 3 },
  { id: 'b', youtubeId: 'PLb', title: 'B', thumbnailUrl: null, videoCount: 4 },
]

function renderModal() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <MergePlaylistsModal sources={sources} onClose={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('MergePlaylistsModal', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ id: 'merged', youtubeId: 'merge:x', title: 'Ma fusion', thumbnailUrl: null, videoCount: 6 }), {
          status: 201,
        }),
      ),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('envoie /playlists/merge avec les sourceIds et le nom saisi', async () => {
    renderModal()
    fireEvent.change(screen.getByLabelText(/Nom de la playlist fusionnée/i), {
      target: { value: 'Ma fusion' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^Fusionner$/i }))

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/playlists/merge'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ sourceIds: ['a', 'b'], title: 'Ma fusion' }),
        }),
      ),
    )
  })
})
