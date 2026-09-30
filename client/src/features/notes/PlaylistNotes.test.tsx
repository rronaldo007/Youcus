import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import type { Editor } from '@tiptap/react'
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
        const body = JSON.parse(init.body as string) as { doc: unknown }
        return new Response(JSON.stringify({ doc: body.doc, updatedAt: '2026-03-03' }), { status: 200 })
      }
      const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'objectifs du parcours' }] }] }
      return new Response(JSON.stringify({ doc, updatedAt: '2026-03-03' }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('amorce et sauvegarde automatiquement la note de playlist (PUT /playlists/:id/note)', async () => {
    renderNotes()
    const el = await screen.findByRole('textbox', { name: 'Contenu de la note de la playlist' }, { timeout: 5000 })
    await waitFor(() => expect(el).toHaveTextContent('objectifs du parcours'))

    const editor = (el as unknown as { editor: Editor }).editor
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'mes prérequis' }] }] }
    editor.commands.setContent(doc, { emitUpdate: true })

    await waitFor(
      () => expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit)?.method === 'PUT')).toBe(true),
      { timeout: 2500 },
    )

    const putCall = fetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === 'PUT')
    expect(putCall?.[0]).toContain('/playlists/p1/note')
    // The editor adds `textAlign: null` to every block (YC-43); the server drops it on save.
    expect(JSON.parse((putCall?.[1] as RequestInit).body as string)).toEqual({
      doc: { type: 'doc', content: [{ type: 'paragraph', attrs: { textAlign: null }, content: [{ type: 'text', text: 'mes prérequis' }] }] },
    })
  })
})
