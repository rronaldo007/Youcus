import { createHmac } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'

/** YC-48: Réglages › Notes, the starting settings of every new note, per account. */

const SECRET = 'secret-de-test-assez-long'
const findUnique = vi.hoisted(() => vi.fn())
const update = vi.hoisted(() => vi.fn())
vi.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique, update } } }))

async function loadApp() {
  vi.resetModules()
  process.env.NODE_ENV = 'test'
  process.env.SESSION_SECRET = SECRET
  const { createApp } = await import('@/app')
  return createApp()
}

function session(): string {
  const signature = createHmac('sha256', SECRET).update('u1').digest('base64').replace(/=+$/, '')
  return `youcus_session=${encodeURIComponent(`s:u1.${signature}`)}`
}

const PREFS = { paper: 'seyes', tint: 'sepia', margin: false, timestamps: false, font: 'lora', size: 18 }
const DEFAULTS = { paper: 'lignes', tint: 'creme', margin: true, timestamps: true, font: 'hanken', size: 16 }

describe('GET /api/account/note-preferences (YC-48)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('needs a session', async () => {
    const res = await request(await loadApp()).get('/api/account/note-preferences')
    expect(res.status).toBe(401)
  })

  it('gives the defaults when nothing was ever set', async () => {
    findUnique.mockResolvedValue({ notePreferences: null })
    const res = await request(await loadApp()).get('/api/account/note-preferences').set('Cookie', session())
    expect(res.status).toBe(200)
    expect(res.body).toEqual(DEFAULTS)
  })

  it('gives the stored settings, read for the session user only', async () => {
    findUnique.mockResolvedValue({ notePreferences: PREFS })
    const res = await request(await loadApp()).get('/api/account/note-preferences').set('Cookie', session())
    expect(res.body).toEqual(PREFS)
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'u1' } }))
  })

  it('gives the defaults rather than a stored value it cannot read', async () => {
    findUnique.mockResolvedValue({ notePreferences: { paper: 'papyrus' } })
    const res = await request(await loadApp()).get('/api/account/note-preferences').set('Cookie', session())
    expect(res.body).toEqual(DEFAULTS)
  })
})

describe('PUT /api/account/note-preferences (YC-48)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('stores the settings of the session user and returns them', async () => {
    update.mockResolvedValue({})
    const res = await request(await loadApp()).put('/api/account/note-preferences').set('Cookie', session()).send(PREFS)
    expect(res.status).toBe(200)
    expect(res.body).toEqual(PREFS)
    expect(update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { notePreferences: PREFS } })
  })

  it.each([
    ['a missing key', { ...PREFS, size: undefined }],
    ['an unknown paper', { ...PREFS, paper: 'papyrus' }],
    ['an unknown font', { ...PREFS, font: 'comic-sans' }],
    ['a size off the list', { ...PREFS, size: 17 }],
    ['an extra key', { ...PREFS, colour: 'rouge' }],
    ['a string', 'seyes'],
  ])('refuses %s with 400 and stores nothing', async (_name, body) => {
    const res = await request(await loadApp()).put('/api/account/note-preferences').set('Cookie', session()).send(body as object)
    expect(res.status).toBe(400)
    expect(update).not.toHaveBeenCalled()
  })
})
