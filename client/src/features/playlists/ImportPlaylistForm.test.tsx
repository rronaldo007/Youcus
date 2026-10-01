import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ImportPlaylistForm } from './ImportPlaylistForm'

function renderForm() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ImportPlaylistForm />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function submit(value: string) {
  fireEvent.change(screen.getByLabelText(/playlist ou d'une vidéo YouTube/i), { target: { value } })
  fireEvent.click(screen.getByRole('button', { name: /Importer/i }))
}

describe('ImportPlaylistForm', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('/library/videos')
          ? new Response(
              JSON.stringify({ id: 'v1', youtubeId: 'dQw4w9WgXcQ', title: 'Comprendre useEffect', thumbnailUrl: null }),
              { status: 201 },
            )
          : new Response(JSON.stringify({ id: 'p1', youtubeId: 'PL1', title: 'Ma playlist', thumbnailUrl: null, videoCount: 3 }), {
              status: 201,
            }),
      ),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('envoie /playlists/import avec l\'URL saisie et affiche le succès', async () => {
    renderForm()
    submit('https://youtube.com/playlist?list=PL1')

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

  it('keeps a video link on its own in the library, and offers to watch it (YC-61)', async () => {
    renderForm()
    submit('https://youtu.be/dQw4w9WgXcQ')

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/library/videos'),
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ url: 'https://youtu.be/dQw4w9WgXcQ' }) }),
      ),
    )
    expect(await screen.findByText(/ajoutée à ta bibliothèque/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'La regarder' })).toHaveAttribute('href', '/videos/dQw4w9WgXcQ')
    expect(fetch).not.toHaveBeenCalledWith(expect.stringContaining('/playlists/import'), expect.anything())
  })

  it('a video shared inside a playlist imports the playlist', async () => {
    renderForm()
    submit('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL1')
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/playlists/import'), expect.anything()))
    expect(fetch).not.toHaveBeenCalledWith(expect.stringContaining('/library/videos'), expect.anything())
  })
})
