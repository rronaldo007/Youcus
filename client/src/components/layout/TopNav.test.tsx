import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TopNav } from './TopNav'
import type { User } from '@/types'

const user: User = { id: 'u1', email: 'a@b.fr', displayName: 'Alice', avatarUrl: null }

function renderTopNav() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <TopNav user={user} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('TopNav', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('affiche le logo, les liens et le bouton Importer', () => {
    renderTopNav()
    expect(screen.getByText('Youcus')).toBeInTheDocument()
    expect(screen.getByText('Tableau de bord')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /\+ Importer/i })).toBeInTheDocument()
  })

  it('ouvre le menu utilisateur et déconnecte via /auth/logout', async () => {
    renderTopNav()
    fireEvent.click(screen.getByRole('button', { name: /Menu utilisateur/i }))
    const logoutBtn = screen.getByRole('menuitem', { name: /Se déconnecter/i })
    fireEvent.click(logoutBtn)
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/logout'),
        expect.objectContaining({ method: 'POST' }),
      ),
    )
  })
})
