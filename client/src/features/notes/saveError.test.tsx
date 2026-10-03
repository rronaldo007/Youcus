import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Editor } from '@tiptap/react'
import { NodeSelection } from '@tiptap/pm/state'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NoteDoc } from './noteDoc'
import { VideoNotes } from './VideoNotes'

// A save the server did not take must show (YC-62): before, the note kept saying « Enregistré à
// 17:04 » while every save was refused, and a refusal was retried every second for nothing.

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })
let initialDoc: NoteDoc
let answers: (() => Response | Promise<Response>)[]
let puts: NoteDoc[]

const ok = () => new Response(JSON.stringify({ doc: puts[puts.length - 1], updatedAt: '2026-10-01T15:30:00Z' }), { status: 200 })
const refused = () => new Response(JSON.stringify({ error: 'Note trop longue' }), { status: 413 })
const broken = () => new Response(JSON.stringify({ error: 'Erreur interne' }), { status: 500 })
const offline = () => Promise.reject(new TypeError('Failed to fetch'))

async function ready() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <VideoNotes videoId="v1" />
    </QueryClientProvider>,
  )
  const el = await screen.findByRole('textbox', { name: 'Note de la vidéo' }, { timeout: 5000 })
  await waitFor(() => expect(el).toHaveTextContent('première'))
  return (el as unknown as { editor: Editor }).editor
}

// The editor's code (lazy, YC-40) is loaded once here, not inside the first test's budget: on a
// loaded machine its first load alone took more than the 5 s a test waits for the editor (YC-89).
beforeAll(() => import('./NoteEditor'), 30000)

/** An edit, as typing does: the autosave sends it a second later. */
const edit = (editor: Editor, text: string) => act(() => void editor.commands.insertContentAt(editor.state.doc.content.size - 1, text))

describe('a save the server did not take (YC-62)', () => {
  beforeEach(() => {
    initialDoc = { type: 'doc', content: [para('première ligne')] }
    answers = []
    puts = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'PUT') {
          puts.push((JSON.parse(init.body as string) as { doc: NoteDoc }).doc)
          return (answers.shift() ?? ok)()
        }
        return new Response(JSON.stringify({ doc: initialDoc, page: null, updatedAt: '2026-10-01T15:04:00Z' }), { status: 200 })
      }),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('a refusal says « Non enregistré » and why, never the time of an older save, and is not retried alone', async () => {
    const editor = await ready()
    answers = [refused]
    edit(editor, ' plus')
    const alert = await screen.findByRole('alert', {}, { timeout: 2500 })
    expect(alert).toHaveTextContent("Ta note n'est pas enregistrée (Note trop longue).")
    expect(alert).toHaveTextContent('Ce que tu écris reste ici tant que la page est ouverte.')
    expect(screen.getByText('Non enregistré')).toBeInTheDocument()
    expect(screen.queryByText(/Enregistré à/)).not.toBeInTheDocument()
    // The same note would be refused again: nothing is sent until the next edit (a retry would
    // leave 5 s after the error, then 1 s of autosave: 7 s covers it).
    await new Promise((r) => setTimeout(r, 7000))
    expect(puts).toHaveLength(1)
  }, 12000)

  it('the next edit sends the note again, and the alert goes once it is saved', async () => {
    const editor = await ready()
    answers = [refused]
    edit(editor, ' plus')
    await screen.findByRole('alert', {}, { timeout: 2500 })
    edit(editor, ' encore')
    await waitFor(() => expect(puts).toHaveLength(2), { timeout: 2500 })
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    expect(screen.getByText(/Enregistré à/)).toBeInTheDocument()
  })

  it('« Réessayer » sends the note at once', async () => {
    const editor = await ready()
    answers = [refused]
    edit(editor, ' plus')
    await screen.findByRole('alert', {}, { timeout: 2500 })
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    await waitFor(() => expect(puts).toHaveLength(2))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  it('a lost connection says so, and the note is sent again by itself when it comes back', async () => {
    const editor = await ready()
    answers = [offline]
    edit(editor, ' plus')
    expect(await screen.findByRole('alert', {}, { timeout: 2500 })).toHaveTextContent(
      "Ta note n'est pas enregistrée (Le serveur ne répond pas). Nouvel essai toutes les 5 secondes",
    )
    await waitFor(() => expect(puts).toHaveLength(2), { timeout: 7000 })
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  }, 12000)

  it('a server error (500) is retried too', async () => {
    const editor = await ready()
    answers = [broken]
    edit(editor, ' plus')
    expect(await screen.findByRole('alert', {}, { timeout: 2500 })).toHaveTextContent('(Erreur interne)')
    await waitFor(() => expect(puts).toHaveLength(2), { timeout: 7000 })
  }, 12000)

  it('offline, the save waits and says so, the page asks before leaving, and it goes when the network is back', async () => {
    const editor = await ready()
    act(() => onlineManager.setOnline(false))
    try {
      edit(editor, ' hors ligne')
      expect(await screen.findByText('Hors ligne · enregistrée au retour du réseau', {}, { timeout: 2500 })).toBeInTheDocument()
      expect(puts).toHaveLength(0)
      const leaving = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(leaving)
      expect(leaving.defaultPrevented).toBe(true)
    } finally {
      act(() => onlineManager.setOnline(true))
    }
    await waitFor(() => expect(puts).toHaveLength(1))
    expect(await screen.findByText(/Enregistré à/)).toBeInTheDocument()
  })

  it('leaving the page with a note not saved asks first', async () => {
    const editor = await ready()
    const quiet = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(quiet)
    expect(quiet.defaultPrevented).toBe(false)
    answers = [refused]
    edit(editor, ' plus')
    await screen.findByRole('alert', {}, { timeout: 2500 })
    const leaving = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(leaving)
    expect(leaving.defaultPrevented).toBe(true)
  })
})

describe('a note still loading (YC-89)', () => {
  let puts: unknown[]
  beforeEach(() => {
    puts = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'PUT') {
          puts.push(JSON.parse(init.body as string))
          return new Response(JSON.stringify({ doc: { type: 'doc', content: [] }, updatedAt: 'x' }), { status: 200 })
        }
        // A slow network: the editor is there long before the note.
        await new Promise((r) => setTimeout(r, 1500))
        return new Response(JSON.stringify({ doc: { type: 'doc', content: [para('première ligne')] }, page: null, updatedAt: '2026-10-01T15:04:00Z' }), { status: 200 })
      }),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('is never written while it loads, and leaving asks nothing', async () => {
    // The editor's code is already loaded, as on any page after the first one.
    await import('./NoteEditor')
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        <VideoNotes videoId="v1" />
      </QueryClientProvider>,
    )
    const el = await screen.findByRole('textbox', { name: 'Note de la vidéo' })
    // Before: the empty editor counted as an edit and its autosave wrote an empty note over the
    // stored one, a second later, while the note was still on its way.
    await new Promise((r) => setTimeout(r, 1100))
    expect(el).not.toHaveTextContent('première')
    expect(puts).toHaveLength(0)
    const leaving = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(leaving)
    expect(leaving.defaultPrevented).toBe(false)
    await waitFor(() => expect(el).toHaveTextContent('première'), { timeout: 3000 })
    await new Promise((r) => setTimeout(r, 1100))
    expect(puts).toHaveLength(0)
  })

  it('a change that lands while the next video loads is never written to it', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    const view = (videoId: string) => (
      <QueryClientProvider client={client}>
        <VideoNotes videoId={videoId} />
      </QueryClientProvider>
    )
    const { rerender } = render(view('v1'))
    const el = await screen.findByRole('textbox', { name: 'Note de la vidéo' })
    await waitFor(() => expect(el).toHaveTextContent('première'), { timeout: 3000 })
    // « Lire la suivante »: same editor, the next note is on its way; an image sent before lands now.
    rerender(view('v2'))
    const editor = (el as unknown as { editor: Editor }).editor
    act(() => void editor.commands.insertContentAt(editor.state.doc.content.size, para('image arrivée')))
    await new Promise((r) => setTimeout(r, 1100))
    expect(puts).toHaveLength(0)
  })
})

describe('the caption of an image (YC-62)', () => {
  beforeEach(() => {
    initialDoc = { type: 'doc', content: [para('première ligne'), { type: 'noteImage', attrs: { id: '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e', caption: 'Figure 1' } }] }
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ doc: initialDoc, page: null, updatedAt: 'x' }), { status: 200 })))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('wraps on a narrow screen and keeps one sentence: Entrée adds no line', async () => {
    const editor = await ready()
    act(() => {
      editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, editor.state.doc.child(0).nodeSize)))
    })
    const caption = screen.getByRole('textbox', { name: "Légende de l'image" })
    expect(caption.tagName).toBe('TEXTAREA')
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    caption.dispatchEvent(enter)
    expect(enter.defaultPrevented).toBe(true)
    // A line break pasted in becomes a space.
    fireEvent.change(caption, { target: { value: 'Figure 1\nsuite' } })
    const image = (editor.getJSON() as { content?: { type: string; attrs?: Record<string, unknown> }[] }).content?.find((n) => n.type === 'noteImage')
    expect(image?.attrs?.caption).toBe('Figure 1 suite')
  })
})
