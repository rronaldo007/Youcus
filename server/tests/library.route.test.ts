import { createHmac } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import request from 'supertest'

const SECRET = 'secret-de-test-assez-long'

const findMany = vi.hoisted(() => vi.fn())
vi.mock('@/lib/prisma', () => ({ prisma: { libraryVideo: { findMany } } }))

async function loadApp() {
  vi.resetModules()
  process.env.NODE_ENV = 'test'
  process.env.SESSION_SECRET = SECRET
  const [{ createApp }, { SESSION_COOKIE }] = await Promise.all([import('@/app'), import('@/lib/session')])
  return { app: createApp(), SESSION_COOKIE }
}

function signedCookie(name: string, value: string): string {
  const signature = createHmac('sha256', SECRET).update(value).digest('base64').replace(/=+$/, '')
  return `${name}=${encodeURIComponent(`s:${value}.${signature}`)}`
}

describe('/api/library/videos (YC-61)', () => {
  it('needs a session, for every verb', async () => {
    const { app } = await loadApp()
    expect((await request(app).get('/api/library/videos')).status).toBe(401)
    expect((await request(app).post('/api/library/videos').send({ url: 'https://youtu.be/dQw4w9WgXcQ' })).status).toBe(401)
    expect((await request(app).delete('/api/library/videos/v1')).status).toBe(401)
    expect(findMany).not.toHaveBeenCalled()
  })

  it('lists the library of THIS user', async () => {
    const { app, SESSION_COOKIE } = await loadApp()
    findMany.mockResolvedValue([])
    const res = await request(app).get('/api/library/videos').set('Cookie', signedCookie(SESSION_COOKIE, 'user-42'))
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
    expect(findMany.mock.calls[0][0].where).toEqual({ userId: 'user-42' })
  })
})
