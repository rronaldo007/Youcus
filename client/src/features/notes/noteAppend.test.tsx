import { createRef, type MutableRefObject } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import type { Editor } from '@tiptap/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NoteDoc, NoteNode } from './noteDoc'
import type { NoteActions } from './NoteEditor'
import { VideoNotes } from './VideoNotes'

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })
let initialDoc: NoteDoc
let puts: { doc: NoteDoc }[]
let failNext: boolean

function renderNotes() {
  const actions = createRef<NoteActions | null>() as MutableRefObject<NoteActions | null>
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <VideoNotes videoId="v1" player={{ seconds: 0, seek: vi.fn() }} actions={actions} />
    </QueryClientProvider>,
  )
  return actions
}

async function ready() {
  const actions = renderNotes()
  const el = await screen.findByRole('textbox', { name: 'Note de la vidéo' }, { timeout: 5000 })
  await waitFor(() => expect(el).toHaveTextContent('première'))
  return { actions, editor: (el as unknown as { editor: Editor }).editor }
}

const lines = (doc: { content?: NoteNode[] }) =>
  (doc.content ?? []).map((n) => [n.content?.map((c) => c.text).join('') ?? '', (n.attrs?.marker as number | undefined) ?? null])

describe('a sentence from the end card (YC-60)', () => {
  beforeEach(() => {
    initialDoc = { type: 'doc', content: [para('première ligne')] }
    puts = []
    failNext = false
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'PUT') {
          const body = JSON.parse(init.body as string) as { doc: NoteDoc }
          puts.push(body)
          if (failNext) {
            failNext = false
            return new Response(JSON.stringify({ error: 'down' }), { status: 500 })
          }
          return new Response(JSON.stringify({ ...body, updatedAt: '2026-10-01T10:00:00Z' }), { status: 200 })
        }
        return new Response(JSON.stringify({ doc: initialDoc, page: null, updatedAt: '2026-10-01T10:00:00Z' }), { status: 200 })
      }),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('becomes the last line, timestamped at the end of the video, saved at once', async () => {
    const { actions, editor } = await ready()
    const onSuccess = vi.fn()
    let sent = false
    act(() => {
      sent = actions.current?.appendMarkedLine('Un effet après le rendu', 872, { onSuccess }) ?? false
    })
    expect(sent).toBe(true)
    expect(lines(editor.getJSON())).toEqual([
      ['première ligne', null],
      ['Un effet après le rendu', 872],
    ])
    // Not the autosave a second later: at once, so a change of video cannot lose it.
    await waitFor(() => expect(puts).toHaveLength(1), { timeout: 500 })
    expect(lines(puts[0].doc)).toEqual([
      ['première ligne', null],
      ['Un effet après le rendu', 872],
    ])
    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
    // Once: the autosave does not send it a second time.
    await new Promise((r) => setTimeout(r, 1300))
    expect(puts).toHaveLength(1)
  })

  it('takes the empty last line rather than leaving a blank one', async () => {
    initialDoc = { type: 'doc', content: [para('première ligne'), { type: 'paragraph' }] }
    const { actions, editor } = await ready()
    act(() => {
      actions.current?.appendMarkedLine('Retenu', 60, {})
    })
    expect(lines(editor.getJSON())).toEqual([
      ['première ligne', null],
      ['Retenu', 60],
    ])
  })

  it('a refused save is told, and the autosave sends it again', async () => {
    const { actions } = await ready()
    failNext = true
    const onError = vi.fn()
    act(() => {
      actions.current?.appendMarkedLine('Retenu', 60, { onError })
    })
    await waitFor(() => expect(onError).toHaveBeenCalled())
    await waitFor(() => expect(puts).toHaveLength(2), { timeout: 2500 })
    expect(lines(puts[1].doc)).toEqual([
      ['première ligne', null],
      ['Retenu', 60],
    ])
  })

  it('is refused while the note is not loaded', async () => {
    let release: () => void = () => {}
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            release = () => resolve(new Response(JSON.stringify({ doc: initialDoc, page: null, updatedAt: '2026-10-01T10:00:00Z' })))
          }),
      ),
    )
    const actions = renderNotes()
    await screen.findByRole('textbox', { name: 'Note de la vidéo' }, { timeout: 5000 })
    expect(actions.current?.appendMarkedLine('Trop tôt', 60, {}) ?? false).toBe(false)
    release()
  })
})
