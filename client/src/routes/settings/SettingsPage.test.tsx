import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsPage } from './SettingsPage'

const USER = { id: 'u1', email: 'jane@example.com', displayName: 'Jane Doe', avatarUrl: null }

function renderSettings() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
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
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(USER), { status: 200 })),
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
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

  it('exporte les données : le clic déclenche un GET /account/export', async () => {
    // La voie de téléchargement utilise des API absentes de jsdom : on les neutralise.
    ;(URL as unknown as { createObjectURL: () => string }).createObjectURL = vi.fn(() => 'blob:x')
    ;(URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    renderSettings()
    fireEvent.click(await screen.findByRole('button', { name: /^Exporter$/i }))

    await waitFor(() =>
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        expect.stringContaining('/account/export'),
        expect.objectContaining({ credentials: 'include' }),
      ),
    )
  })

  it('supprime le compte après confirmation : DELETE /account', async () => {
    renderSettings()
    // Étape 1 : révéler la confirmation.
    fireEvent.click(await screen.findByRole('button', { name: /^Supprimer$/i }))
    // Étape 2 : confirmer.
    fireEvent.click(screen.getByRole('button', { name: /Confirmer la suppression/i }))

    await waitFor(() =>
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        expect.stringContaining('/account'),
        expect.objectContaining({ method: 'DELETE' }),
      ),
    )
  })
})
