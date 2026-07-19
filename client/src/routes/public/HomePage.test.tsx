import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HomePage } from './HomePage'

function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('HomePage', () => {
  beforeEach(() => {
    // Session absente → /auth/me renvoie 401 → utilisateur déconnecté.
    vi.stubGlobal('fetch', vi.fn(async () => new Response('unauthorized', { status: 401 })))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('affiche le titre et le bouton de connexion quand on est déconnecté', async () => {
    renderWithClient(<HomePage />)
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(await screen.findByText(/Se connecter avec Google/i)).toBeInTheDocument()
  })
})
