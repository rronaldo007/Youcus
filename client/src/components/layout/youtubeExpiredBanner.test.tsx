import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppNav } from './AppNav'

const USER = { id: 'u1', email: 'a@b.fr', displayName: 'Ada', avatarUrl: null }

function renderNav(me: Record<string, unknown>, path = '/') {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ...USER, ...me }), { status: 200 })))
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <AppNav />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('« Connexion YouTube expirée » (YC-84, Figma 98:16852)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('under the bar when the token died, with « Reconnecter YouTube », and no way to close it', async () => {
    renderNav({ youtubeConnected: false, youtubeExpired: true })
    const banner = await screen.findByRole('alert')
    expect(banner).toHaveTextContent('Connexion YouTube expirée : reconnecte ton compte pour importer ou synchroniser. Tes notes ne sont pas concernées.')
    expect(screen.getByRole('button', { name: 'Reconnecter YouTube' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Fermer' })).not.toBeInTheDocument()
  })

  it('never connected, or connected: no banner', async () => {
    renderNav({ youtubeConnected: false, youtubeExpired: false })
    await screen.findAllByRole('navigation', { name: 'Principale' })
    expect(screen.queryByText(/Connexion YouTube expirée/)).not.toBeInTheDocument()
  })

  it('« Reconnecter YouTube » starts the YouTube sign-in', async () => {
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })
    renderNav({ youtubeExpired: true })
    ;(await screen.findByRole('button', { name: 'Reconnecter YouTube' })).click()
    expect(assign).toHaveBeenCalledWith(expect.stringContaining('/auth/google/youtube'))
  })
})
