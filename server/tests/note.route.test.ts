import { createHmac } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'

/** YC-40: the note API takes `{ doc }` and never stores what it did not validate. */

const SECRET = 'secret-de-test-assez-long'
const findFirst = vi.hoisted(() => vi.fn())
const upsert = vi.hoisted(() => vi.fn())
const findUnique = vi.hoisted(() => vi.fn())
vi.mock('@/lib/prisma', () => ({ prisma: { video: { findFirst }, note: { upsert, findUnique } } }))

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

const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'ok' }] }] }

describe('PUT /api/videos/:videoId/note (YC-40)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findFirst.mockResolvedValue({ id: 'v1' })
    findUnique.mockResolvedValue(null)
    upsert.mockResolvedValue({ content: 'ok', doc, updatedAt: new Date('2026-09-30') })
  })

  it('stores a valid document and returns it', async () => {
    const res = await request(await loadApp()).put('/api/videos/v1/note').set('Cookie', session()).send({ doc })
    expect(res.status).toBe(200)
    expect(res.body.doc).toEqual(doc)
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { doc, content: 'ok' } }))
  })

  it('refuses a javascript: link with 400 and stores nothing', async () => {
    const bad = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }] }
    const res = await request(await loadApp()).put('/api/videos/v1/note').set('Cookie', session()).send({ doc: bad })
    expect(res.status).toBe(400)
    expect(upsert).not.toHaveBeenCalled()
  })

  it('stores the page sent with the document, and returns it (YC-45)', async () => {
    const page = { paper: 'seyes', tint: 'sepia', margin: false }
    upsert.mockResolvedValue({ content: 'ok', doc, page, updatedAt: new Date('2026-09-30') })
    const res = await request(await loadApp()).put('/api/videos/v1/note').set('Cookie', session()).send({ doc, page })
    expect(res.status).toBe(200)
    expect(res.body.page).toEqual(page)
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { doc, content: 'ok', page } }))
  })

  it('keeps the stored page when only the document is sent (YC-45)', async () => {
    await request(await loadApp()).put('/api/videos/v1/note').set('Cookie', session()).send({ doc })
    expect(upsert.mock.calls[0][0].update).not.toHaveProperty('page')
  })

  it.each([
    ['an unknown paper', { paper: 'papyrus', tint: 'creme', margin: true }],
    ['a CSS tint', { paper: 'uni', tint: '#ff0000', margin: true }],
    ['a missing key', { paper: 'uni', tint: 'creme' }],
    ['an extra key', { paper: 'uni', tint: 'creme', margin: true, style: 'x' }],
    ['a string', 'seyes'],
  ])('refuses %s as page with 400 and stores nothing (YC-45)', async (_name, page) => {
    const res = await request(await loadApp()).put('/api/videos/v1/note').set('Cookie', session()).send({ doc, page })
    expect(res.status).toBe(400)
    expect(upsert).not.toHaveBeenCalled()
  })

  it('refuses the old Markdown body with 400', async () => {
    const res = await request(await loadApp()).put('/api/videos/v1/note').set('Cookie', session()).send({ content: '# note' })
    expect(res.status).toBe(400)
    expect(upsert).not.toHaveBeenCalled()
  })
})
