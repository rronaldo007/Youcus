import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import request from 'supertest'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

/**
 * YC-11: the API serves the built client, so front and API share one origin and the session
 * cookie is first-party (Lax) on mobile. Without CLIENT_DIST (dev), nothing changes.
 */

let dist = ''
const ENV_KEYS = ['NODE_ENV', 'CLIENT_DIST', 'SESSION_SECRET', 'SESSION_SAMESITE'] as const
const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]))

beforeAll(() => {
  dist = mkdtempSync(path.join(tmpdir(), 'youcus-dist-'))
  writeFileSync(path.join(dist, 'index.html'), '<!doctype html><div id="root"></div>')
  mkdirSync(path.join(dist, 'assets'))
  writeFileSync(path.join(dist, 'assets', 'index-abc123.js'), 'console.log(1)')
})

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

async function loadApp(env: { NODE_ENV: string; CLIENT_DIST?: string }) {
  vi.resetModules()
  process.env.NODE_ENV = env.NODE_ENV
  process.env.SESSION_SECRET = 'secret-de-test-assez-long'
  if (env.CLIENT_DIST) process.env.CLIENT_DIST = env.CLIENT_DIST
  else delete process.env.CLIENT_DIST
  const { createApp } = await import('@/app')
  return createApp()
}

function sessionCookie(res: request.Response): string {
  const cookies = res.headers['set-cookie'] as unknown as string[]
  return cookies.find((c) => c.startsWith('youcus_session=')) ?? ''
}

describe('serving the client (YC-11)', () => {
  it('answers every page with index.html, never cached, so deep links work', async () => {
    const app = await loadApp({ NODE_ENV: 'test', CLIENT_DIST: dist })
    for (const url of ['/', '/playlists/p1/watch/abc']) {
      const res = await request(app).get(url)
      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toContain('text/html')
      expect(res.headers['cache-control']).toBe('no-cache')
      expect(res.text).toContain('id="root"')
    }
  })

  it('caches hashed assets for a year, and a missing asset is a 404, not index.html', async () => {
    const app = await loadApp({ NODE_ENV: 'test', CLIENT_DIST: dist })
    const asset = await request(app).get('/assets/index-abc123.js')
    expect(asset.status).toBe(200)
    expect(asset.headers['cache-control']).toContain('immutable')

    const missing = await request(app).get('/assets/gone.js')
    expect(missing.status).toBe(404)
    expect(missing.headers['content-type']).toContain('application/json')
  })

  it('keeps unknown API routes as JSON 404s', async () => {
    const app = await loadApp({ NODE_ENV: 'test', CLIENT_DIST: dist })
    const res = await request(app).get('/api/nope')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'Ressource introuvable' })
  })

  it('lets the YouTube player and images through the CSP, nothing wider', async () => {
    const app = await loadApp({ NODE_ENV: 'test', CLIENT_DIST: dist })
    const csp = (await request(app).get('/')).headers['content-security-policy'] as string
    expect(csp).toContain("script-src 'self' https://www.youtube.com")
    expect(csp).toContain('frame-src https://www.youtube.com')
    expect(csp).toContain('https://i.ytimg.com')
    expect(csp).toContain("default-src 'self'")
  })

  it('serves nothing without CLIENT_DIST: in dev, Vite serves the client', async () => {
    const app = await loadApp({ NODE_ENV: 'test' })
    expect((await request(app).get('/')).status).toBe(404)
  })

  it('treats an empty CLIENT_DIST as unset instead of refusing to boot', async () => {
    vi.resetModules()
    process.env.NODE_ENV = 'test'
    process.env.CLIENT_DIST = ''
    const { createApp } = await import('@/app')
    expect((await request(createApp()).get('/')).status).toBe(404)
  })
})

describe('session cookie SameSite (YC-11)', () => {
  it('stays None; Secure in production by default, so the old front keeps working', async () => {
    const app = await loadApp({ NODE_ENV: 'production', CLIENT_DIST: dist })
    const cookie = sessionCookie(await request(app).post('/api/auth/logout'))
    expect(cookie).toContain('SameSite=None')
    expect(cookie).toContain('Secure')
  })

  it('becomes Lax once SESSION_SAMESITE=lax, when the old address is retired', async () => {
    process.env.SESSION_SAMESITE = 'lax'
    const app = await loadApp({ NODE_ENV: 'production', CLIENT_DIST: dist })
    const cookie = sessionCookie(await request(app).post('/api/auth/logout'))
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toContain('Secure')
  })

  it('is Lax in development', async () => {
    const app = await loadApp({ NODE_ENV: 'development' })
    const cookie = sessionCookie(await request(app).post('/api/auth/logout'))
    expect(cookie).toContain('SameSite=Lax')
  })
})
