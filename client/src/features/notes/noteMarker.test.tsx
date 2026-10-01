import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Editor } from '@tiptap/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NoteDoc, NoteNode } from './noteDoc'
import { PlaylistNotes } from './PlaylistNotes'
import { VideoNotes } from './VideoNotes'

const para = (text: string, marker?: number) => ({
  type: 'paragraph',
  ...(marker === undefined ? {} : { attrs: { marker } }),
  content: [{ type: 'text', text }],
})
let initialDoc: NoteDoc
let storedPage: unknown
let puts: { doc: NoteDoc; page?: Record<string, unknown> }[]
const seek = vi.fn()

function renderNotes(seconds = 245) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <VideoNotes videoId="v1" player={{ seconds, seek }} />
    </QueryClientProvider>,
  )
}

/** The note loaded, the cursor at the end of its first line. */
async function readyEditor(seconds?: number) {
  renderNotes(seconds)
  const el = await screen.findByRole('textbox', { name: 'Note de la vidéo' }, { timeout: 5000 })
  await waitFor(() => expect(el).toHaveTextContent('première'))
  const editor = (el as unknown as { editor: Editor }).editor
  act(() => {
    editor.commands.setTextSelection(1 + 'première ligne'.length)
  })
  return { el, editor, toolbar: screen.getByRole('toolbar', { name: 'Mise en forme' }) }
}

const markers = (doc: { content?: NoteNode[] }) => (doc.content ?? []).map((n) => (n.attrs?.marker as number | undefined) ?? null)
const lastPut = () => puts[puts.length - 1]

describe('timestamped markers (YC-56)', () => {
  beforeEach(() => {
    initialDoc = { type: 'doc', content: [para('première ligne'), para('seconde ligne')] }
    storedPage = null
    puts = []
    seek.mockReset()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'PUT') {
          const body = JSON.parse(init.body as string) as { doc: NoteDoc; page?: Record<string, unknown> }
          puts.push(body)
          return new Response(JSON.stringify({ ...body, updatedAt: '2026-10-01T10:00:00Z' }), { status: 200 })
        }
        return new Response(JSON.stringify({ doc: initialDoc, page: storedPage, updatedAt: '2026-10-01T10:00:00Z' }), { status: 200 })
      }),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('« + Repère » timestamps the line of the cursor at the player position, and saves it', async () => {
    const { editor } = await readyEditor(245)
    fireEvent.click(screen.getByRole('button', { name: '+ Repère à 04:05' }))
    expect(markers(editor.getJSON())).toEqual([245, null])
    expect(screen.getByRole('button', { name: 'Aller à 04:05 dans la vidéo' })).toBeInTheDocument()
    await waitFor(() => expect(puts.length).toBeGreaterThan(0), { timeout: 3000 })
    expect(markers(lastPut().doc)).toEqual([245, null])
  })

  it('stores a whole second: the player gives fractions, the server takes integers', async () => {
    const { editor } = await readyEditor(245.73)
    fireEvent.click(screen.getByRole('button', { name: '+ Repère à 04:05' }))
    expect(markers(editor.getJSON())).toEqual([245, null])
  })

  it('adds nothing in Aperçu, where the note is read, not written', async () => {
    const { editor } = await readyEditor(245)
    fireEvent.click(screen.getByRole('button', { name: 'Aperçu' }))
    fireEvent.keyDown(document.body, { key: 'm' })
    expect(markers(editor.getJSON())).toEqual([null, null])
    expect(screen.queryByRole('button', { name: /^\+ Repère à/ })).not.toBeInTheDocument()
  })

  it('a note just opened takes a marker on its last line, before any click', async () => {
    renderNotes(245)
    const el = await screen.findByRole('textbox', { name: 'Note de la vidéo' }, { timeout: 5000 })
    await waitFor(() => expect(el).toHaveTextContent('seconde'))
    const editor = (el as unknown as { editor: Editor }).editor
    expect(screen.getByRole('button', { name: '+ Repère à 04:05' })).toBeEnabled()
    fireEvent.keyDown(document.body, { key: 'm' })
    expect(markers(editor.getJSON())).toEqual([null, 245])
  })

  it('replaces the marker of a line that already has one', async () => {
    initialDoc = { type: 'doc', content: [para('première ligne', 10), para('seconde ligne')] }
    const { editor } = await readyEditor(90)
    fireEvent.click(screen.getByRole('button', { name: '+ Repère à 01:30' }))
    expect(markers(editor.getJSON())).toEqual([90, null])
  })

  it('a click on a pill jumps the video to its second, without touching the note', async () => {
    initialDoc = { type: 'doc', content: [para('première ligne'), para('seconde ligne', 3725)] }
    const { editor } = await readyEditor()
    const before = JSON.stringify(editor.getJSON())
    fireEvent.click(screen.getByRole('button', { name: 'Aller à 1:02:05 dans la vidéo' }))
    expect(seek).toHaveBeenCalledWith(3725)
    expect(JSON.stringify(editor.getJSON())).toBe(before)
  })

  it('the pill is not text: the line reads the same with or without it', async () => {
    initialDoc = { type: 'doc', content: [para('première ligne', 245)] }
    const { editor } = await readyEditor()
    expect(editor.getText()).toBe('première ligne')
  })

  it('M outside the text adds a marker; in the text it stays a letter', async () => {
    const { el, editor } = await readyEditor(245)
    fireEvent.keyDown(el, { key: 'm' })
    expect(markers(editor.getJSON())).toEqual([null, null])
    fireEvent.keyDown(document.body, { key: 'm' })
    expect(markers(editor.getJSON())).toEqual([245, null])
  })

  it('M with a modifier, or held down, adds nothing', async () => {
    const { editor } = await readyEditor(245)
    fireEvent.keyDown(document.body, { key: 'm', ctrlKey: true })
    fireEvent.keyDown(document.body, { key: 'm', repeat: true })
    expect(markers(editor.getJSON())).toEqual([null, null])
  })

  it('Ctrl+Alt+M adds a marker from inside the text', async () => {
    const { el, editor } = await readyEditor(61)
    fireEvent.keyDown(el, { key: 'm', ctrlKey: true, altKey: true })
    expect(markers(editor.getJSON())).toEqual([61, null])
  })

  it('Enter at the end of a timestamped line starts a line without marker', async () => {
    initialDoc = { type: 'doc', content: [para('première ligne', 245)] }
    const { editor } = await readyEditor()
    act(() => {
      editor.commands.splitBlock()
    })
    expect(markers(editor.getJSON())).toEqual([245, null])
  })

  it('Backspace at the start of a timestamped line removes its marker, and keeps the text', async () => {
    initialDoc = { type: 'doc', content: [para('première ligne'), para('seconde ligne', 245)] }
    const { el, editor } = await readyEditor()
    const start = editor.state.doc.child(0).nodeSize + 1
    act(() => {
      editor.commands.setTextSelection(start)
    })
    fireEvent.keyDown(el, { key: 'Backspace' })
    expect(markers(editor.getJSON())).toEqual([null, null])
    expect(editor.getText()).toContain('seconde ligne')
  })

  it('no marker inside a code block: the tool and the button are disabled', async () => {
    const { editor, toolbar } = await readyEditor()
    act(() => {
      editor.commands.toggleCodeBlock()
    })
    await waitFor(() => expect(within(toolbar).getByRole('button', { name: 'Ajouter un repère (M)' })).toHaveAttribute('aria-disabled', 'true'))
    expect(screen.getByRole('button', { name: /^\+ Repère à/ })).toBeDisabled()
    fireEvent.keyDown(document.body, { key: 'm' })
    expect(markers(editor.getJSON())).toEqual([null, null])
  })

  it('« Horodatages » hides the pills, keeps the markers and saves the choice with the page', async () => {
    initialDoc = { type: 'doc', content: [para('première ligne', 245)] }
    const { el, toolbar } = await readyEditor()
    const page = el.closest('.yc-note-page') as HTMLElement
    expect(page.dataset.timestamps).toBe('true')
    fireEvent.click(within(toolbar).getByRole('button', { name: 'Horodatages' }))
    expect(page.dataset.timestamps).toBe('false')
    expect(within(toolbar).getByRole('button', { name: 'Horodatages' })).toHaveAttribute('aria-pressed', 'false')
    await waitFor(() => expect(puts.length).toBeGreaterThan(0), { timeout: 3000 })
    expect(lastPut().page).toMatchObject({ timestamps: false })
    expect(markers(lastPut().doc)).toEqual([245])
  })

  it('a page saved before YC-56 shows its markers', async () => {
    storedPage = { paper: 'seyes', tint: 'sepia', margin: false }
    const { el } = await readyEditor()
    expect((el.closest('.yc-note-page') as HTMLElement).dataset.timestamps).toBe('true')
  })

  it('says « Dans la marge » only when the margin column is shown', async () => {
    await readyEditor()
    expect(screen.getByText('Dans la marge · touche M')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Colonne de marge' }))
    expect(screen.queryByText('Dans la marge · touche M')).not.toBeInTheDocument()
  })

  it('a playlist note, without a player, offers no marker', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <PlaylistNotes playlistId="p1" />
      </QueryClientProvider>,
    )
    const toolbar = await screen.findByRole('toolbar', { name: 'Mise en forme' }, { timeout: 5000 })
    expect(within(toolbar).queryByRole('button', { name: 'Ajouter un repère (M)' })).not.toBeInTheDocument()
    expect(within(toolbar).queryByRole('button', { name: 'Horodatages' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^\+ Repère à/ })).not.toBeInTheDocument()
    fireEvent.click(within(toolbar).getByRole('button', { name: /^Fond/ }))
    expect(await screen.findByRole('menuitemcheckbox', { name: /Colonne de marge/ })).toBeInTheDocument()
    expect(screen.queryByRole('menuitemcheckbox', { name: 'Horodatages dans la marge' })).not.toBeInTheDocument()
  })
})
