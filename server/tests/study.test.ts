import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'

// The study log (YC-79): seconds of real playback, day by day, the only history the app keeps.

const SECRET = 'secret-de-test-assez-long'
const upsert = vi.hoisted(() => vi.fn())
vi.mock('@/lib/prisma', () => ({ prisma: { studyDay: { upsert } } }))

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

const today = new Date().toISOString().slice(0, 10)

describe('POST /api/study (YC-79)', () => {
  beforeEach(() => upsert.mockReset())

  it('needs a session', async () => {
    const { app } = await loadApp()
    expect((await request(app).post('/api/study').send({ day: today, seconds: 15 })).status).toBe(401)
    expect(upsert).not.toHaveBeenCalled()
  })

  it('adds the seconds to the day of THIS user', async () => {
    const { app, SESSION_COOKIE } = await loadApp()
    upsert.mockResolvedValue({ seconds: 75 })
    const res = await request(app).post('/api/study').set('Cookie', signedCookie(SESSION_COOKIE, 'user-42')).send({ day: today, seconds: 15 })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ day: today, seconds: 75 })
    const call = upsert.mock.calls[0][0]
    expect(call.where).toEqual({ userId_day: { userId: 'user-42', day: new Date(`${today}T00:00:00.000Z`) } })
    expect(call.create).toEqual({ userId: 'user-42', day: new Date(`${today}T00:00:00.000Z`), seconds: 15 })
    expect(call.update).toEqual({ seconds: { increment: 15 } })
  })

  it('refuses what a player cannot send: nothing, too much, not whole, not a day', async () => {
    const { app, SESSION_COOKIE } = await loadApp()
    const post = (body: object) => request(app).post('/api/study').set('Cookie', signedCookie(SESSION_COOKIE, 'u1')).send(body)
    for (const body of [{ day: today, seconds: 0 }, { day: today, seconds: 121 }, { day: today, seconds: 1.5 }, { day: '03/10/2026', seconds: 15 }, { day: '2026-02-30', seconds: 15 }]) {
      expect((await post(body)).status, JSON.stringify(body)).toBe(400)
    }
    expect(upsert).not.toHaveBeenCalled()
  })
})

describe('addStudySeconds: the user\'s own day, and only one near the server\'s (YC-79)', () => {
  beforeEach(() => upsert.mockReset().mockResolvedValue({ seconds: 15 }))
  const now = new Date('2026-10-03T23:30:00Z')

  it('takes the day before and the day after: time zones run from -12 h to +14 h', async () => {
    const { addStudySeconds } = await import('@/services/study.service')
    await expect(addStudySeconds('u1', { day: '2026-10-02', seconds: 15 }, now)).resolves.toBeDefined()
    await expect(addStudySeconds('u1', { day: '2026-10-04', seconds: 15 }, now)).resolves.toBeDefined()
  })

  it('refuses a day further away', async () => {
    const { addStudySeconds } = await import('@/services/study.service')
    await expect(addStudySeconds('u1', { day: '2026-10-05', seconds: 15 }, now)).rejects.toMatchObject({ status: 400 })
    await expect(addStudySeconds('u1', { day: '2026-10-01', seconds: 15 }, now)).rejects.toMatchObject({ status: 400 })
    expect(upsert).not.toHaveBeenCalled()
  })
})

describe('migration study_log (YC-79)', () => {
  const sql = readFileSync(fileURLToPath(new URL('../prisma/migrations/20261003140000_study_log/migration.sql', import.meta.url)), 'utf-8')

  it('adds the date a video was seen, and the table of the days', () => {
    expect(sql).toMatch(/ALTER TABLE `Progress` ADD COLUMN `completedAt` DATETIME\(3\) NULL/)
    expect(sql).toMatch(/CREATE TABLE `StudyDay`/)
    expect(sql).toMatch(/PRIMARY KEY \(`userId`, `day`\)/)
    expect(sql).toMatch(/ON DELETE CASCADE/)
  })

  it('only adds: no DROP, no data rewritten, so the accounts in prod keep everything', () => {
    expect(sql).not.toMatch(/DROP|UPDATE `|DELETE FROM|MODIFY/i)
  })
})
