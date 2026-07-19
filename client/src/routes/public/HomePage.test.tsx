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
    // Session absente → 401 → visiteur non connecté → landing.
    vi.stubGlobal('fetch', vi.fn(async () => new Response('unauthorized', { status: 401 })))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('affiche la landing (hero + CTA Google) quand on est déconnecté', async () => {
    renderWithClient(<HomePage />)
    expect(
      await screen.findByRole('heading', { level: 1, name: /sans les distractions/i }),
    ).toBeInTheDocument()
    expect(screen.getAllByText(/Continuer avec Google/i).length).toBeGreaterThan(0)
  })
})
