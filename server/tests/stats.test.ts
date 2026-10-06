import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'

// Statistiques (YC-79): only what the study log and the progress hold.

const SECRET = 'secret-de-test-assez-long'
const db = vi.hoisted(() => ({
  studyDay: { findMany: vi.fn() },
  user: { findUnique: vi.fn(), update: vi.fn() },
  playlist: { findMany: vi.fn() },
  progress: { count: vi.fn() },
}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))

async function loadApp() {
  vi.resetModules()
  process.env.NODE_ENV = 'test'
  process.env.SESSION_SECRET = SECRET
  const [{ createApp }, { SESSION_COOKIE }] = await Promise.all([import('@/app'), import('@/lib/session')])
  return { app: createApp(), cookie: (id: string) => signedCookie(SESSION_COOKIE, id) }
}
function signedCookie(name: string, value: string): string {
  const signature = createHmac('sha256', SECRET).update(value).digest('base64').replace(/=+$/, '')
  return `${name}=${encodeURIComponent(`s:${value}.${signature}`)}`
}

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`)
const video = (durationSeconds: number, progress?: { completed: boolean; watchedSeconds: number }, status = 'AVAILABLE') => ({
  video: { status, embeddable: true, blockedRegions: null, durationSeconds, progress: progress ? [progress] : [] },
})

describe('the range and the streak (YC-79)', () => {
  it('a week runs Monday to Sunday; a month is the calendar month', async () => {
    const { rangeOf } = await import('@/services/stats.service')
    expect(rangeOf('week', '2026-10-03')).toEqual({ from: '2026-09-28', to: '2026-10-04' })
    expect(rangeOf('week', '2026-10-05')).toEqual({ from: '2026-10-05', to: '2026-10-11' })
    expect(rangeOf('week', '2026-10-04')).toEqual({ from: '2026-09-28', to: '2026-10-04' })
    expect(rangeOf('month', '2026-02-14')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
  })

  it('days in a row up to today; today not studied yet counts from yesterday; a gap stops it', async () => {
    const { streakOf } = await import('@/services/stats.service')
    expect(streakOf(['2026-10-03', '2026-10-02', '2026-10-01', '2026-09-29'], '2026-10-03')).toBe(3)
    expect(streakOf(['2026-10-02', '2026-10-01'], '2026-10-03')).toBe(2)
    expect(streakOf(['2026-10-01'], '2026-10-03')).toBe(0)
  })
})

describe('getStats (YC-79)', () => {
  const now = new Date('2026-10-05T10:00:00Z')
  beforeEach(() => {
    vi.clearAllMocks()
    db.studyDay.findMany.mockImplementation(async (args: { where: { seconds?: unknown } }) =>
      args.where.seconds
        ? [{ day: day('2026-10-05') }, { day: day('2026-10-04') }, { day: day('2026-10-03') }]
        : [{ day: day('2026-10-05'), seconds: 600 }, { day: day('2026-10-04'), seconds: 1800 }],
    )
    db.user.findUnique.mockResolvedValue({ weeklyGoalMinutes: 300 })
    db.progress.count.mockResolvedValue(2)
    db.playlist.findMany.mockResolvedValue([
      {
        id: 'p1',
        title: 'fullstack',
        videos: [
          video(600, { completed: true, watchedSeconds: 10 }),
          video(1200, { completed: false, watchedSeconds: 300 }),
          video(900),
          video(5000, { completed: false, watchedSeconds: 4000 }, 'DELETED'),
        ],
      },
    ])
  })

  it('every day of the range: nothing before the log, nothing to come, 0 when not studied', async () => {
    const { getStats } = await import('@/services/stats.service')
    const stats = await getStats('u1', { range: 'month', today: '2026-10-05', offsetMinutes: -120 }, now)
    expect(stats.days).toHaveLength(31)
    expect(stats.days[1]).toEqual({ day: '2026-10-02', seconds: null })
    expect(stats.days[2]).toEqual({ day: '2026-10-03', seconds: 0 })
    expect(stats.days[3]).toEqual({ day: '2026-10-04', seconds: 1800 })
    expect(stats.days[4]).toEqual({ day: '2026-10-05', seconds: 600 })
    expect(stats.days[5]).toEqual({ day: '2026-10-06', seconds: null })
    expect(stats.totalSeconds).toBe(2400)
    expect(stats.streakDays).toBe(3)
    expect(stats.goalMinutes).toBe(300)
    expect(stats.since).toBe('2026-10-03')
  })

  it('the videos seen on the user\'s own days: from their midnight, in UTC', async () => {
    const { getStats } = await import('@/services/stats.service')
    const stats = await getStats('u1', { range: 'week', today: '2026-10-05', offsetMinutes: -120 }, now)
    expect(stats.completedCount).toBe(2)
    expect(db.progress.count.mock.calls[0][0].where).toEqual({
      userId: 'u1',
      completedAt: { gte: new Date('2026-10-04T22:00:00.000Z'), lt: new Date('2026-10-11T22:00:00.000Z') },
    })
  })

  it('per playlist, the playable videos only: seen, total, « Avancée » and length', async () => {
    const { getStats } = await import('@/services/stats.service')
    const [p] = (await getStats('u1', { range: 'week', today: '2026-10-05', offsetMinutes: 0 }, now)).playlists
    expect(p).toEqual({ id: 'p1', title: 'fullstack', seen: 1, total: 3, advancedSeconds: 900, totalSeconds: 2700 })
    // A source of a merge would count its videos twice (YC-95).
    expect(db.playlist.findMany.mock.calls[0][0].where).toEqual({ ownerId: 'u1', mergedIntoId: null })
  })

  it('refuses a day far from the server\'s', async () => {
    const { getStats } = await import('@/services/stats.service')
    await expect(getStats('u1', { range: 'week', today: '2026-10-08', offsetMinutes: 0 }, now)).rejects.toMatchObject({ status: 400 })
  })
})

describe('the routes (YC-79)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('need a session', async () => {
    const { app } = await loadApp()
    expect((await request(app).get('/api/stats?range=week&today=2026-10-05&offset=0')).status).toBe(401)
    expect((await request(app).get('/api/account/study-goal')).status).toBe(401)
    expect((await request(app).put('/api/account/study-goal').send({ minutes: 300 })).status).toBe(401)
  })

  it('/stats refuses a range, a day or an offset it does not know', async () => {
    const { app, cookie } = await loadApp()
    const today = new Date().toISOString().slice(0, 10)
    for (const q of [`range=year&today=${today}&offset=0`, `range=week&today=05/10/2026&offset=0`, `range=week&today=${today}&offset=900`]) {
      expect((await request(app).get(`/api/stats?${q}`).set('Cookie', cookie('u1'))).status, q).toBe(400)
    }
    expect(db.playlist.findMany).not.toHaveBeenCalled()
  })

  it('the goal: from 15 min to 100 h a week, or none', async () => {
    const { app, cookie } = await loadApp()
    db.user.update.mockImplementation(async (args: { data: { weeklyGoalMinutes: number | null } }) => ({ weeklyGoalMinutes: args.data.weeklyGoalMinutes }))
    const put = (minutes: unknown) => request(app).put('/api/account/study-goal').set('Cookie', cookie('u7')).send({ minutes })
    expect((await put(300)).body).toEqual({ minutes: 300 })
    expect(db.user.update.mock.calls[0][0]).toMatchObject({ where: { id: 'u7' }, data: { weeklyGoalMinutes: 300 } })
    expect((await put(null)).body).toEqual({ minutes: null })
    for (const bad of [10, 6001, 30.5, '300']) expect((await put(bad)).status, String(bad)).toBe(400)
  })
})

describe('migration weekly_goal (YC-79)', () => {
  const sql = readFileSync(fileURLToPath(new URL('../prisma/migrations/20261003160000_weekly_goal/migration.sql', import.meta.url)), 'utf-8')
  it('only adds the nullable goal to User', () => {
    expect(sql).toMatch(/ALTER TABLE `User` ADD COLUMN `weeklyGoalMinutes` INTEGER NULL/)
    expect(sql).not.toMatch(/DROP|UPDATE `|DELETE FROM|MODIFY/i)
  })
})
