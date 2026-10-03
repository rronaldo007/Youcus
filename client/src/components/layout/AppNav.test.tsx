import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppBar } from './AppNav'
import { PublicFooter } from './PublicFooter'
import { PublicNav } from './PublicNav'
import type { User } from '@/types'

const user: User = { id: 'u1', email: 'alice@exemple.fr', displayName: 'Alice Martin', avatarUrl: null }

function Where() {
  const { pathname, hash } = useLocation()
  return <p data-testid="where">{pathname + hash}</p>
}

function renderBar(path = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <AppBar user={user} />
        <Routes>
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

// jsdom shows both the computer bar and the phone bar (no media queries): take the first of each.
const first = (role: string, name: RegExp | string) => screen.getAllByRole(role as 'link', { name })[0]

describe('AppBar (Figma 5:433)', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('marks the dashboard as the current page, also under a playlist', () => {
    renderBar('/playlists/p1')
    const nav = screen.getAllByRole('navigation', { name: 'Principale' })[0]
    expect(within(nav).getByRole('link', { name: 'Tableau de bord' })).toHaveAttribute('aria-current', 'page')
  })

  it('shows the tabs without a page greyed and says why, never as a dead link', () => {
    renderBar()
    const nav = screen.getAllByRole('navigation', { name: 'Principale' })[0]
    for (const label of ['Catalogue']) {
      expect(within(nav).queryByRole('link', { name: new RegExp(label) })).not.toBeInTheDocument()
      const tab = within(nav).getByText(label)
      expect(tab).toHaveAttribute('aria-disabled', 'true')
      expect(tab).toHaveTextContent('Bientôt disponible')
    }
  })

  it('« Statistiques » leads to its page, and is lit there (YC-79)', () => {
    renderBar('/statistiques')
    const nav = screen.getAllByRole('navigation', { name: 'Principale' })[0]
    expect(within(nav).getByRole('link', { name: 'Statistiques' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Statistiques' })).toHaveAttribute('href', '/statistiques')
  })

  it('« Mes notes » leads to every note, and stays lit on a note page (YC-78)', () => {
    renderBar('/notes/videos/v1')
    const nav = screen.getAllByRole('navigation', { name: 'Principale' })[0]
    const tab = within(nav).getByRole('link', { name: 'Mes notes' })
    expect(tab).toHaveAttribute('href', '/notes')
    expect(tab).toHaveAttribute('aria-current', 'page')
  })

  it('keeps every former access: import, search, the dashboard by the logo', () => {
    renderBar('/settings')
    expect(first('link', '+ Importer')).toHaveAttribute('href', '/import')
    expect(first('link', 'Importer une playlist')).toHaveAttribute('href', '/import')
    expect(first('link', 'Rechercher')).toHaveAttribute('href', '/recherche')
    expect(screen.getByRole('searchbox', { name: /Rechercher dans tes playlists/ })).toBeInTheDocument()
    expect(first('link', 'Youcus, tableau de bord')).toHaveAttribute('href', '/')
  })
})

describe('AccountMenu (Figma 108:142)', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('shows who is signed in, leads to the settings and to the data export', () => {
    renderBar()
    const avatar = first('button', 'Compte de Alice Martin')
    fireEvent.click(avatar)
    expect(avatar).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('alice@exemple.fr')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Réglages' })).toHaveAttribute('href', '/settings')
    fireEvent.click(screen.getByRole('link', { name: 'Mes données' }))
    expect(screen.getByTestId('where')).toHaveTextContent('/settings#donnees')
    expect(screen.queryByText('alice@exemple.fr')).not.toBeInTheDocument()
  })

  it('signs out through /auth/logout', async () => {
    renderBar()
    fireEvent.click(first('button', 'Compte de Alice Martin'))
    fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/auth/logout'), expect.objectContaining({ method: 'POST' })),
    )
  })

  it('closes on Échap and gives the focus back to the avatar', () => {
    renderBar()
    const avatar = first('button', 'Compte de Alice Martin')
    fireEvent.click(avatar)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByText('alice@exemple.fr')).not.toBeInTheDocument()
    expect(avatar).toHaveFocus()
  })

  it('chooses Clair, Sombre or Auto, and the bar button follows at once', () => {
    renderBar()
    fireEvent.click(first('button', 'Compte de Alice Martin'))
    fireEvent.click(screen.getByRole('radio', { name: 'Sombre' }))
    expect(document.documentElement).toHaveClass('dark')
    expect(localStorage.getItem('youcus-theme')).toBe('dark')
    // The other control shows the same state: one store for the app.
    expect(first('button', 'Activer le thème clair')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Auto' }))
    expect(screen.getByRole('radio', { name: 'Auto' })).toHaveAttribute('aria-checked', 'true')
    expect(localStorage.getItem('youcus-theme')).toBe('system')
    // The test system is light (matchMedia stub): Auto follows it.
    expect(document.documentElement).not.toHaveClass('dark')
  })
})

describe('NavDrawer (Figma 108:325)', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 }))))
  afterEach(() => vi.unstubAllGlobals())

  it('opens from ☰, closes on Échap, gives the focus back to ☰', () => {
    renderBar()
    const burger = screen.getByRole('button', { name: 'Ouvrir le menu' })
    burger.focus()
    fireEvent.click(burger)
    const drawer = screen.getByRole('dialog', { name: 'Menu' })
    expect(within(drawer).getByRole('button', { name: 'Fermer le menu' })).toHaveFocus()
    // Catalogue only: Mes notes has its page since YC-78, Statistiques since YC-79.
    expect(within(drawer).getAllByText('Bientôt')).toHaveLength(1)
    fireEvent.keyDown(within(drawer).getByRole('button', { name: 'Fermer le menu' }), { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument()
    expect(burger).toHaveFocus()
  })

  it('closes once a link is followed', () => {
    renderBar('/settings')
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le menu' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Menu' })).getByRole('link', { name: 'Tableau de bord' }))
    expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument()
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/$/)
  })
})

describe('Public navigation and footer (Figma 87:59, 87:60)', () => {
  it('opens the app, and keeps the privacy page within reach', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <PublicNav />
        <PublicFooter />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'Ouvrir l’app' })).toHaveAttribute('href', '/login')
    expect(screen.getByRole('link', { name: 'Accueil' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Le créateur' })).toHaveAttribute('href', '/le-createur')
    expect(screen.getByRole('link', { name: 'Ce qu’on corrige' })).toHaveAttribute('href', '/ce-qu-on-corrige')
    expect(screen.getByRole('link', { name: 'À propos' })).toHaveAttribute('href', '/a-propos')
    expect(screen.getByRole('link', { name: 'Confidentialité' })).toHaveAttribute('href', '/confidentialite')
  })
})
