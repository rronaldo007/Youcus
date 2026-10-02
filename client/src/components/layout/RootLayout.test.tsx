import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RootLayout } from './RootLayout'

describe('RootLayout (YC-76)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  it('applies the chosen theme on a page without the bar, the player opened by a link', () => {
    localStorage.setItem('youcus-theme', 'dark')
    vi.stubGlobal('fetch', vi.fn(async () => new Response('unauthorized', { status: 401 })))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/playlists/p1/watch/abc']}>
          <Routes>
            <Route element={<RootLayout />}>
              <Route path="/playlists/:id/watch/:videoId" element={<p>lecteur</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(document.documentElement).toHaveClass('dark')
  })
})
