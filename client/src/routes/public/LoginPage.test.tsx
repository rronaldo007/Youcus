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
