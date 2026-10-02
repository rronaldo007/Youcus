import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import type { Editor } from '@tiptap/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NoteDoc } from './noteDoc'
import { VideoNotes } from './VideoNotes'

let puts: { doc: NoteDoc }[]

function renderNotebook() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <VideoNotes notebook videoId="v1" fullPageTo="/notes/videos/v1?playlist=p1" player={{ seconds: 0, seek: () => {} }} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('the notebook and the note page (YC-77)', () => {
  beforeEach(() => {
    puts = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === 'PUT') {
          const body = JSON.parse(init.body as string) as { doc: NoteDoc }
          puts.push(body)
          return new Response(JSON.stringify({ ...body, page: null, updatedAt: '2026-10-02T20:00:00Z' }), { status: 200 })
        }
        if (url.endsWith('/account/note-preferences')) return new Response(JSON.stringify({ paper: 'lignes', tint: 'creme', margin: true, timestamps: true, font: 'hanken', size: 16 }), { status: 200 })
        const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'bonjour' }] }] }
        return new Response(JSON.stringify({ doc, page: null, updatedAt: '2026-10-02T19:00:00Z' }), { status: 200 })
      }),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('« Pleine page » in the notebook leads to the note page of the video', async () => {
    renderNotebook()
    expect(await screen.findByRole('link', { name: 'Pleine page' })).toHaveAttribute('href', '/notes/videos/v1?playlist=p1')
  })

  it('leaving within the second sends what was typed, instead of losing it with the timer', async () => {
    const { unmount } = renderNotebook()
    const el = await screen.findByRole('textbox', { name: 'Note de la vidéo' }, { timeout: 5000 })
    await waitFor(() => expect(el).toHaveTextContent('bonjour'))
    const editor = (el as unknown as { editor: Editor }).editor
    act(() => {
      editor.commands.insertContent(' et au revoir')
    })
    // « Pleine page » clicked at once: the page goes before the 1 s autosave.
    unmount()
    await waitFor(() => expect(puts).toHaveLength(1))
    expect(JSON.stringify(puts[0].doc)).toContain('bonjour et au revoir')
  })

  it('a note merely opened then left is not saved again', async () => {
    const { unmount } = renderNotebook()
    const el = await screen.findByRole('textbox', { name: 'Note de la vidéo' }, { timeout: 5000 })
    await waitFor(() => expect(el).toHaveTextContent('bonjour'))
    unmount()
    await new Promise((r) => setTimeout(r, 50))
    expect(puts).toHaveLength(0)
  })
})
