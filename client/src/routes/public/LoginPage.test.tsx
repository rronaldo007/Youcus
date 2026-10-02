import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginPage } from './LoginPage'

function renderLogin(initialEntries: string[] = ['/login']) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={initialEntries}>
        <LoginPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    // Session absente → 401 → visiteur non connecté → l'écran s'affiche.
    vi.stubGlobal('fetch', vi.fn(async () => new Response('unauthorized', { status: 401 })))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('links to the privacy policy (YC-38)', async () => {
    renderLogin()
    const link = await screen.findByRole('link', { name: 'politique de confidentialité' })
    expect(link).toHaveAttribute('href', '/confidentialite')
  })

  it('makes the visitor accept no terms of use, since Youcus has none (YC-73)', async () => {
    const { container } = renderLogin()
    await screen.findByRole('heading', { level: 1, name: 'Ton cahier t’attend.' })
    expect(container.textContent).not.toMatch(/conditions d.utilisation/i)
  })

  it('says the sign-in asks for identity only, YouTube read-only comes later (YC-73)', async () => {
    renderLogin()
    expect(await screen.findByText(/On ne demande que ton identité/)).toHaveTextContent('lecture seule')
  })

  it('keeps the brand half dark in both themes (Figma 21:538, 47:8950)', async () => {
    renderLogin()
    const promise = await screen.findByText('Regarde moins.')
    expect(promise.closest('.dark')).not.toBeNull()
    // The card follows the theme: it is outside the forced-dark half.
    expect(screen.getByRole('heading', { level: 1 }).closest('.dark')).toBeNull()
  })

  it('offers the way home and the theme switch the old screen had', async () => {
    renderLogin()
    expect(await screen.findByRole('link', { name: 'Youcus, accueil' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('button', { name: /Activer le thème/ })).toBeInTheDocument()
  })

  it('propose la connexion Google (vers /auth/google)', async () => {
    renderLogin()
    const cta = await screen.findByRole('link', { name: /Continuer avec Google/i })
    expect(cta).toHaveAttribute('href', expect.stringContaining('/auth/google'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('affiche un message quand la connexion a été refusée (?auth=denied)', async () => {
    renderLogin(['/login?auth=denied'])
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/annulée/i))
  })
})
