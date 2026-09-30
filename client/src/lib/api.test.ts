import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiFetch } from './api'

function mockFetch(status: number, body: string, contentType = 'application/json') {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(body, { status, headers: { 'Content-Type': contentType } })),
  )
}

async function failure(): Promise<ApiError> {
  try {
    await apiFetch('/playlists/p1/refresh', { method: 'POST' })
  } catch (err) {
    return err as ApiError
  }
  throw new Error('apiFetch should have thrown')
}

describe('apiFetch errors (YC-12)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it("shows the server's message on a 4xx", async () => {
    mockFetch(403, JSON.stringify({ error: 'Connectez votre compte YouTube' }))
    const err = await failure()
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(403)
    expect(err.message).toBe('Connectez votre compte YouTube')
  })

  it('never shows the message of a 5xx, which can be an internal detail', async () => {
    mockFetch(500, JSON.stringify({ error: 'Invalid `prisma.playlist.update()` invocation' }))
    expect((await failure()).message).toBe('Requête échouée (500)')
  })

  it('falls back to the status when the body is not JSON', async () => {
    mockFetch(404, '<html>Not found</html>', 'text/html')
    expect((await failure()).message).toBe('Requête échouée (404)')
  })

  it('falls back to the status when the JSON has no usable error', async () => {
    mockFetch(400, JSON.stringify({ error: '  ' }))
    expect((await failure()).message).toBe('Requête échouée (400)')
  })
})
