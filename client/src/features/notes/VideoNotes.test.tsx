import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VideoNotes } from './VideoNotes'

function renderNotes(videoId = 'v1') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <VideoNotes videoId={videoId} />
    </QueryClientProvider>,
  )
}

describe('VideoNotes', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        const body = JSON.parse(init.body as string) as { content: string }
        return new Response(JSON.stringify({ content: body.content, updatedAt: '2026-03-03' }), { status: 200 })
      }
      // GET : note existante
      return new Response(JSON.stringify({ content: 'note initiale', updatedAt: '2026-03-03' }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('amorce le brouillon avec la note existante', async () => {
    renderNotes()
    const textarea = (await screen.findByLabelText('Note de la vidéo')) as HTMLTextAreaElement
    await waitFor(() => expect(textarea.value).toBe('note initiale'))
  })

  it('sauvegarde automatiquement (PUT) après édition', async () => {
    renderNotes()
    const textarea = (await screen.findByLabelText('Note de la vidéo')) as HTMLTextAreaElement
    await waitFor(() => expect(textarea.value).toBe('note initiale'))

    fireEvent.change(textarea, { target: { value: '# Mon titre' } })
    expect(screen.getByText('Modifié')).toBeInTheDocument()

    await waitFor(
      () => expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit)?.method === 'PUT')).toBe(true),
      { timeout: 2500 },
    )

    const putCall = fetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === 'PUT')
    expect(putCall?.[0]).toContain('/videos/v1/note')
    expect(JSON.parse((putCall?.[1] as RequestInit).body as string)).toEqual({ content: '# Mon titre' })
  })
})
