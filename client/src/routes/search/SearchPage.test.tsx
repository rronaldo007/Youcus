import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SearchPage } from './SearchPage'
import { AppBar } from '@/components/layout/AppNav'
import { matches, type SearchResults } from '@/features/search/search'
import { useSearchShortcut } from '@/features/search/useSearchShortcut'
import { startAt } from '@/features/player/startAt'

// The search page (YC-22), Figma « Recherche » 110:36166.

let results: SearchResults
const RESULTS = (): SearchResults => ({
  query: 'useEffect',
  playlists: { total: 1, items: [{ id: 'p1', title: 'fullstack', thumbnailUrl: null, channel: 'JavaScript Mastery', videoCount: 17, completedCount: 3, titleMatches: 3 }] },
  videos: {
    total: 2,
    items: [
      { youtubeId: 'yt4', title: 'useEffect en profondeur', thumbnailUrl: null, channel: null, durationSeconds: 872, state: 'progress', playlist: { id: 'p1', title: 'fullstack', position: 4, count: 17 } },
      { youtubeId: 'yt9', title: 'Comprendre UseÉffect', thumbnailUrl: null, channel: 'Fireship', durationSeconds: 612, state: 'seen', playlist: null },
    ],
  },
  notes: {
    total: 3,
    items: [
      { noteId: 'n1', text: 'Un useEffect s’exécute après le rendu.', marker: 245, section: null, video: { youtubeId: 'yt4', title: 'useEffect en profondeur', playlist: { id: 'p1', title: 'fullstack' } }, playlist: null },
      { noteId: 'n1', text: 'Toujours nettoyer l’useEffect.', marker: 520, section: null, video: { youtubeId: 'yt4', title: 'useEffect en profondeur', playlist: { id: 'p1', title: 'fullstack' } }, playlist: null },
      { noteId: 'n2', text: 'Revoir useEffect avant l’examen.', marker: null, section: 'Plan', video: null, playlist: { id: 'p1', title: 'fullstack' } },
    ],
  },
})

function Where() {
  const l = useLocation()
  return <p data-testid="where">{l.pathname + l.search}</p>
}
function Shortcut() {
  useSearchShortcut()
  return null
}

function open(url: string, withNav = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Shortcut />
        {withNav && <AppBar user={{ id: 'u1', email: 'a@b.fr', displayName: 'Alice', avatarUrl: null }} />}
        <Routes>
          <Route path="/recherche" element={<SearchPage />} />
          <Route path="*" element={<p>ailleurs</p>} />
        </Routes>
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
const where = () => screen.getByTestId('where').textContent
const pageField = () => screen.getAllByRole('searchbox', { name: /Rechercher dans tes playlists/ }).at(-1) as HTMLInputElement

describe('search page (YC-22)', () => {
  beforeEach(() => {
    results = RESULTS()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(results), { status: 200 })))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('lists playlists, videos and notes, the term marked whatever its case and accents', async () => {
    open('/recherche?q=useEffect')
    expect(await screen.findByRole('heading', { level: 1, name: 'Résultats pour « useEffect »' })).toBeInTheDocument()
    expect(await screen.findByText(/Recherche · 6 résultats · dans tes playlists et tes notes/i)).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Playlists', 'Vidéos', 'Notes'])
    const marks = [...document.querySelectorAll('mark')].map((m) => m.textContent)
    expect(marks).toContain('UseÉffect')
    expect(marks.filter((m) => m === 'useEffect').length).toBeGreaterThanOrEqual(4)
    expect(screen.getByText('JavaScript Mastery · 17 vidéos · 3/17 vues · le terme est dans 3 titres')).toBeInTheDocument()
    expect(screen.getByText('fullstack · vidéo 4 / 17 · 14:32')).toBeInTheDocument()
    expect(screen.getByText('● En cours')).toBeInTheDocument()
    expect(screen.getByText('✓ Vue')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/search?q=useEffect'), expect.anything())
  })

  it('a note line opens its video at its marker; the next line of that note says « Même note »', async () => {
    open('/recherche?q=useEffect')
    const notes = (await screen.findByRole('heading', { name: 'Notes' })).parentElement as HTMLElement
    const links = within(notes).getAllByRole('link')
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/playlists/p1/watch/yt4?t=245', '/playlists/p1/watch/yt4?t=520', '/playlists/p1'])
    expect(within(links[0]).getByText('Note de « useEffect en profondeur » · fullstack · repère 04:05')).toBeInTheDocument()
    expect(within(links[1]).getByText('Même note · repère 08:40')).toBeInTheDocument()
    expect(within(links[2]).getByText('Note de la playlist fullstack · section Plan')).toBeInTheDocument()
  })

  it('the filters show their counts, keep only their group, and are in the address', async () => {
    open('/recherche?q=useEffect')
    const filters = await screen.findByRole('group', { name: 'Filtrer les résultats' })
    expect(within(filters).getAllByRole('button').map((b) => b.textContent)).toEqual(['Tout · 6', 'Playlists · 1', 'Vidéos · 2', 'Notes · 3'])
    fireEvent.click(within(filters).getByRole('button', { name: 'Notes · 3' }))
    expect(where()).toBe('/recherche?q=useEffect&type=notes')
    expect(within(filters).getByRole('button', { name: 'Notes · 3' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('heading', { name: 'Vidéos' })).not.toBeInTheDocument()
  })

  it('nothing found: says so; under a filter, « Effacer les filtres » shows them all again', async () => {
    results = { ...RESULTS(), videos: { total: 0, items: [] } }
    open('/recherche?q=useEffect&type=videos')
    expect(await screen.findByRole('heading', { name: 'Aucun résultat pour « useEffect »' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Effacer les filtres' }))
    expect(where()).toBe('/recherche?q=useEffect')
    results = { query: 'zzz', playlists: { total: 0, items: [] }, videos: { total: 0, items: [] }, notes: { total: 0, items: [] } }
    fireEvent.change(pageField(), { target: { value: 'zzz' } })
    fireEvent.submit(pageField())
    expect(await screen.findByRole('heading', { name: 'Aucun résultat pour « zzz »' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Effacer les filtres' })).not.toBeInTheDocument()
  })

  it('one letter is not searched; the field waits for the term', async () => {
    open('/recherche?q=u')
    expect(screen.getByText(/Tape au moins 2 caractères/)).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('Entrée on the term shown opens the first result; Échap puts the term back', async () => {
    open('/recherche?q=useEffect&type=videos')
    await screen.findByRole('heading', { name: 'Vidéos' })
    fireEvent.change(pageField(), { target: { value: 'autre' } })
    // Not handled, Chrome would empty the field after the term is put back.
    expect(fireEvent.keyDown(pageField(), { key: 'Escape' })).toBe(false)
    expect(pageField().value).toBe('useEffect')
    fireEvent.submit(pageField())
    expect(where()).toBe('/playlists/p1/watch/yt4')
  })

  it('the field of the top bar searches, and shows the term of the page', async () => {
    open('/playlists/p1', true)
    const field = screen.getByRole('searchbox', { name: /Rechercher dans tes playlists/ })
    fireEvent.change(field, { target: { value: ' useEffect ' } })
    fireEvent.submit(field)
    expect(where()).toBe('/recherche?q=useEffect')
    await waitFor(() => expect(screen.getAllByRole('searchbox').every((f) => (f as HTMLInputElement).value === 'useEffect')).toBe(true))
  })

  it('« / » opens the search, never while typing', async () => {
    open('/ailleurs')
    const input = document.createElement('input')
    document.body.append(input)
    fireEvent.keyDown(input, { key: '/' })
    expect(where()).toBe('/ailleurs')
    fireEvent.keyDown(window, { key: '/' })
    expect(where()).toBe('/recherche')
    input.remove()
  })
})

describe('search helpers (YC-22)', () => {
  it('finds the term whatever its case and accents, in the text as written', () => {
    expect(matches('Un Élément clé, un element', 'element')).toEqual([[3, 10], [19, 26]])
    expect(matches('rien', '  ')).toEqual([])
  })

  it('?t= is a second of a video, or nothing', () => {
    expect(startAt(new URLSearchParams('t=245'))).toBe(245)
    expect(startAt(new URLSearchParams('t=-3'))).toBeNull()
    expect(startAt(new URLSearchParams('t=12.5'))).toBeNull()
    expect(startAt(new URLSearchParams('t=999999'))).toBeNull()
    expect(startAt(new URLSearchParams(''))).toBeNull()
  })
})
