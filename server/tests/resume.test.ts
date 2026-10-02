import { createHmac } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'

/** YC-74: the dashboard's « Reprendre » banner. */
const SECRET = 'secret-de-test-assez-long'

const progressFindMany = vi.hoisted(() => vi.fn())
const playlistVideoCount = vi.hoisted(() => vi.fn())
vi.mock('@/lib/prisma', () => ({
  prisma: { progress: { findMany: progressFindMany }, playlistVideo: { count: playlistVideoCount } },
}))

const ok = { status: 'AVAILABLE', embeddable: true, blockedRegions: null }
function row(id: string, extra: Record<string, unknown> = {}) {
  return {
    watchedSeconds: 245,
    video: {
      id, youtubeId: `yt-${id}`, title: `Vidéo ${id}`, thumbnailUrl: null, durationSeconds: 845,
      ...ok, playlists: [], libraryEntries: [], ...extra,
    },
  }
}

async function loadService() {
  return import('@/services/resume.service')
}

describe('findResume (YC-74)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('asks for this user’s started and unfinished videos, the most recent first', async () => {
    progressFindMany.mockResolvedValue([])
    const { findResume } = await loadService()
    expect(await findResume('u1')).toBeNull()
    const args = progressFindMany.mock.calls[0][0]
    expect(args.where).toEqual({ userId: 'u1', completed: false, watchedSeconds: { gt: 0 } })
    expect(args.orderBy).toEqual({ updatedAt: 'desc' })
    // Only the user's own playlists and library count.
    expect(args.select.video.select.playlists.where).toEqual({ playlist: { ownerId: 'u1' } })
    expect(args.select.video.select.libraryEntries.where).toEqual({ userId: 'u1' })
  })

  it('gives the video, its saved position and its place in the playlist', async () => {
    progressFindMany.mockResolvedValue([
      row('a', { playlists: [{ position: 7, playlist: { id: 'p1', title: 'fullstack' } }] }),
    ])
    playlistVideoCount.mockResolvedValueOnce(3).mockResolvedValueOnce(17)
    const { findResume } = await loadService()
    expect(await findResume('u1')).toEqual({
      youtubeId: 'yt-a', title: 'Vidéo a', thumbnailUrl: null, durationSeconds: 845, watchedSeconds: 245,
      playlist: { id: 'p1', title: 'fullstack', position: 4, total: 17 },
    })
    expect(playlistVideoCount.mock.calls[0][0]).toEqual({ where: { playlistId: 'p1', position: { lt: 7 } } })
    expect(playlistVideoCount.mock.calls[1][0]).toEqual({ where: { playlistId: 'p1' } })
  })

  it('skips a video that can no longer be played, and one that is in no playlist nor library', async () => {
    progressFindMany.mockResolvedValue([
      row('gone', { status: 'DELETED', playlists: [{ position: 0, playlist: { id: 'p1', title: 'T' } }] }),
      row('orphan'),
      row('kept', { libraryEntries: [{ videoId: 'kept' }] }),
    ])
    const { findResume } = await loadService()
    expect(await findResume('u1')).toMatchObject({ youtubeId: 'yt-kept', playlist: null })
    expect(playlistVideoCount).not.toHaveBeenCalled()
  })
})

describe('GET /api/resume (YC-74)', () => {
  beforeEach(() => vi.clearAllMocks())

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

  it('needs a session', async () => {
    const { app } = await loadApp()
    expect((await request(app).get('/api/resume')).status).toBe(401)
    expect(progressFindMany).not.toHaveBeenCalled()
  })

  it('answers null when there is nothing to resume, for THIS user', async () => {
    const { app, SESSION_COOKIE } = await loadApp()
    progressFindMany.mockResolvedValue([])
    const res = await request(app).get('/api/resume').set('Cookie', signedCookie(SESSION_COOKIE, 'user-42'))
    expect(res.status).toBe(200)
    expect(res.body).toBeNull()
    expect(progressFindMany.mock.calls[0][0].where.userId).toBe('user-42')
  })
})
