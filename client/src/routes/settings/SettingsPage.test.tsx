import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsPage } from './SettingsPage'

const USER = { id: 'u1', email: 'jane@example.com', displayName: 'Jane Doe', avatarUrl: null }

function renderSettings() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/settings']}>
        <SettingsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SettingsPage', () => {
  beforeEach(() => {
    localStorage.setItem('youcus-theme', 'light')
    document.documentElement.classList.remove('dark')
    // Session présente → /auth/me renvoie l'utilisateur.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(USER), { status: 200 })),
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  it('affiche le profil (nom + email) de l’utilisateur connecté', async () => {
    renderSettings()
    expect(await screen.findByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('jane@example.com')).toBeInTheDocument()
  })

  it('expose le choix de thème et bascule en sombre', async () => {
    renderSettings()
    const dark = await screen.findByRole('button', { name: /Sombre/i })
    expect(screen.getByRole('button', { name: /Clair/i })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(dark)

    await waitFor(() => expect(dark).toHaveAttribute('aria-pressed', 'true'))
    expect(localStorage.getItem('youcus-theme')).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('héberge la zone RGPD (export + suppression) désactivée en attente de CS-22', async () => {
    renderSettings()
    expect(await screen.findByText(/Exporter mes données/i)).toBeInTheDocument()
    expect(screen.getByText(/Supprimer mon compte/i)).toBeInTheDocument()
    const actions = screen.getAllByRole('button', { name: /Bientôt/i })
    expect(actions).toHaveLength(2)
    actions.forEach((b) => expect(b).toBeDisabled())
  })
})
