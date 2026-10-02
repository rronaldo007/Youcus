import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { linkKind } from '@/lib/youtubeLink'
import { ImportModal } from './ImportModal'

const myPlaylists = [
  { youtubeId: 'p1', title: 'Cours React', thumbnailUrl: null, videoCount: 12, alreadyImported: false },
  { youtubeId: 'p2', title: 'Déjà là', thumbnailUrl: null, videoCount: 3, alreadyImported: true },
  { youtubeId: 'p3', title: 'Une seule', thumbnailUrl: null, videoCount: 1, alreadyImported: false },
]
let posts: { url: string; body: unknown }[]

function Where() {
  const l = useLocation()
  return <p data-testid="where">{l.pathname}</p>
}

function renderModal(initialEntries: string[] = ['/import']) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/import" element={<ImportModal />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const ME = { id: 'u1', email: 'a@b.fr', displayName: 'Ada', avatarUrl: null, youtubeConnected: true }
const me = () => new Response(JSON.stringify(ME), { status: 200 })
const quota = () => new Response(JSON.stringify({ error: 'Quota YouTube dépassé', code: 'youtube_quota' }), { status: 503 })

describe('ImportModal (YC-81)', () => {
  beforeEach(() => {
    posts = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          posts.push({ url, body: JSON.parse(init.body as string) })
          if (url.endsWith('/playlists/import')) return new Response(JSON.stringify({ id: 'pl9', youtubeId: 'PLx', title: 'X', thumbnailUrl: null, videoCount: 4 }), { status: 201 })
          if (url.endsWith('/library/videos')) return new Response(JSON.stringify({ id: 'v9', youtubeId: 'dQw4w9WgXcQ', title: 'V' }), { status: 201 })
          return new Response(JSON.stringify({ imported: 1 }), { status: 201 })
        }
        if (url.endsWith('/auth/me')) return me()
        return new Response(JSON.stringify(myPlaylists), { status: 200 })
      }),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('the account playlists are added one by one, the imported one says so, the button counts them', async () => {
    renderModal()
    const list = await screen.findByRole('list', { name: 'Mes playlists YouTube' })
    expect(within(list).getByText('12 vidéos')).toBeInTheDocument()
    expect(within(list).getByText('1 vidéo')).toBeInTheDocument()
    expect(within(list).getByText('✓ Déjà importée')).toBeInTheDocument()
    // Already imported: nothing to add.
    expect(within(list).queryByRole('button', { name: /Déjà là/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Importer' })).toBeDisabled()

    fireEvent.click(within(list).getByRole('button', { name: 'Ajouter Cours React' }))
    fireEvent.click(within(list).getByRole('button', { name: 'Ajouter Une seule' }))
    expect(within(list).getByRole('button', { name: 'Retirer Cours React' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Importer 2 playlists' }))

    await waitFor(() => expect(posts).toEqual([{ url: expect.stringContaining('/playlists/import-batch'), body: { playlistIds: ['p1', 'p3'] } }]))
  })

  it('a playlist link is imported and opens its page; a video link is kept on its own and plays', async () => {
    renderModal()
    const field = await screen.findByLabelText('Lien d’une playlist ou d’une vidéo')
    fireEvent.change(field, { target: { value: 'https://www.youtube.com/playlist?list=PLabcdefghijk' } })
    fireEvent.click(screen.getByRole('button', { name: 'Importer le lien' }))
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/playlists/pl9'))
    expect(posts[0]).toEqual({ url: expect.stringContaining('/playlists/import'), body: { url: 'https://www.youtube.com/playlist?list=PLabcdefghijk' } })
  })

  it('a video link: « Ajouter la vidéo », then its player', async () => {
    renderModal()
    const field = await screen.findByLabelText('Lien d’une playlist ou d’une vidéo')
    fireEvent.change(field, { target: { value: 'youtu.be/dQw4w9WgXcQ' } })
    fireEvent.submit(field)
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/videos/dQw4w9WgXcQ'))
    expect(posts[0].url).toContain('/library/videos')
  })

  it('a link that is neither: the field says why, nothing is sent (Figma 98:27453)', async () => {
    renderModal()
    const field = await screen.findByLabelText('Lien d’une playlist ou d’une vidéo')
    fireEvent.change(field, { target: { value: 'https://vimeo.com/123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Importer le lien' }))
    expect(screen.getByText(/ni une playlist ni une vidéo YouTube/)).toBeInTheDocument()
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(posts).toHaveLength(0)
    // Typing again clears it.
    fireEvent.change(field, { target: { value: 'https://vimeo.com/1234' } })
    expect(screen.queryByText(/ni une playlist ni une vidéo YouTube/)).not.toBeInTheDocument()
  })

  it('the daily quota reached: says when it comes back, the field and the list give way (Figma 98:27737)', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (url.endsWith('/auth/me') ? me() : quota())))
    renderModal()
    expect(await screen.findByRole('heading', { name: 'Quota YouTube du jour atteint' })).toBeInTheDocument()
    expect(screen.getByText(/Ça reprend à \d\d:\d\d, heure de Paris/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Lien d’une playlist ou d’une vidéo')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voir mes playlists' })).toHaveAttribute('href', '/')
  })

  it('propose de connecter YouTube (vers /auth/google/youtube) quand l’accès n’est pas encore accordé', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (url.endsWith('/auth/me') ? me() : new Response('forbidden', { status: 403 }))))
    renderModal()
    const cta = await screen.findByRole('link', { name: 'Connecter YouTube' })
    expect(cta).toHaveAttribute('href', expect.stringContaining('/auth/google/youtube'))
    // The link field still works without the account.
    expect(screen.getByLabelText('Lien d’une playlist ou d’une vidéo')).toBeInTheDocument()
  })

  it('affiche le message de retour du flux YouTube (?youtube=denied)', async () => {
    renderModal(['/import?youtube=denied'])
    expect(await screen.findByRole('alert')).toHaveTextContent(/refusé/i)
  })

  it('without a session: the sign-in page, not the window', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Authentification requise' }), { status: 401 })))
    renderModal()
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/login'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Échap and the veil close it', async () => {
    renderModal()
    const dialog = await screen.findByRole('dialog', { name: 'Importer des playlists' })
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.getByTestId('where')).toHaveTextContent('/')
  })
})

describe('linkKind (YC-81)', () => {
  it('a playlist (list=, or a bare id), a video, or nothing', () => {
    expect(linkKind('https://www.youtube.com/playlist?list=PLabc123')).toBe('playlist')
    expect(linkKind('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLabc123')).toBe('playlist')
    expect(linkKind('PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf')).toBe('playlist')
    expect(linkKind('https://youtu.be/dQw4w9WgXcQ')).toBe('video')
    expect(linkKind('https://vimeo.com/123')).toBeNull()
    expect(linkKind('bonjour')).toBeNull()
  })
})
