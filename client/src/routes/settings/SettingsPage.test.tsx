import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsPage } from './SettingsPage'

const USER = { id: 'u1', email: 'jane@example.com', displayName: 'Jane Doe', avatarUrl: null, youtubeConnected: false }
let user: typeof USER
let revoked: boolean

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
    user = { ...USER }
    revoked = true
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.endsWith('/auth/youtube') && init?.method === 'DELETE') {
          user = { ...user, youtubeConnected: false }
          return new Response(JSON.stringify({ revoked }), { status: 200 })
        }
        if (url.endsWith('/account/note-preferences')) return new Response(JSON.stringify({ paper: 'lignes', tint: 'creme', margin: true, timestamps: true, font: 'hanken', size: 16 }), { status: 200 })
        return new Response(JSON.stringify(user), { status: 200 })
      }),
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

  it('expose le choix de thème (Clair, Sombre, Comme le système) et bascule en sombre', async () => {
    renderSettings()
    const group = await screen.findByRole('radiogroup', { name: 'Thème' })
    expect(within(group).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Clair', 'Sombre', 'Comme le système'])
    const dark = within(group).getByRole('radio', { name: 'Sombre' })
    expect(within(group).getByRole('radio', { name: 'Clair' })).toHaveAttribute('aria-checked', 'true')

    fireEvent.click(dark)

    await waitFor(() => expect(dark).toHaveAttribute('aria-checked', 'true'))
    expect(localStorage.getItem('youcus-theme')).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('exporte les données : le clic déclenche un GET /account/export', async () => {
    // La voie de téléchargement utilise des API absentes de jsdom : on les neutralise.
    ;(URL as unknown as { createObjectURL: () => string }).createObjectURL = vi.fn(() => 'blob:x')
    ;(URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    renderSettings()
    fireEvent.click(await screen.findByRole('button', { name: 'Exporter mes données' }))

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
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer mon compte' }))
    // Étape 2 : confirmer.
    fireEvent.click(screen.getByRole('button', { name: /Confirmer la suppression/i }))

    await waitFor(() =>
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        expect.stringContaining('/account'),
        expect.objectContaining({ method: 'DELETE' }),
      ),
    )
  })

  it('lists its sections, the first one current; « Objectif de la semaine » waits for YC-79', async () => {
    renderSettings()
    const nav = await screen.findByRole('navigation', { name: 'Sections des réglages' })
    const links = within(nav).getAllByRole('link')
    expect(links.map((l) => l.textContent)).toEqual(['Compte', 'YouTube', 'Apparence', 'Notes', 'Données'])
    expect(links[4]).toHaveAttribute('href', '/settings#donnees')
    expect(links[0]).toHaveAttribute('aria-current', 'true')
    expect(screen.queryByText(/Objectif de la semaine/)).not.toBeInTheDocument()
  })

  it('YouTube not connected: says so and offers to connect', async () => {
    renderSettings()
    const card = (await screen.findByRole('heading', { name: 'Connexion YouTube' })).parentElement as HTMLElement
    expect(within(card).getByText(/Non connecté/)).toBeInTheDocument()
    expect(within(card).getByRole('link', { name: 'Connecter YouTube' })).toHaveAttribute('href', expect.stringContaining('/auth/google/youtube'))
    expect(within(card).queryByRole('button', { name: 'Déconnecter YouTube' })).not.toBeInTheDocument()
  })

  it('YouTube connected: « Déconnecter » asks first, then DELETE /auth/youtube, and the card says it is done', async () => {
    user = { ...USER, youtubeConnected: true }
    renderSettings()
    const card = (await screen.findByRole('heading', { name: 'Connexion YouTube' })).parentElement as HTMLElement
    expect(within(card).getByText('Connecté · accès en lecture seule')).toBeInTheDocument()
    fireEvent.click(within(card).getByRole('button', { name: 'Déconnecter YouTube' }))
    // Nothing is sent before the confirmation.
    expect(vi.mocked(fetch).mock.calls.some(([u]) => String(u).endsWith('/auth/youtube'))).toBe(false)
    fireEvent.click(within(card).getByRole('button', { name: 'Confirmer la déconnexion' }))
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledWith(expect.stringContaining('/auth/youtube'), expect.objectContaining({ method: 'DELETE' })))
    expect(await within(card).findByText('YouTube déconnecté.')).toBeInTheDocument()
    expect(within(card).getByRole('link', { name: 'Connecter YouTube' })).toBeInTheDocument()
  })

  it('Google did not confirm the revocation: the card says where to check', async () => {
    user = { ...USER, youtubeConnected: true }
    revoked = false
    renderSettings()
    const card = (await screen.findByRole('heading', { name: 'Connexion YouTube' })).parentElement as HTMLElement
    fireEvent.click(within(card).getByRole('button', { name: 'Déconnecter YouTube' }))
    fireEvent.click(within(card).getByRole('button', { name: 'Confirmer la déconnexion' }))
    expect(await within(card).findByText(/Google n’a pas confirmé/)).toBeInTheDocument()
  })

  it('YouTube expired (YC-84): says so and offers to reconnect', async () => {
    user = { ...USER, youtubeConnected: false, youtubeExpired: true } as typeof USER
    renderSettings()
    const card = (await screen.findByRole('heading', { name: 'Connexion YouTube' })).parentElement as HTMLElement
    expect(within(card).getByText(/Connexion expirée/)).toBeInTheDocument()
    expect(within(card).getByRole('link', { name: 'Reconnecter YouTube' })).toHaveAttribute('href', expect.stringContaining('/auth/google/youtube'))
  })
})

