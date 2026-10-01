import { createHmac } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'

const SECRET = 'secret-de-test-assez-long'

// Hoisted so the app and the test share ONE mock, whatever vi.resetModules does.
const findFirst = vi.hoisted(() => vi.fn())
vi.mock('@/lib/prisma', () => ({ prisma: { video: { findFirst } } }))

async function loadApp() {
  vi.resetModules()
  process.env.NODE_ENV = 'test'
  process.env.SESSION_SECRET = SECRET
  const [{ createApp }, { SESSION_COOKIE }] = await Promise.all([import('@/app'), import('@/lib/session')])
  return { app: createApp(), SESSION_COOKIE }
}

/** Same signature as cookie-parser (`s:<value>.<hmac sha256 base64>`). */
function signedCookie(name: string, value: string): string {
  const signature = createHmac('sha256', SECRET).update(value).digest('base64').replace(/=+$/, '')
  return `${name}=${encodeURIComponent(`s:${value}.${signature}`)}`
}

const row = {
  id: 'vid1',
  youtubeId: 'g09PoiCob4Y',
  title: 'Backend Complete Course',
  thumbnailUrl: 't',
  durationSeconds: 10957,
  description: '00:00:00 | Intro',
  publishedAt: new Date('2025-03-01T12:00:00Z'),
  viewCount: 3000000000n,
  likeCount: null,
  status: 'AVAILABLE',
  embeddable: true,
  blockedRegions: ['FR'],
  topics: null,
  hasPaidPromotion: false,
  definition: 'hd',
  hasCaptions: false,
  syncedAt: new Date('2026-09-29T20:59:29Z'),
  channel: { youtubeId: 'UC1', title: 'PedroTech', handle: '@pedrotechnologies', avatarUrl: null },
  chapters: [
    { position: 0, startSeconds: 0, title: 'Intro' },
    { position: 1, startSeconds: 98, title: 'Setup NodeJS Server' },
  ],
}

describe('GET /api/videos/:id (YC-4)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('refuses (401) a visitor without a session', async () => {
    const { app } = await loadApp()
    const res = await request(app).get('/api/videos/vid1')
    expect(res.status).toBe(401)
  })

  it('answers 404 when the video is neither in a playlist nor in the library of the user', async () => {
    const { app, SESSION_COOKIE } = await loadApp()
    findFirst.mockResolvedValue(null as never)
    const res = await request(app).get('/api/videos/vid1').set('Cookie', signedCookie(SESSION_COOKIE, 'user-42'))
    expect(res.status).toBe(404)
    // Scoped for THIS user: through their playlists, or their library (YC-61).
    expect(findFirst.mock.calls[0][0]?.where).toEqual({
      id: 'vid1',
      OR: [{ playlists: { some: { playlist: { ownerId: 'user-42' } } } }, { libraryEntries: { some: { userId: 'user-42' } } }],
    })
  })

  it('returns the metadata and ordered chapters, counters as JSON numbers', async () => {
    const { app, SESSION_COOKIE } = await loadApp()
    findFirst.mockResolvedValue(row as never)
    const res = await request(app).get('/api/videos/vid1').set('Cookie', signedCookie(SESSION_COOKIE, 'user-42'))

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      id: 'vid1',
      youtubeId: 'g09PoiCob4Y',
      title: 'Backend Complete Course',
      thumbnailUrl: 't',
      durationSeconds: 10957,
      description: '00:00:00 | Intro',
      publishedAt: '2025-03-01T12:00:00.000Z',
      viewCount: 3000000000,
      likeCount: null,
      status: 'AVAILABLE',
      embeddable: true,
      blockedRegions: ['FR'],
      topics: null,
      hasPaidPromotion: false,
      definition: 'hd',
      hasCaptions: false,
      syncedAt: '2026-09-29T20:59:29.000Z',
      channel: { youtubeId: 'UC1', title: 'PedroTech', handle: '@pedrotechnologies', avatarUrl: null },
      chapters: [
        { position: 0, startSeconds: 0, title: 'Intro' },
        { position: 1, startSeconds: 98, title: 'Setup NodeJS Server' },
      ],
    })
  })
})
