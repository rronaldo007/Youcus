import { createHmac } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'

/**
 * Les deux points d'entrée du flux Google :
 * - `/auth/google` (connexion) ne demande jamais le scope YouTube ;
 * - `/auth/google/youtube` le demande, mais seulement à un utilisateur déjà connecté.
 */

const SECRET = 'secret-de-test-assez-long'
const CALLBACK = 'http://localhost:4000/api/auth/google/callback'
const YOUTUBE_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly'

vi.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: vi.fn(), upsert: vi.fn() } } }))

async function loadApp() {
  vi.resetModules()
  process.env.NODE_ENV = 'test'
  process.env.SESSION_SECRET = SECRET
  process.env.GOOGLE_CLIENT_ID = 'client-id'
  process.env.GOOGLE_CLIENT_SECRET = 'client-secret'
  process.env.GOOGLE_CALLBACK_URL = CALLBACK
  const [{ createApp }, { SESSION_COOKIE }] = await Promise.all([import('@/app'), import('@/lib/session')])
  return { app: createApp(), SESSION_COOKIE }
}

/** Reproduit la signature de cookie-parser (`s:<valeur>.<hmac sha256 base64>`). */
function signedCookie(name: string, value: string): string {
  const signature = createHmac('sha256', SECRET).update(value).digest('base64').replace(/=+$/, '')
  return `${name}=${encodeURIComponent(`s:${value}.${signature}`)}`
}

describe('GET /api/auth/google', () => {
  beforeEach(() => vi.resetModules())

  it('redirige vers Google avec l\'identité seule et un state en mode login', async () => {
    const { app } = await loadApp()
    const res = await request(app).get('/api/auth/google')

    expect(res.status).toBe(302)
    const location = new URL(res.headers.location)
    expect(location.hostname).toBe('accounts.google.com')
    expect(location.searchParams.get('scope')).toBe('openid email profile')
    expect(location.searchParams.get('scope')).not.toContain(YOUTUBE_SCOPE)
    expect(location.searchParams.get('state')).toMatch(/:login$/)
  })
})

describe('GET /api/auth/google/youtube', () => {
  beforeEach(() => vi.resetModules())

  it('refuse (401) un visiteur sans session', async () => {
    const { app } = await loadApp()
    const res = await request(app).get('/api/auth/google/youtube')
    expect(res.status).toBe(401)
  })

  it('redirige un utilisateur connecté vers Google avec le scope YouTube et un state en mode youtube', async () => {
    const { app, SESSION_COOKIE } = await loadApp()
    const res = await request(app)
      .get('/api/auth/google/youtube')
      .set('Cookie', signedCookie(SESSION_COOKIE, 'user-42'))

    expect(res.status).toBe(302)
    const location = new URL(res.headers.location)
    expect(location.searchParams.get('scope')).toContain(YOUTUBE_SCOPE)
    expect(location.searchParams.get('include_granted_scopes')).toBe('true')
    expect(location.searchParams.get('state')).toMatch(/:youtube$/)
  })
})

describe('DELETE /api/auth/youtube (YC-80)', () => {
  beforeEach(() => vi.resetModules())

  it('refuse (401) un visiteur sans session, sans rien lire', async () => {
    const { app } = await loadApp()
    const { prisma } = await import('@/lib/prisma')
    const res = await request(app).delete('/api/auth/youtube')
    expect(res.status).toBe(401)
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })

  it('déconnecte YouTube pour l’utilisateur de la session', async () => {
    const { app, SESSION_COOKIE } = await loadApp()
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ytAccessToken: null, ytRefreshToken: null } as never)
    const res = await request(app).delete('/api/auth/youtube').set('Cookie', signedCookie(SESSION_COOKIE, 'user-42'))
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ revoked: true })
    expect(vi.mocked(prisma.user.findUnique).mock.calls[0][0]).toMatchObject({ where: { id: 'user-42' } })
  })
})
