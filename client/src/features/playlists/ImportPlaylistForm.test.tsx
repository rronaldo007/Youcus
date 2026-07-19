import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ImportPlaylistForm } from './ImportPlaylistForm'

function renderForm() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ImportPlaylistForm />
    </QueryClientProvider>,
  )
}

describe('ImportPlaylistForm', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ id: 'p1', youtubeId: 'PL1', title: 'Ma playlist', thumbnailUrl: null, videoCount: 3 }), {
          status: 201,
        }),
      ),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('envoie /playlists/import avec l\'URL saisie et affiche le succès', async () => {
    renderForm()
    fireEvent.change(screen.getByLabelText(/playlist YouTube/i), {
      target: { value: 'https://youtube.com/playlist?list=PL1' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Importer/i }))

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/playlists/import'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ url: 'https://youtube.com/playlist?list=PL1' }),
        }),
      ),
    )
    expect(await screen.findByText(/importée \(3 vidéos\)/i)).toBeInTheDocument()
  })
})
