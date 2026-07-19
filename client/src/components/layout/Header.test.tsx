import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Header } from './Header'
import type { User } from '@/types'

const user: User = { id: 'u1', email: 'a@b.fr', displayName: 'Alice', avatarUrl: null }

function renderHeader() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  // Session connue : on préremplit le cache pour que useCurrentUser renvoie l'utilisateur.
  client.setQueryData(['auth', 'me'], user)
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Header', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('affiche le nom et le bouton de déconnexion quand on est connecté', () => {
    renderHeader()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Se déconnecter/i })).toBeInTheDocument()
  })

  it('appelle /auth/logout au clic sur Se déconnecter', async () => {
    renderHeader()
    fireEvent.click(screen.getByRole('button', { name: /Se déconnecter/i }))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/logout'),
        expect.objectContaining({ method: 'POST' }),
      ),
    )
  })
})
