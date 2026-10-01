import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Editor } from '@tiptap/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import NoteSettings from './NoteSettings'
import { VideoNotes } from './VideoNotes'

const PREFS = { paper: 'seyes', tint: 'sepia', margin: false, timestamps: false, font: 'lora', size: 18 }
let storedPrefs: Record<string, unknown> | null
let storedNote: unknown
let putPrefs: Record<string, unknown>[]
let refusePut: boolean

function stubApi() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/account/note-preferences')) {
        if (init?.method === 'PUT') {
          if (refusePut) return new Response(JSON.stringify({ error: 'non' }), { status: 500 })
          const body = JSON.parse(init.body as string)
          putPrefs.push(body)
          return new Response(JSON.stringify(body), { status: 200 })
        }
        return new Response(JSON.stringify(storedPrefs ?? { paper: 'lignes', tint: 'creme', margin: true, timestamps: true, font: 'hanken', size: 16 }), { status: 200 })
      }
      if (init?.method === 'PUT') return new Response(init.body as string, { status: 200 })
      return new Response(JSON.stringify(storedNote), { status: 200 })
    }),
  )
}

const wrap = (ui: React.ReactNode) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>{ui}</QueryClientProvider>)

describe('Réglages › Notes (YC-48)', () => {
  beforeEach(() => {
    storedPrefs = PREFS
    storedNote = null
    putPrefs = []
    refusePut = false
    stubApi()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('shows the stored settings', async () => {
    wrap(<NoteSettings />)
    expect(await screen.findByRole('radio', { name: 'Papier seyès' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Teinte sépia' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('combobox', { name: 'Police par défaut' })).toHaveValue('lora')
    expect(screen.getByRole('combobox', { name: 'Taille par défaut' })).toHaveValue('18')
    expect(screen.getByRole('switch', { name: 'Colonne de marge (horodatages)' })).toHaveAttribute('aria-checked', 'false')
  })

  it('saves every change at once, with all the settings', async () => {
    wrap(<NoteSettings />)
    fireEvent.click(await screen.findByRole('radio', { name: 'Papier carreaux' }))
    await waitFor(() => expect(putPrefs).toHaveLength(1))
    expect(putPrefs[0]).toEqual({ ...PREFS, paper: 'carreaux' })
    expect(screen.getByRole('radio', { name: 'Papier carreaux' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.change(screen.getByRole('combobox', { name: 'Police par défaut' }), { target: { value: 'atkinson' } })
    fireEvent.click(screen.getByRole('switch', { name: 'Horodatages dans la marge' }))
    await waitFor(() => expect(putPrefs).toHaveLength(3))
    expect(putPrefs[2]).toEqual({ ...PREFS, paper: 'carreaux', font: 'atkinson', timestamps: true })
    expect(await screen.findByText('Enregistré')).toBeInTheDocument()
  })

  it('a refused save puts the previous settings back and says so', async () => {
    refusePut = true
    wrap(<NoteSettings />)
    fireEvent.click(await screen.findByRole('radio', { name: 'Papier uni' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("L'enregistrement a échoué")
    expect(screen.getByRole('radio', { name: 'Papier seyès' })).toHaveAttribute('aria-checked', 'true')
  })
})

describe('a note and the settings (YC-48)', () => {
  beforeEach(() => {
    storedPrefs = PREFS
    putPrefs = []
    refusePut = false
    stubApi()
  })
  afterEach(() => vi.unstubAllGlobals())

  async function page() {
    wrap(<VideoNotes videoId="v1" />)
    const el = await screen.findByRole('textbox', { name: 'Note de la vidéo' }, { timeout: 5000 })
    return { el, page: el.closest('.yc-note-page') as HTMLElement, editor: (el as unknown as { editor: Editor }).editor }
  }

  it('a note not written yet starts with the settings', async () => {
    storedNote = null
    const { page: p } = await page()
    await waitFor(() => expect(p.dataset.paper).toBe('seyes'))
    expect(p.dataset).toMatchObject({ tint: 'sepia', margin: 'false', timestamps: 'false', font: 'lora', baseSize: '18' })
    const toolbar = screen.getByRole('toolbar', { name: 'Mise en forme' })
    expect(within(toolbar).getByRole('button', { name: 'Police : Lora' })).toBeInTheDocument()
    expect(within(toolbar).getByRole('button', { name: 'Taille : 18 px' })).toBeInTheDocument()
  })

  it('an existing note keeps its own page, never the settings', async () => {
    storedNote = { doc: { type: 'doc', content: [] }, page: null, updatedAt: '2026-09-30T10:00:00Z' }
    const { page: p } = await page()
    await new Promise((r) => setTimeout(r, 50))
    expect(p.dataset).toMatchObject({ paper: 'lignes', tint: 'creme', margin: 'true' })
    expect(p.dataset.font).toBeUndefined()
  })

  it('the base font needs no mark: choosing it writes none, another one does', async () => {
    storedNote = { doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'bonjour' }] }] }, page: PREFS, updatedAt: '2026-09-30T10:00:00Z' }
    const { el, editor } = await page()
    await waitFor(() => expect(el).toHaveTextContent('bonjour'))
    act(() => {
      editor.commands.setTextSelection({ from: 1, to: 8 })
    })
    const toolbar = screen.getByRole('toolbar', { name: 'Mise en forme' })
    fireEvent.click(within(toolbar).getByRole('button', { name: 'Police : Lora' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Hanken Grotesk/ }))
    expect(JSON.stringify(editor.getJSON())).toContain('"font":"hanken"')
    fireEvent.click(within(toolbar).getByRole('button', { name: 'Police : Hanken Grotesk' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Lora/ }))
    expect(JSON.stringify(editor.getJSON())).not.toContain('textFont')
  })
})
