import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * YC-35: during the move to one origin (YC-11), the old front address must still be allowed by
 * CORS, while the Google login returns to CLIENT_ORIGIN.
 */

const NEW = 'https://youcus-api.example'
const OLD = 'https://youcus-web.example'
const saved = { ...process.env }

afterEach(() => {
  process.env = { ...saved }
})

async function loadApp(extra?: string) {
  vi.resetModules()
  process.env.NODE_ENV = 'test'
  process.env.CLIENT_ORIGIN = NEW
  if (extra === undefined) delete process.env.CORS_EXTRA_ORIGINS
  else process.env.CORS_EXTRA_ORIGINS = extra
  const { createApp } = await import('@/app')
  return createApp()
}

const allowed = (res: request.Response) => res.headers['access-control-allow-origin']

describe('CORS origins (YC-35)', () => {
  it('allows CLIENT_ORIGIN', async () => {
    const res = await request(await loadApp()).get('/api/health').set('Origin', NEW)
    expect(allowed(res)).toBe(NEW)
  })

  it('allows every extra origin, spaces and empty entries ignored', async () => {
    const app = await loadApp(` ${OLD} , ,https://other.example`)
    expect(allowed(await request(app).get('/api/health').set('Origin', OLD))).toBe(OLD)
    expect(allowed(await request(app).get('/api/health').set('Origin', 'https://other.example'))).toBe(
      'https://other.example',
    )
  })

  it('refuses any other origin', async () => {
    const app = await loadApp(OLD)
    const res = await request(app).get('/api/health').set('Origin', 'https://evil.example')
    expect(allowed(res)).toBeUndefined()
  })

  it('without extra origins, only CLIENT_ORIGIN is allowed', async () => {
    const res = await request(await loadApp()).get('/api/health').set('Origin', OLD)
    expect(allowed(res)).toBeUndefined()
  })
})
