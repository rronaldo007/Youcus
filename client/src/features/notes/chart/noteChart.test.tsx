import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Editor } from '@tiptap/react'
import { Packer } from 'docx'
import JSZip from 'jszip'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NoteDoc, NoteNode } from '../noteDoc'
import { DEFAULT_PAGE } from '../notePage'
import { buildNoteDocument } from '../noteToDocx'
import { VideoNotes } from '../VideoNotes'
import type { Chart } from './chart'

// Charts in a note (YC-54), through the real editor, Figma « Bloc de note › Graphique » 65:2230.

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

const chartOf = (editor: Editor): Chart | undefined =>
  (editor.getJSON() as { content?: NoteNode[] }).content?.find((n) => n.type === 'noteChart')?.attrs?.chart as Chart | undefined
const week = (): Chart => ({
  title: 'Temps d’étude par jour (min)',
  kind: 'bar',
  rows: [
    { label: 'L', value: 32 },
    { label: 'M', value: 55 },
  ],
})
const withChart = (chart: Chart): NoteDoc => ({ type: 'doc', content: [para('première ligne'), { type: 'noteChart', attrs: { chart } }, para('après')] })
const data = () => screen.getByRole('group', { name: 'Données du graphique' })

describe('charts in a note (YC-54)', () => {
  beforeEach(() => {
    initialDoc = { type: 'doc', content: [para('première ligne')] }
    puts = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'PUT') {
          const doc = (JSON.parse(init.body as string) as { doc: NoteDoc }).doc
          puts.push(doc)
          return new Response(JSON.stringify({ doc, updatedAt: '2026-10-01T19:00:00Z' }), { status: 200 })
        }
        return new Response(JSON.stringify({ doc: initialDoc, page: null, updatedAt: '2026-10-01T19:00:00Z' }), { status: 200 })
      }),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('« Insérer un graphique » puts bars to fill, the table open on its title', async () => {
    const editor = await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Insérer un graphique' }))
    const table = await screen.findByRole('group', { name: 'Données du graphique' })
    await waitFor(() => expect(within(table).getByRole('textbox', { name: 'Titre' })).toHaveFocus())
    expect(within(table).getAllByRole('textbox', { name: /^Libellé/ }).map((i) => (i as HTMLInputElement).value)).toEqual(['A', 'B', 'C'])
    expect(screen.getByRole('button', { name: 'Modifier les données' })).toHaveAttribute('aria-expanded', 'true')
    expect(within(screen.getByRole('group', { name: 'Type de graphique' })).getByRole('button', { name: 'Barres' })).toHaveAttribute('aria-pressed', 'true')
    expect(chartOf(editor)?.rows.map((r) => r.value)).toEqual([null, null, null])
  })

  it('typed values draw the chart and are saved with the note; every letter typed fast is kept', async () => {
    initialDoc = withChart({ title: '', kind: 'bar', rows: [{ label: 'A', value: null }] })
    const editor = await ready()
    const title = within(data()).getByRole('textbox', { name: 'Titre' })
    // Two changes in a row, before the block redraws: the second starts from the first.
    fireEvent.change(title, { target: { value: 'Temps' } })
    fireEvent.change(within(data()).getByRole('textbox', { name: 'Valeur, ligne 1' }), { target: { value: '12,5' } })
    fireEvent.click(within(data()).getByRole('button', { name: '+ Ajouter une ligne' }))
    fireEvent.change(within(data()).getByRole('textbox', { name: 'Libellé, ligne 2' }), { target: { value: 'B' } })
    fireEvent.change(within(data()).getByRole('textbox', { name: 'Valeur, ligne 2' }), { target: { value: '40' } })
    await waitFor(() => expect(chartOf(editor)).toEqual({ title: 'Temps', kind: 'bar', rows: [{ label: 'A', value: 12.5 }, { label: 'B', value: 40 }] }))
    expect(await screen.findByRole('img', { name: 'Graphique, barres : Temps : A 12,5, B 40' })).toBeInTheDocument()
    await waitFor(() => expect(puts.length).toBeGreaterThan(0), { timeout: 2500 })
    const saved = puts[puts.length - 1].content.find((n) => n.type === 'noteChart')
    expect((saved?.attrs?.chart as Chart).rows).toEqual([{ label: 'A', value: 12.5 }, { label: 'B', value: 40 }])
  })

  it('a value that is not a number is said, and the chart waits for it', async () => {
    initialDoc = withChart({ title: '', kind: 'bar', rows: [{ label: 'A', value: null }] })
    const editor = await ready()
    const value = within(data()).getByRole('textbox', { name: 'Valeur, ligne 1' })
    fireEvent.change(value, { target: { value: '-4' } })
    expect(value).toHaveAttribute('aria-invalid', 'true')
    expect(within(data()).getByRole('alert')).toHaveTextContent('Une valeur est un nombre positif')
    expect(chartOf(editor)?.rows[0].value).toBeNull()
    fireEvent.change(value, { target: { value: '4' } })
    await waitFor(() => expect(chartOf(editor)?.rows[0].value).toBe(4))
    expect(within(data()).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('removes a row, never the last; « Terminé » closes the table', async () => {
    initialDoc = withChart(week())
    const editor = await ready()
    expect(screen.queryByRole('group', { name: 'Données du graphique' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Modifier les données' }))
    fireEvent.click(within(data()).getByRole('button', { name: 'Retirer la ligne 1' }))
    await waitFor(() => expect(chartOf(editor)?.rows).toEqual([{ label: 'M', value: 55 }]))
    expect(within(data()).getByRole('button', { name: 'Retirer la ligne 1' })).toBeDisabled()
    fireEvent.click(within(data()).getByRole('button', { name: 'Terminé' }))
    expect(screen.queryByRole('group', { name: 'Données du graphique' })).not.toBeInTheDocument()
  })

  it('the segment turns the bars into a line or a pie, saved', async () => {
    initialDoc = withChart(week())
    const editor = await ready()
    const kind = screen.getByRole('group', { name: 'Type de graphique' })
    expect(within(kind).getAllByRole('button').map((b) => b.textContent)).toEqual(['Barres', 'Courbe', 'Secteurs'])
    fireEvent.click(within(kind).getByRole('button', { name: 'Secteurs' }))
    await waitFor(() => expect(chartOf(editor)?.kind).toBe('pie'))
    expect(await screen.findByRole('img', { name: /^Graphique, secteurs/ })).toBeInTheDocument()
    expect(document.querySelectorAll('.yc-chart-plot path')).toHaveLength(2)
    fireEvent.click(within(screen.getByRole('group', { name: 'Type de graphique' })).getByRole('button', { name: 'Courbe' }))
    await waitFor(() => expect(chartOf(editor)?.kind).toBe('line'))
    expect(document.querySelector('.yc-chart-plot polyline')).not.toBeNull()
  })

  it('a value typed just after a kind is picked keeps that kind', async () => {
    initialDoc = withChart(week())
    const editor = await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Modifier les données' }))
    // The two in a row, before the block redraws with the pie.
    fireEvent.click(within(screen.getByRole('group', { name: 'Type de graphique' })).getByRole('button', { name: 'Secteurs' }))
    fireEvent.change(within(data()).getByRole('textbox', { name: 'Valeur, ligne 1' }), { target: { value: '40' } })
    await waitFor(() => expect(chartOf(editor)?.rows[0].value).toBe(40))
    expect(chartOf(editor)?.kind).toBe('pie')
  })

  it('« Supprimer le graphique » takes the block out of the note', async () => {
    initialDoc = withChart(week())
    const editor = await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Modifier les données' }))
    fireEvent.click(within(data()).getByRole('button', { name: 'Supprimer le graphique' }))
    await waitFor(() => expect(chartOf(editor)).toBeUndefined())
  })

  it('in « Aperçu », the title and the drawing, nothing to change', async () => {
    initialDoc = withChart(week())
    await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Aperçu' }))
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Type de graphique' })).not.toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Modifier les données' })).not.toBeInTheDocument()
    expect(screen.getByText('Temps d’étude par jour (min)')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Graphique, barres : Temps d’étude par jour (min) : L 32, M 55' })).toBeInTheDocument()
  })

  it('cannot go in a table: the tool is off there', async () => {
    initialDoc = { type: 'doc', content: [para('première ligne'), { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [para('x')] }] }] }] }
    const editor = await ready()
    let cell = 0
    editor.state.doc.descendants((n, pos) => {
      if (!cell && n.type.name === 'tableCell') cell = pos + 2
    })
    editor.commands.setTextSelection(cell)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Insérer un graphique' })).toHaveAttribute('aria-disabled', 'true'))
  })
})

describe('charts in the .docx (YC-54)', () => {
  const node: NoteNode = { type: 'noteChart', attrs: { chart: week() } }
  const png = () => Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEUlEQVR42mP8z8DwnwEJMCIDAFzNBP1yPfJ5AAAAAElFTkSuQmCC'), (c) => c.charCodeAt(0))

  it('is a picture, its title and values as its alternative text', async () => {
    const buffer = await Packer.toBuffer(
      buildNoteDocument({ type: 'doc', content: [node] } as NoteDoc, { title: 'Note', page: DEFAULT_PAGE, drawings: new Map([[node, { data: png(), width: 600, height: 260 }]]) }),
    )
    const zip = await JSZip.loadAsync(buffer)
    const xml = await zip.file('word/document.xml')!.async('string')
    expect(Object.keys(zip.files).some((f) => f.startsWith('word/media/'))).toBe(true)
    expect(xml).toContain('descr="Graphique : Temps d’étude par jour (min) : L 32, M 55"')
  })

  it('says its title and values when it could not be drawn', async () => {
    const buffer = await Packer.toBuffer(buildNoteDocument({ type: 'doc', content: [node] } as NoteDoc, { title: 'Note', page: DEFAULT_PAGE }))
    const xml = await (await JSZip.loadAsync(buffer)).file('word/document.xml')!.async('string')
    expect(xml).toContain('>[Graphique : Temps d’étude par jour (min) : L 32, M 55]</w:t>')
  })
})
