import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { RouterProvider, createMemoryRouter, type NonIndexRouteObject, type RouteObject } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '@/appRoutes'
import type { User } from '@/types'

// The pages of YC-83: an address the app does not know, and a screen that broke.

const broken = vi.hoisted(() => ({ layout: false }))
vi.mock('@/components/layout/RootLayout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/layout/RootLayout')>()
  return {
    RootLayout: () => {
      if (broken.layout) throw new Error('the layout broke')
      return <actual.RootLayout />
    },
  }
})

const user: User = { id: 'u1', email: 'alice@exemple.fr', displayName: 'Alice Martin', avatarUrl: null }

function Boom(): never {
  throw new Error('a page broke')
}

/** The real routes, plus one page that throws while it is drawn. */
function withBrokenPage(): RouteObject[] {
  const root = routes[0] as NonIndexRouteObject
  const pages = root.children?.[0] as NonIndexRouteObject
  const withBoom: RouteObject = { ...pages, children: [...(pages.children ?? []), { path: '/boom', element: <Boom /> }] }
  return [{ ...root, children: [withBoom] }]
}

function open(path: string, signedIn: boolean) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      String(url).endsWith('/auth/me') && signedIn
        ? new Response(JSON.stringify(user), { status: 200 })
        : new Response(JSON.stringify({ error: 'Non authentifié' }), { status: 401 }),
    ),
  )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={createMemoryRouter(withBrokenPage(), { initialEntries: [path] })} />
    </QueryClientProvider>,
  )
}

describe('an address the app does not know (YC-83)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('signed in: under the bar of the app, back to the dashboard or to the search', async () => {
    open('/nulle-part', true)
    const main = await screen.findByRole('main')
    expect(await within(main).findByRole('heading', { name: 'Cette page n’existe pas' })).toBeInTheDocument()
    expect(within(main).getByText(/la playlist a été retirée de tes playlists/)).toBeInTheDocument()
    expect(within(main).getByRole('link', { name: 'Retour au tableau de bord' })).toHaveAttribute('href', '/')
    expect(within(main).getByRole('link', { name: 'Rechercher' })).toHaveAttribute('href', '/recherche')
    // The bar of the app is there: its tabs.
    expect(screen.getByRole('navigation', { name: 'Principale' })).toBeInTheDocument()
    // The frame's « Voir le catalogue »: the catalogue does not exist yet (YC-65).
    expect(within(main).queryByText(/catalogue/i)).not.toBeInTheDocument()
  })

  it('signed out: the public navigation, back to the home page, and no search nor playlists', async () => {
    open('/playlists/abc/nulle-part', false)
    const main = await screen.findByRole('main')
    expect(await within(main).findByRole('heading', { name: 'Cette page n’existe pas' })).toBeInTheDocument()
    expect(within(main).getByRole('link', { name: 'Retour à l’accueil' })).toHaveAttribute('href', '/')
    expect(within(main).queryByText('Rechercher')).not.toBeInTheDocument()
    expect(within(main).queryByText(/tes playlists/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Youcus, accueil' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Principale' })).not.toBeInTheDocument()
  })
})

describe('a screen that broke (YC-83)', () => {
  beforeEach(() => {
    // React and the page itself report the error on the console: expected here.
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    broken.layout = false
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('a page: the error under the bar, nothing it cannot know, the address to write to', async () => {
    open('/boom', true)
    const alert = await screen.findByRole('alert')
    expect(within(alert).getByRole('heading', { name: 'Quelque chose a cassé de notre côté' })).toBeInTheDocument()
    expect(alert).toHaveTextContent('Ce qui était déjà enregistré l’est toujours.')
    // The frame said « tes notes sont enregistrées » and « dans les réglages »: neither is sure.
    expect(alert).not.toHaveTextContent(/notes sont enregistrées|réglages/)
    expect(within(alert).getByRole('link', { name: 'rukundoronaldo4@gmail.com' })).toHaveAttribute('href', 'mailto:rukundoronaldo4@gmail.com')
    expect(within(alert).getByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
    expect(within(alert).getByRole('link', { name: 'Retour au tableau de bord' })).toHaveAttribute('href', '/')
    expect(screen.queryByRole('link', { name: 'Retour à l’accueil' })).not.toBeInTheDocument()
    expect(await screen.findByRole('navigation', { name: 'Principale' })).toBeInTheDocument()
  })

  it('a page, signed out: the public navigation and back to the home page', async () => {
    open('/boom', false)
    const alert = await screen.findByRole('alert')
    expect(await within(alert).findByRole('link', { name: 'Retour à l’accueil' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Youcus, accueil' })).toBeInTheDocument()
  })

  it('the layout itself: the same page, with nothing of the app that could break again', async () => {
    broken.layout = true
    open('/', true)
    const alert = await screen.findByRole('alert')
    expect(within(alert).getByRole('heading', { name: 'Quelque chose a cassé de notre côté' })).toBeInTheDocument()
    expect(await within(alert).findByRole('link', { name: 'Retour au tableau de bord' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Youcus, accueil' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Principale' })).not.toBeInTheDocument()
  })
})
