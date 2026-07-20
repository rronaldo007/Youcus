import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlaylistNotes } from './PlaylistNotes'

function renderNotes(playlistId = 'p1') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <PlaylistNotes playlistId={playlistId} />
    </QueryClientProvider>,
  )
}

describe('PlaylistNotes', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        const body = JSON.parse(init.body as string) as { content: string }
        return new Response(JSON.stringify({ content: body.content, updatedAt: '2026-03-03' }), { status: 200 })
      }
      return new Response(JSON.stringify({ content: 'objectifs du parcours', updatedAt: '2026-03-03' }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('amorce et sauvegarde automatiquement la note de playlist (PUT /playlists/:id/note)', async () => {
    renderNotes()
    const textarea = (await screen.findByLabelText('Contenu de la note de la playlist')) as HTMLTextAreaElement
    await waitFor(() => expect(textarea.value).toBe('objectifs du parcours'))

    fireEvent.change(textarea, { target: { value: 'mes prérequis' } })

    await waitFor(
      () => expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit)?.method === 'PUT')).toBe(true),
      { timeout: 2500 },
    )

    const putCall = fetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === 'PUT')
    expect(putCall?.[0]).toContain('/playlists/p1/note')
    expect(JSON.parse((putCall?.[1] as RequestInit).body as string)).toEqual({ content: 'mes prérequis' })
  })
})
