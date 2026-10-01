import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Editor } from '@tiptap/react'
import { NodeSelection } from '@tiptap/pm/state'
import { Packer } from 'docx'
import JSZip from 'jszip'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NoteDoc, NoteNode } from './noteDoc'
import { DEFAULT_PAGE } from './notePage'
import { buildNoteDocument, imageIds } from './noteToDocx'
import { VideoNotes } from './VideoNotes'

// Images in a note (YC-50), through the real editor: chosen, pasted, refused, laid out, exported.

const ID = '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e'
const para = (text: string): NoteNode => ({ type: 'paragraph', content: [{ type: 'text', text }] })
let initialDoc: NoteDoc
let puts: { doc: NoteDoc }[]
let uploads: { body: unknown; headers: Record<string, string> }[]
let uploadAnswer: () => Response

function renderNotes() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <VideoNotes videoId="v1" />
    </QueryClientProvider>,
  )
}

async function ready() {
  const view = renderNotes()
  const el = await screen.findByRole('textbox', { name: 'Note de la vidéo' }, { timeout: 5000 })
  await waitFor(() => expect(el).toHaveTextContent('première'))
  return { ...view, editor: (el as unknown as { editor: Editor }).editor }
}

const png = (name = 'schema.png', type = 'image/png', size = 2048) => new File([new Uint8Array(size)], name, { type })
const images = (doc: { content?: NoteNode[] }) => (doc.content ?? []).filter((n) => n.type === 'noteImage')

describe('images in a note (YC-50)', () => {
  beforeEach(() => {
    initialDoc = { type: 'doc', content: [para('première ligne')] }
    puts = []
    uploads = []
    uploadAnswer = () => new Response(JSON.stringify({ id: ID, width: 800, height: 600, name: 'schema.png' }), { status: 201 })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes('/note-images')) {
          uploads.push({ body: init?.body, headers: init?.headers as Record<string, string> })
          return uploadAnswer()
        }
        if (init?.method === 'PUT') {
          const body = JSON.parse(init.body as string) as { doc: NoteDoc }
          puts.push(body)
          return new Response(JSON.stringify({ ...body, updatedAt: '2026-10-01T10:00:00Z' }), { status: 200 })
        }
        return new Response(JSON.stringify({ doc: initialDoc, page: null, updatedAt: '2026-10-01T10:00:00Z' }), { status: 200 })
      }),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('« Insérer une image » sends the file as it is, then the block holds its id and is saved', async () => {
    const { editor, container } = await ready()
    const input = container.querySelector<HTMLInputElement>('[data-testid="note-image-input"]')!
    const click = vi.spyOn(input, 'click')
    fireEvent.click(screen.getByRole('button', { name: 'Insérer une image' }))
    expect(click).toHaveBeenCalled()

    const file = png('cycle de vie.png')
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(images(editor.getJSON())).toHaveLength(1))
    expect(uploads[0].body).toBe(file)
    expect(uploads[0].headers).toMatchObject({ 'Content-Type': 'image/png', 'X-File-Name': encodeURIComponent('cycle de vie.png') })
    expect(images(editor.getJSON())[0].attrs).toMatchObject({ id: ID, align: 'center', width: null })
    await waitFor(() => expect(puts.length).toBeGreaterThan(0), { timeout: 2500 })
    expect(images(puts[puts.length - 1].doc)[0].attrs).toMatchObject({ id: ID })
  })

  it('a pasted image goes in the same way', async () => {
    const { editor } = await ready()
    const file = png()
    fireEvent.paste(editor.view.dom, { clipboardData: { files: [file], types: ['Files'], getData: () => '' } })
    await waitFor(() => expect(images(editor.getJSON())).toHaveLength(1), { timeout: 4000 })
    expect(uploads).toHaveLength(1)
  })

  it('refuses before sending what is not an image or weighs over 10 Mo, and says why', async () => {
    const { editor, container } = await ready()
    const input = container.querySelector<HTMLInputElement>('[data-testid="note-image-input"]')!
    fireEvent.change(input, { target: { files: [png('cours.pdf', 'application/pdf')] } })
    expect(await screen.findByRole('alert')).toHaveTextContent("« cours.pdf » n'est pas une image")
    fireEvent.change(input, { target: { files: [png('huge.png', 'image/png', 10 * 1024 * 1024 + 1)] } })
    expect(await screen.findByRole('alert')).toHaveTextContent('« huge.png » dépasse 10 Mo')
    expect(uploads).toHaveLength(0)
    expect(images(editor.getJSON())).toHaveLength(0)
  })

  it("says what the server answered when it refuses, and inserts nothing", async () => {
    uploadAnswer = () => new Response(JSON.stringify({ error: 'Format non accepté : JPEG, PNG, WebP, GIF ou AVIF' }), { status: 415 })
    const { editor, container } = await ready()
    fireEvent.change(container.querySelector('[data-testid="note-image-input"]')!, { target: { files: [png()] } })
    expect(await screen.findByRole('alert')).toHaveTextContent('Format non accepté')
    expect(images(editor.getJSON())).toHaveLength(0)
  })

  describe('the block, Figma 65:2007', () => {
    const withImage = async (attrs: Record<string, unknown> = {}) => {
      initialDoc = { type: 'doc', content: [para('première ligne'), { type: 'noteImage', attrs: { id: ID, ...attrs } }] }
      const out = await ready()
      // Select the image block, as a click on it does.
      act(() => {
        const pos = out.editor.state.doc.child(0).nodeSize
        out.editor.view.dispatch(out.editor.state.tr.setSelection(NodeSelection.create(out.editor.state.doc, pos)))
      })
      return out
    }

    it('shows the image from the API, never from elsewhere', async () => {
      const { container } = await withImage({ alt: 'Le cycle' })
      const img = container.querySelector('.yc-image img')!
      expect(img.getAttribute('src')).toBe(`/api/note-images/${ID}`)
      expect(img).toHaveAttribute('alt', 'Le cycle')
    })

    it('selected: its bar sets the alignment, the alternative text, and deletes it', async () => {
      const { editor } = await withImage()
      const bar = screen.getByRole('toolbar', { name: 'Image' })
      expect(within(bar).getByRole('button', { name: 'Centrer' })).toHaveAttribute('aria-pressed', 'true')
      fireEvent.click(within(bar).getByRole('button', { name: 'Pleine largeur' }))
      expect(images(editor.getJSON())[0].attrs?.align).toBe('full')

      expect(screen.getByText(/Pas encore de texte alternatif/)).toBeInTheDocument()
      fireEvent.click(within(bar).getByRole('button', { name: 'Texte alternatif' }))
      fireEvent.change(screen.getByRole('textbox', { name: /Texte alternatif/ }), { target: { value: 'Rendu, nettoyage, effet' } })
      expect(images(editor.getJSON())[0].attrs?.alt).toBe('Rendu, nettoyage, effet')

      fireEvent.click(within(bar).getByRole('button', { name: "Supprimer l'image" }))
      expect(images(editor.getJSON())).toHaveLength(0)
    })

    it('the caption is typed under it and kept', async () => {
      const { editor } = await withImage()
      fireEvent.change(screen.getByRole('textbox', { name: "Légende de l'image" }), { target: { value: 'Figure 1' } })
      expect(images(editor.getJSON())[0].attrs?.caption).toBe('Figure 1')
    })

    it('« Remplacer » sends a new file and keeps the block, its caption and layout', async () => {
      const NEW = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'
      uploadAnswer = () => new Response(JSON.stringify({ id: NEW, width: 10, height: 10, name: 'b.png' }), { status: 201 })
      const { editor, container } = await withImage({ caption: 'Figure 1', align: 'left' })
      const fileInput = container.querySelector<HTMLInputElement>('.yc-image-bar input[type="file"]')!
      fireEvent.change(fileInput, { target: { files: [png('b.png')] } })
      await waitFor(() => expect(images(editor.getJSON())[0].attrs?.id).toBe(NEW))
      expect(images(editor.getJSON())[0].attrs).toMatchObject({ caption: 'Figure 1', align: 'left' })
    })

    it('in « Aperçu », the caption is shown and nothing can be changed', async () => {
      const { container } = await withImage({ caption: 'Figure 1' })
      fireEvent.click(screen.getByRole('button', { name: 'Aperçu' }))
      await waitFor(() => expect(screen.queryByRole('toolbar', { name: 'Image' })).not.toBeInTheDocument())
      expect(container.querySelector('figcaption')).toHaveTextContent('Figure 1')
      expect(screen.queryByRole('textbox', { name: "Légende de l'image" })).not.toBeInTheDocument()
    })
  })

  it('« + Insérer » lists the blocks of the mockup (63:2013), then the tools of the bar', async () => {
    const { container } = await ready()
    const input = container.querySelector<HTMLInputElement>('[data-testid="note-image-input"]')!
    const click = vi.spyOn(input, 'click')
    fireEvent.click(screen.getByRole('button', { name: 'Insérer' }))
    const menu = screen.getByRole('menu', { name: 'Insérer' })
    const items = within(menu).getAllByRole('menuitem').map((i) => i.getAttribute('aria-label'))
    // The table's size grid (YC-51) sits between the image and the tools of the bar.
    expect(items.filter((l) => !l?.startsWith('Tableau de'))).toEqual(['Image', 'Onglets', 'Schéma', 'Graphique', 'Lien', 'Bloc de code', 'Citation', 'Séparateur'])
    expect(items.filter((l) => l?.startsWith('Tableau de'))).toHaveLength(30)
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Image' }))
    expect(click).toHaveBeenCalled()
  })
})

describe('images in the .docx (YC-50)', () => {
  const pngBytes = async () => {
    // A real 2 × 1 PNG, built by the docx tests' own zip library: no canvas in jsdom.
    const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEUlEQVR42mP8z8DwnwEJMCIDAFzNBP1yPfJ5AAAAAElFTkSuQmCC'
    return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  }

  async function build(content: NoteNode[], withImage: boolean) {
    const images = withImage ? new Map([[ID, { data: await pngBytes(), width: 800, height: 400 }]]) : undefined
    const buffer = await Packer.toBuffer(buildNoteDocument({ type: 'doc', content } as NoteDoc, { title: 'Note', page: DEFAULT_PAGE, images }))
    const zip = await JSZip.loadAsync(buffer)
    return { zip, xml: await zip.file('word/document.xml')!.async('string') }
  }

  it('puts the picture itself in Word, with its alternative text and its caption', async () => {
    const { zip, xml } = await build([{ type: 'noteImage', attrs: { id: ID, alt: 'Le cycle', caption: 'Figure 1', width: 50 } }], true)
    expect(Object.keys(zip.files).some((f) => f.startsWith('word/media/') && f.endsWith('.png'))).toBe(true)
    expect(xml).toContain('descr="Le cycle"')
    expect(xml).toContain('>Figure 1</w:t>')
    // Half the page width (600 px at 9525 EMU per px), the height in proportion.
    expect(xml).toContain('cx="2857500"')
    expect(xml).toContain('cy="1428750"')
  })

  it('an image that could not be read says what it was, rather than vanishing', async () => {
    const { xml } = await build([{ type: 'noteImage', attrs: { id: ID, alt: 'Le cycle' } }], false)
    expect(xml).toContain('>[Image : Le cycle]</w:t>')
  })

  it('finds the images inside lists and quotes too', () => {
    const doc: NoteNode[] = [
      { type: 'blockquote', content: [{ type: 'noteImage', attrs: { id: 'a' } }] },
      { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'noteImage', attrs: { id: 'b' } }] }] },
    ]
    expect(imageIds(doc)).toEqual(['a', 'b'])
  })
})
