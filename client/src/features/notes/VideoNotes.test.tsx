import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Editor } from '@tiptap/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NoteDoc } from './noteDoc'
import { VideoNotes } from './VideoNotes'

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })
let initialDoc: NoteDoc

function renderNotes(videoId = 'v1') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <VideoNotes videoId={videoId} />
    </QueryClientProvider>,
  )
}

/** The editable area, and the TipTap editor behind it: edits go through the real editor. */
async function editorArea() {
  // The editor is lazy-loaded (LazyNoteEditor): the first import is slow on a cold start.
  const el = await screen.findByRole('textbox', { name: 'Note de la vidéo' }, { timeout: 5000 })
  return { el, editor: (el as unknown as { editor: Editor }).editor }
}

describe('VideoNotes (YC-40, rich editor)', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    initialDoc = { type: 'doc', content: [para('note initiale')] }
    fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        const body = JSON.parse(init.body as string) as { doc: NoteDoc }
        return new Response(JSON.stringify({ doc: body.doc, updatedAt: '2026-03-03T10:00:00Z' }), { status: 200 })
      }
      return new Response(JSON.stringify({ doc: initialDoc, updatedAt: '2026-03-03T10:00:00Z' }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('seeds the editor with the stored document', async () => {
    renderNotes()
    const { el } = await editorArea()
    await waitFor(() => expect(el).toHaveTextContent('note initiale'))
  })

  it('never saves when a note is only opened (no write on read)', async () => {
    renderNotes()
    const { el } = await editorArea()
    await waitFor(() => expect(el).toHaveTextContent('note initiale'))
    await new Promise((r) => setTimeout(r, 1500))
    expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit)?.method === 'PUT')).toBe(false)
    expect(screen.queryByText('Modifié')).not.toBeInTheDocument()
  })

  it('saves the document (PUT { doc }) one second after an edit', async () => {
    renderNotes()
    const { el, editor } = await editorArea()
    await waitFor(() => expect(el).toHaveTextContent('note initiale'))

    editor.commands.setContent({ type: 'doc', content: [{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Mon titre' }] }] }, { emitUpdate: true })
    expect(await screen.findByText('Modifié')).toBeInTheDocument()

    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit)?.method === 'PUT')).toBe(true), {
      timeout: 2500,
    })
    const putCall = fetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === 'PUT')
    expect(putCall?.[0]).toContain('/videos/v1/note')
    const body = JSON.parse((putCall?.[1] as RequestInit).body as string)
    // TipTap keeps an empty paragraph after a final heading so the user can keep writing.
    expect(body).toEqual({
      doc: {
        type: 'doc',
        // `textAlign: null` comes from the editor (YC-43); the server drops it on save.
        content: [
          { type: 'heading', attrs: { level: 1, textAlign: null }, content: [{ type: 'text', text: 'Mon titre' }] },
          { type: 'paragraph', attrs: { textAlign: null } },
        ],
      },
    })
  })

  it('renders headings, lists and marks from the document', async () => {
    initialDoc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Titre' }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [para('premier')] }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'gras', marks: [{ type: 'bold' }] }] },
      ],
    }
    renderNotes()
    expect(await screen.findByRole('heading', { name: 'Titre' }, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByRole('listitem')).toHaveTextContent('premier')
    expect(screen.getByText('gras').tagName).toBe('STRONG')
  })

  it('makes the note read-only in « Aperçu »', async () => {
    renderNotes()
    const { el } = await editorArea()
    await waitFor(() => expect(el).toHaveAttribute('contenteditable', 'true'))
    fireEvent.click(screen.getByRole('button', { name: 'Aperçu' }))
    await waitFor(() => expect(el).toHaveAttribute('contenteditable', 'false'))
  })

  it('never renders a javascript: link, even if the document carried one', async () => {
    initialDoc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'clique', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }],
    }
    const { container } = renderNotes()
    expect(await screen.findByText('clique', undefined, { timeout: 5000 })).toBeInTheDocument()
    expect(container.querySelector('a[href^="javascript:"]')).toBeNull()
  })
})
