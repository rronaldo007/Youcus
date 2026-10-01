import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Editor } from '@tiptap/react'
import { Packer } from 'docx'
import JSZip from 'jszip'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NoteDoc, NoteNode } from '../noteDoc'
import { DEFAULT_PAGE } from '../notePage'
import { buildNoteDocument } from '../noteToDocx'
import { VideoNotes } from '../VideoNotes'
import type { Scene } from './scene'

// Diagrams in a note (YC-53), through the real editor, Figma « Bloc de note › Schéma » 65:2143.

// jsdom has no PointerEvent: a MouseEvent carries the coordinates the drawing reads.
beforeAll(() => {
  if (!('PointerEvent' in window)) {
    class PointerEventShim extends MouseEvent {
      pointerId: number
      constructor(type: string, init: MouseEventInit & { pointerId?: number } = {}) {
        super(type, init)
        this.pointerId = init.pointerId ?? 1
      }
    }
    Object.assign(window, { PointerEvent: PointerEventShim })
  }
})

const para = (text: string): NoteNode => ({ type: 'paragraph', content: [{ type: 'text', text }] })
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

const sceneOf = (editor: Editor): Scene =>
  ((editor.getJSON() as { content?: NoteNode[] }).content?.find((n) => n.type === 'noteDiagram')?.attrs?.scene as Scene) ?? { shapes: [], arrows: [] }

/**
 * The drawing is 700 × 400 on screen; an empty scene shows the page 0,0 – 700 × 260 at 100 %,
 * centred: a point of the screen (x, y) is (x, y − 70) in the drawing.
 */
function canvas() {
  const svg = document.querySelector<SVGSVGElement>('.yc-diagram-canvas')!
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 700, height: 400, right: 700, bottom: 400, x: 0, y: 0, toJSON: () => ({}) })
  return svg
}
const background = () => document.querySelector('.yc-diagram-bg')!
const shapeEl = (id: string) => document.querySelector(`[data-shape="${id}"]`)!

async function addShape(tool: string, clientX: number, clientY: number, text: string) {
  fireEvent.click(within(screen.getByRole('toolbar', { name: 'Schéma' })).getByRole('button', { name: tool }))
  fireEvent.pointerDown(background(), { clientX, clientY })
  const field = await screen.findByRole('textbox', { name: 'Texte de la forme' })
  fireEvent.change(field, { target: { value: text } })
  fireEvent.keyDown(field, { key: 'Enter' })
}

const withDiagram = (scene: Scene): NoteDoc => ({ type: 'doc', content: [para('première ligne'), { type: 'noteDiagram', attrs: { scene } }, para('après')] })
const twoShapes = (): Scene => ({
  shapes: [
    { id: 'a', kind: 'rect', x: 0, y: 100, w: 150, h: 64, text: 'Rendu', color: 'bleu' },
    { id: 'b', kind: 'diamond', x: 300, y: 60, w: 180, h: 140, text: 'Dépendances changées ?', color: 'orange' },
  ],
  arrows: [{ id: 'z', from: 'a', to: 'b', label: '' }],
})

describe('diagrams in a note (YC-53)', () => {
  beforeEach(() => {
    initialDoc = { type: 'doc', content: [para('première ligne')] }
    puts = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'PUT') {
          const doc = (JSON.parse(init.body as string) as { doc: NoteDoc }).doc
          puts.push(doc)
          return new Response(JSON.stringify({ doc, updatedAt: '2026-10-01T17:00:00Z' }), { status: 200 })
        }
        return new Response(JSON.stringify({ doc: initialDoc, page: null, updatedAt: '2026-10-01T17:00:00Z' }), { status: 200 })
      }),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('« Insérer un schéma » puts an empty drawing with the bar of the mockup', async () => {
    const editor = await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Insérer un schéma' }))
    const bar = await screen.findByRole('toolbar', { name: 'Schéma' })
    expect(within(bar).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Sélection',
      'Rectangle',
      'Ellipse',
      'Losange',
      'Flèche',
      'Texte',
      'Couleur de la forme',
      'Supprimer le schéma',
    ])
    expect(screen.getByText(/Choisis une forme dans la barre/)).toBeInTheDocument()
    expect(sceneOf(editor)).toEqual({ shapes: [], arrows: [] })
  })

  it('draws a shape where clicked, its text typed at once; the note saves it', async () => {
    initialDoc = withDiagram({ shapes: [], arrows: [] })
    const editor = await ready()
    canvas()
    await addShape('Rectangle', 200, 170, 'Rendu')
    expect(sceneOf(editor).shapes).toEqual([{ id: expect.any(String), kind: 'rect', x: 125, y: 72, w: 150, h: 56, text: 'Rendu', color: 'bleu' }])
    // Back to the selection tool after a shape.
    expect(within(screen.getByRole('toolbar', { name: 'Schéma' })).getByRole('button', { name: 'Sélection' })).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(puts.length).toBeGreaterThan(0), { timeout: 2500 })
    const saved = puts[puts.length - 1].content.find((n) => n.type === 'noteDiagram')
    expect((saved?.attrs?.scene as Scene).shapes[0].text).toBe('Rendu')
  })

  it('draws an arrow from a shape to another, and names it', async () => {
    initialDoc = withDiagram({ ...twoShapes(), arrows: [] })
    const editor = await ready()
    canvas()
    fireEvent.click(within(screen.getByRole('toolbar', { name: 'Schéma' })).getByRole('button', { name: 'Flèche' }))
    fireEvent.pointerDown(shapeEl('a'), { clientX: 75, clientY: 200 })
    fireEvent.pointerDown(shapeEl('b'), { clientX: 390, clientY: 200 })
    const [arrow] = sceneOf(editor).arrows
    expect(arrow).toMatchObject({ from: 'a', to: 'b', label: '' })
    // An arrow from a shape to itself, or a second identical one, is not drawn.
    fireEvent.pointerDown(shapeEl('a'), { clientX: 75, clientY: 200 })
    fireEvent.pointerDown(shapeEl('b'), { clientX: 390, clientY: 200 })
    expect(sceneOf(editor).arrows).toHaveLength(1)

    // The arrow's view draws right after the transaction.
    await waitFor(() => expect(document.querySelectorAll(`[data-arrow="${arrow.id}"] line`)).toHaveLength(2))
    fireEvent.doubleClick(document.querySelectorAll(`[data-arrow="${arrow.id}"] line`)[1])
    const field = await screen.findByRole('textbox', { name: 'Texte de la flèche' })
    fireEvent.change(field, { target: { value: 'oui' } })
    fireEvent.keyDown(field, { key: 'Enter' })
    expect(sceneOf(editor).arrows[0].label).toBe('oui')
  })

  it('a shape moved with the pointer takes its arrows with it, in one change of the note', async () => {
    initialDoc = withDiagram(twoShapes())
    const editor = await ready()
    canvas()
    fireEvent.pointerDown(shapeEl('a'), { clientX: 100, clientY: 200 })
    fireEvent.pointerMove(canvas(), { clientX: 120, clientY: 260 })
    // While it moves, the note does not change: one change when it is dropped.
    expect(sceneOf(editor).shapes[0]).toMatchObject({ x: 0, y: 100 })
    fireEvent.pointerUp(canvas(), { clientX: 120, clientY: 260 })
    const scene = sceneOf(editor)
    expect(scene.shapes[0]).toMatchObject({ id: 'a', x: expect.any(Number), y: expect.any(Number) })
    expect(scene.shapes[0].x).not.toBe(0)
    expect(scene.arrows).toEqual([{ id: 'z', from: 'a', to: 'b', label: '' }])
  })

  it('Suppr deletes the shape picked and its arrows, never the block; Entrée edits its text', async () => {
    initialDoc = withDiagram(twoShapes())
    const editor = await ready()
    canvas()
    fireEvent.pointerDown(shapeEl('a'), { clientX: 75, clientY: 200 })
    fireEvent.pointerUp(canvas())
    const drawing = document.querySelector('.yc-diagram')!
    fireEvent.keyDown(drawing, { key: 'Enter' })
    expect(await screen.findByRole('textbox', { name: 'Texte de la forme' })).toHaveValue('Rendu')
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Texte de la forme' }), { key: 'Escape' })
    expect(sceneOf(editor).shapes[0].text).toBe('Rendu')

    fireEvent.keyDown(drawing, { key: 'Delete' })
    expect(sceneOf(editor)).toEqual({ shapes: [twoShapes().shapes[1]], arrows: [] })
    expect((editor.getJSON() as { content?: NoteNode[] }).content?.some((n) => n.type === 'noteDiagram')).toBe(true)
  })

  it('Échap in the text field keeps the text as it was', async () => {
    initialDoc = withDiagram(twoShapes())
    const editor = await ready()
    canvas()
    fireEvent.doubleClick(shapeEl('a'))
    const field = await screen.findByRole('textbox', { name: 'Texte de la forme' })
    fireEvent.change(field, { target: { value: 'autre chose' } })
    fireEvent.keyDown(field, { key: 'Escape' })
    fireEvent.blur(field)
    expect(sceneOf(editor).shapes[0].text).toBe('Rendu')
  })

  it('« Couleur de la forme » recolours the shape picked, from the note colours', async () => {
    initialDoc = withDiagram(twoShapes())
    const editor = await ready()
    canvas()
    const bar = screen.getByRole('toolbar', { name: 'Schéma' })
    expect(within(bar).getByRole('button', { name: 'Couleur de la forme' })).toBeDisabled()
    fireEvent.pointerDown(shapeEl('a'), { clientX: 75, clientY: 200 })
    fireEvent.pointerUp(canvas())
    fireEvent.click(within(bar).getByRole('button', { name: 'Couleur de la forme' }))
    const menu = within(bar).getByRole('menu', { name: 'Couleur de la forme' })
    expect(within(menu).getAllByRole('menuitem').map((b) => b.getAttribute('aria-label'))).toEqual(['Bleu', 'Rouge', 'Vert', 'Orange', 'Violet', 'Gris'])
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Vert' }))
    expect(sceneOf(editor).shapes[0].color).toBe('vert')
  })

  it('« Supprimer le schéma » removes the block', async () => {
    initialDoc = withDiagram(twoShapes())
    const editor = await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer le schéma' }))
    expect((editor.getJSON() as { content?: NoteNode[] }).content?.some((n) => n.type === 'noteDiagram')).toBe(false)
  })

  it('in « Aperçu », a picture that says its words, nothing to change', async () => {
    initialDoc = withDiagram(twoShapes())
    await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Aperçu' }))
    await waitFor(() => expect(screen.queryByRole('toolbar', { name: 'Schéma' })).not.toBeInTheDocument())
    expect(screen.getByRole('img', { name: 'Schéma : Rendu, Dépendances changées ?' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Ajuster/ })).not.toBeInTheDocument()
  })

  it('on a phone, a thumbnail; a touch opens it full screen to edit, « Fermer » closes it', async () => {
    const phone = vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({ matches: query.includes('max-width: 480px'), media: query, onchange: null, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn() }) as unknown as MediaQueryList,
    )
    try {
      initialDoc = withDiagram(twoShapes())
      await ready()
      expect(screen.queryByRole('toolbar', { name: 'Schéma' })).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Agrandir le schéma' }))
      const dialog = screen.getByRole('dialog', { name: 'Schéma' })
      expect(within(dialog).getByRole('toolbar', { name: 'Schéma' })).toBeInTheDocument()
      fireEvent.click(within(dialog).getByRole('button', { name: 'Fermer' }))
      expect(screen.queryByRole('dialog', { name: 'Schéma' })).not.toBeInTheDocument()
    } finally {
      // Only this spy: the setup's own matchMedia stays.
      phone.mockRestore()
    }
  })

  it('« Ajuster » shows everything again after a move of the view', async () => {
    initialDoc = withDiagram(twoShapes())
    await ready()
    canvas()
    const before = document.querySelector('.yc-diagram-canvas')!.getAttribute('viewBox')
    fireEvent.pointerDown(background(), { clientX: 600, clientY: 300 })
    fireEvent.pointerMove(canvas(), { clientX: 500, clientY: 250 })
    fireEvent.pointerUp(canvas())
    expect(document.querySelector('.yc-diagram-canvas')!.getAttribute('viewBox')).not.toBe(before)
    fireEvent.click(screen.getByRole('button', { name: /Ajuster/ }))
    expect(document.querySelector('.yc-diagram-canvas')!.getAttribute('viewBox')).toBe(before)
  })
})

describe('diagrams in the .docx (YC-53)', () => {
  const node: NoteNode = { type: 'noteDiagram', attrs: { scene: { ...twoShapes(), arrows: [{ id: 'z', from: 'a', to: 'b', label: 'oui' }] } } }
  const png = () => Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEUlEQVR42mP8z8DwnwEJMCIDAFzNBP1yPfJ5AAAAAElFTkSuQmCC'), (c) => c.charCodeAt(0))

  it('is a picture, its words as its alternative text', async () => {
    const buffer = await Packer.toBuffer(
      buildNoteDocument({ type: 'doc', content: [node] } as NoteDoc, { title: 'Note', page: DEFAULT_PAGE, diagrams: new Map([[node, { data: png(), width: 480, height: 200 }]]) }),
    )
    const zip = await JSZip.loadAsync(buffer)
    const xml = await zip.file('word/document.xml')!.async('string')
    expect(Object.keys(zip.files).some((f) => f.startsWith('word/media/'))).toBe(true)
    expect(xml).toContain('descr="Schéma : Rendu, Dépendances changées ?, oui"')
  })

  it('says its words when it could not be drawn', async () => {
    const buffer = await Packer.toBuffer(buildNoteDocument({ type: 'doc', content: [node] } as NoteDoc, { title: 'Note', page: DEFAULT_PAGE }))
    const xml = await (await JSZip.loadAsync(buffer)).file('word/document.xml')!.async('string')
    expect(xml).toContain('>[Schéma : Rendu, Dépendances changées ?, oui]</w:t>')
  })
})
