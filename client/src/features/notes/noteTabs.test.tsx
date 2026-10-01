import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Editor } from '@tiptap/react'
import { TextSelection } from '@tiptap/pm/state'
import { Packer } from 'docx'
import JSZip from 'jszip'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NoteDoc, NoteNode } from './noteDoc'
import { DEFAULT_PAGE } from './notePage'
import { buildNoteDocument } from './noteToDocx'
import { VideoNotes } from './VideoNotes'

// Tabs in a note (YC-52), through the real editor, Figma « Bloc de note › Onglets » 65:2126.

const para = (text: string): NoteNode => ({ type: 'paragraph', content: text ? [{ type: 'text', text }] : undefined })
const tab = (title: string, text: string): NoteNode => ({ type: 'noteTab', attrs: { title }, content: [para(text)] })
const tabs = (...content: NoteNode[]): NoteNode => ({ type: 'noteTabs', content })
let initialDoc: NoteDoc
let puts: NoteDoc[]

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

/** The tabs of the note: their titles, and the text of each. */
const read = (editor: Editor) => {
  const block = (editor.getJSON() as { content?: NoteNode[] }).content?.find((n) => n.type === 'noteTabs')
  return (block?.content ?? []).map((t) => `${t.attrs?.title}: ${(t.content ?? []).map((p) => (p.content ?? []).map((x) => x.text).join('')).join(' ')}`)
}
const tabButtons = () => screen.getAllByRole('tab')
const shownTitle = () => tabButtons().find((b) => b.getAttribute('aria-selected') === 'true')?.textContent

function cursorIn(editor: Editor, text: string) {
  let at = -1
  editor.state.doc.descendants((node, pos) => {
    if (at < 0 && node.isText && node.text === text) at = pos
    return at < 0
  })
  act(() => {
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, at + 1)))
  })
}

describe('tabs in a note (YC-52)', () => {
  beforeEach(() => {
    initialDoc = { type: 'doc', content: [para('première ligne')] }
    puts = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'PUT') {
          const doc = (JSON.parse(init.body as string) as { doc: NoteDoc }).doc
          puts.push(doc)
          return new Response(JSON.stringify({ doc, updatedAt: '2026-10-01T16:00:00Z' }), { status: 200 })
        }
        return new Response(JSON.stringify({ doc: initialDoc, page: null, updatedAt: '2026-10-01T16:00:00Z' }), { status: 200 })
      }),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('« Insérer des onglets » puts Théorie, Exemple, Exercices, the first in front with the cursor', async () => {
    const editor = await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Insérer des onglets' }))
    expect(read(editor)).toEqual(['Théorie: ', 'Exemple: ', 'Exercices: '])
    // The block's view draws right after the transaction.
    await screen.findByRole('tablist')
    expect(tabButtons().map((b) => b.textContent)).toEqual(['Théorie', 'Exemple', 'Exercices'])
    expect(shownTitle()).toBe('Théorie')
    expect(editor.state.selection.$from.node(editor.state.selection.$from.depth - 1).attrs.title).toBe('Théorie')
    // No tabs in tabs.
    expect(screen.getByRole('button', { name: 'Insérer des onglets' })).toHaveAttribute('aria-disabled', 'true')
    await waitFor(() => expect(puts.length).toBeGreaterThan(0), { timeout: 2500 })
    expect(puts[puts.length - 1].content.some((n) => n.type === 'noteTabs')).toBe(true)
  })

  it('a note opens on the tab of its cursor: the last one, where writing goes on', async () => {
    initialDoc = { type: 'doc', content: [para('première ligne'), tabs(tab('Théorie', 'Un effet'), tab('Exemple', 'Le code'))] }
    await ready()
    await waitFor(() => expect(shownTitle()).toBe('Exemple'))
  })

  it('a click on a tab brings it in front, the cursor in it; nothing is saved for that', async () => {
    initialDoc = { type: 'doc', content: [para('première ligne'), tabs(tab('Théorie', 'Un effet'), tab('Exemple', 'useEffect(() => {})'))] }
    const editor = await ready()
    fireEvent.click(screen.getByRole('tab', { name: 'Théorie' }))
    expect(shownTitle()).toBe('Théorie')
    expect(editor.state.selection.$from.parent.textContent).toBe('Un effet')
    await new Promise((r) => setTimeout(r, 1300))
    expect(puts).toHaveLength(0)
  })

  it('the tab holding the cursor comes in front (arrow keys never write in a hidden tab)', async () => {
    initialDoc = { type: 'doc', content: [para('première ligne'), tabs(tab('Théorie', 'Un effet'), tab('Exemple', 'Le code'))] }
    const editor = await ready()
    cursorIn(editor, 'Un effet')
    await waitFor(() => expect(shownTitle()).toBe('Théorie'))
    cursorIn(editor, 'Le code')
    await waitFor(() => expect(shownTitle()).toBe('Exemple'))
  })

  it('← → in the bar change the tab and take the cursor with them', async () => {
    initialDoc = { type: 'doc', content: [para('première ligne'), tabs(tab('Théorie', 'Un effet'), tab('Exemple', 'Le code'))] }
    const editor = await ready()
    // From the last tab, → wraps to the first.
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' })
    expect(shownTitle()).toBe('Théorie')
    expect(editor.state.selection.$from.parent.textContent).toBe('Un effet')
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' })
    expect(shownTitle()).toBe('Exemple')
    expect(editor.state.selection.$from.parent.textContent).toBe('Le code')
  })

  it('« + » adds a tab, in front, its name ready to be typed', async () => {
    initialDoc = { type: 'doc', content: [para('première ligne'), tabs(tab('Théorie', 'Un effet'))] }
    const editor = await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un onglet' }))
    const name = await screen.findByRole('textbox', { name: "Nom de l'onglet" })
    // The field is on the NEW tab, never on the one that was in front.
    expect(screen.getByRole('tab', { name: 'Théorie' })).toBeInTheDocument()
    expect(name).toHaveValue('Onglet 2')
    fireEvent.change(name, { target: { value: 'Exercices' } })
    fireEvent.keyDown(name, { key: 'Enter' })
    expect(read(editor)).toEqual(['Théorie: Un effet', 'Exercices: '])
    await waitFor(() => expect(shownTitle()).toBe('Exercices'))
    // Named: the writing goes on in the new tab.
    expect(editor.view.hasFocus()).toBe(true)
    expect(editor.state.selection.$from.node(editor.state.selection.$from.depth - 1).attrs.title).toBe('Exercices')
  })

  it('a click on the tab in front renames it, moves it, deletes it; an empty name changes nothing', async () => {
    initialDoc = { type: 'doc', content: [para('première ligne'), tabs(tab('Théorie', 'A'), tab('Exemple', 'B'), tab('Exercices', 'C'))] }
    const editor = await ready()
    fireEvent.click(screen.getByRole('tab', { name: 'Exemple' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Exemple' }))
    const name = screen.getByRole('textbox', { name: "Nom de l'onglet" })
    fireEvent.change(name, { target: { value: '   ' } })
    fireEvent.keyDown(name, { key: 'Enter' })
    expect(read(editor)[1]).toBe('Exemple: B')

    fireEvent.click(screen.getByRole('tab', { name: 'Exemple' }))
    fireEvent.click(screen.getByRole('button', { name: "Déplacer l'onglet à gauche" }))
    expect(read(editor)).toEqual(['Exemple: B', 'Théorie: A', 'Exercices: C'])
    await waitFor(() => expect(shownTitle()).toBe('Exemple'))

    fireEvent.click(screen.getByRole('tab', { name: 'Exemple' }))
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    expect(read(editor)).toEqual(['Théorie: A', 'Exercices: C'])
    // Undo brings it back, its page with it. (Steps closer than 500 ms make one undo in
    // ProseMirror's history: the order may come back too.)
    act(() => void editor.commands.undo())
    expect(read(editor)).toHaveLength(3)
    expect(read(editor)).toContain('Exemple: B')
  })

  it('deleting the last tab removes the block', async () => {
    initialDoc = { type: 'doc', content: [para('première ligne'), tabs(tab('Seul', 'x'))] }
    const editor = await ready()
    // The only tab is in front: one click edits it.
    fireEvent.click(screen.getByRole('tab', { name: 'Seul' }))
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    expect((editor.getJSON() as { content?: NoteNode[] }).content?.some((n) => n.type === 'noteTabs')).toBe(false)
  })

  it('in « Aperçu », the tabs still switch but cannot be changed', async () => {
    initialDoc = { type: 'doc', content: [para('première ligne'), tabs(tab('Théorie', 'A'), tab('Exemple', 'B'))] }
    await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Aperçu' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Ajouter un onglet' })).not.toBeInTheDocument())
    fireEvent.click(screen.getByRole('tab', { name: 'Théorie' }))
    expect(shownTitle()).toBe('Théorie')
    fireEvent.click(screen.getByRole('tab', { name: 'Théorie' }))
    expect(screen.queryByRole('textbox', { name: "Nom de l'onglet" })).not.toBeInTheDocument()
  })

  it('shows one tab at a time: the rule written for the block names the tab in front', async () => {
    initialDoc = { type: 'doc', content: [para('première ligne'), tabs(tab('Théorie', 'A'), tab('Exemple', 'B'))] }
    await ready()
    fireEvent.click(screen.getByRole('tab', { name: 'Théorie' }))
    const rule = document.querySelector('.yc-tabs style')?.textContent ?? ''
    expect(rule).toContain('[data-note-tab]:nth-child(1) { display: block; }')
    expect(within(screen.getByRole('tablist')).getAllByRole('tab')).toHaveLength(2)
  })
})

describe('tabs in the .docx (YC-52)', () => {
  it('each tab is a title on a sunken band, then its page', async () => {
    const doc = { type: 'doc', content: [tabs(tab('Théorie', 'Un effet après le rendu'), tab('Exemple', 'useEffect'))] } as NoteDoc
    const buffer = await Packer.toBuffer(buildNoteDocument(doc, { title: 'Note', page: DEFAULT_PAGE }))
    const xml = await (await JSZip.loadAsync(buffer)).file('word/document.xml')!.async('string')
    expect(xml.indexOf('>Théorie</w:t>')).toBeLessThan(xml.indexOf('>Un effet après le rendu</w:t>'))
    expect(xml.indexOf('>Un effet après le rendu</w:t>')).toBeLessThan(xml.indexOf('>Exemple</w:t>'))
    expect(xml).toMatch(/w:fill="EAE4D7"[\s\S]*?<w:b\/>[\s\S]*?>Théorie<\/w:t>/)
  })
})
