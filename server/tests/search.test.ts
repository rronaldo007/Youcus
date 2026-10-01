import { createHmac } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { noteLines, type NoteDoc } from '@/lib/noteDoc'
import { excerpt, fold } from '@/services/search.service'

// The search (YC-22): the user's playlists, videos and notes, never anyone else's, never YouTube.

const SECRET = 'secret-de-test-assez-long'
const db = vi.hoisted(() => ({
  playlist: { count: vi.fn(), findMany: vi.fn() },
  video: { count: vi.fn(), findMany: vi.fn() },
  note: { findMany: vi.fn() },
}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))

async function loadApp() {
  vi.resetModules()
  process.env.NODE_ENV = 'test'
  process.env.SESSION_SECRET = SECRET
  const [{ createApp }, { SESSION_COOKIE }] = await Promise.all([import('@/app'), import('@/lib/session')])
  return { app: createApp(), SESSION_COOKIE }
}
const cookie = (name: string, value: string) => {
  const signature = createHmac('sha256', SECRET).update(value).digest('base64').replace(/=+$/, '')
  return `${name}=${encodeURIComponent(`s:${value}.${signature}`)}`
}
const p = (text: string, marker?: number) => ({ type: 'paragraph', ...(marker === undefined ? {} : { attrs: { marker } }), content: [{ type: 'text', text }] })
const h = (text: string) => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] })

describe('GET /api/search (YC-22)', () => {
  beforeEach(() => {
    for (const model of Object.values(db)) for (const fn of Object.values(model)) fn.mockReset()
    db.playlist.count.mockResolvedValue(0)
    db.playlist.findMany.mockResolvedValue([])
    db.video.count.mockResolvedValue(0)
    db.video.findMany.mockResolvedValue([])
    db.note.findMany.mockResolvedValue([])
  })

  it('needs a session; refuses a query of one letter or too long', async () => {
    const { app, SESSION_COOKIE } = await loadApp()
    expect((await request(app).get('/api/search?q=useEffect')).status).toBe(401)
    const c = cookie(SESSION_COOKIE, 'user-42')
    expect((await request(app).get('/api/search?q=%20u%20').set('Cookie', c)).status).toBe(400)
    expect((await request(app).get(`/api/search?q=${'a'.repeat(101)}`).set('Cookie', c)).status).toBe(400)
    expect(db.note.findMany).not.toHaveBeenCalled()
  })

  it('looks only in what is THIS user’s: their playlists, the videos they can open, their notes', async () => {
    const { app, SESSION_COOKIE } = await loadApp()
    const res = await request(app).get('/api/search?q=%20useEffect%20').set('Cookie', cookie(SESSION_COOKIE, 'user-42'))
    expect(res.status).toBe(200)
    expect(res.body.query).toBe('useEffect')
    expect(db.playlist.findMany.mock.calls[0][0].where.ownerId).toBe('user-42')
    expect(JSON.stringify(db.video.findMany.mock.calls[0][0].where.AND[0])).toContain('"ownerId":"user-42"')
    expect(JSON.stringify(db.video.findMany.mock.calls[0][0].where.AND[0])).toContain('"userId":"user-42"')
    expect(db.note.findMany.mock.calls[0][0].where).toEqual({ authorId: 'user-42', content: { contains: 'useEffect' } })
  })

  it('% and _ are searched as characters, not as the wildcards of LIKE', async () => {
    const { app, SESSION_COOKIE } = await loadApp()
    await request(app).get('/api/search?q=100%25_a').set('Cookie', cookie(SESSION_COOKIE, 'u'))
    expect(db.note.findMany.mock.calls[0][0].where.content).toEqual({ contains: '100\\%\\_a' })
  })

  it('a playlist: its counts, how many of its titles hold the term; its own title first', async () => {
    const { app, SESSION_COOKIE } = await loadApp()
    const v = (title: string, seen = false) => ({ video: { title, progress: seen ? [{ id: 'x' }] : [] } })
    db.playlist.count.mockResolvedValue(2)
    db.playlist.findMany.mockResolvedValue([
      { id: 'p1', title: 'fullstack', thumbnailUrl: null, channel: { title: 'JS Mastery' }, videos: [v('useEffect en profondeur', true), v('Nettoyer un UseEffect'), v('Le state')] },
      { id: 'p2', title: 'Hooks : useEffect', thumbnailUrl: null, channel: null, videos: [] },
    ])
    const res = await request(app).get('/api/search?q=useeffect').set('Cookie', cookie(SESSION_COOKIE, 'u'))
    expect(res.body.playlists).toEqual({
      total: 2,
      items: [
        { id: 'p2', title: 'Hooks : useEffect', thumbnailUrl: null, channel: null, videoCount: 0, completedCount: 0, titleMatches: 0 },
        { id: 'p1', title: 'fullstack', thumbnailUrl: null, channel: 'JS Mastery', videoCount: 3, completedCount: 1, titleMatches: 2 },
      ],
    })
  })

  it('a video: its state and its place in a playlist, or none when it is alone', async () => {
    const { app, SESSION_COOKIE } = await loadApp()
    db.video.count.mockResolvedValue(2)
    db.video.findMany.mockResolvedValue([
      { youtubeId: 'a', title: 'A', thumbnailUrl: null, durationSeconds: 872, channel: null, progress: [{ completed: false, watchedSeconds: 30 }], playlists: [{ position: 3, playlist: { id: 'p1', title: 'fullstack', _count: { videos: 17 } } }] },
      { youtubeId: 'b', title: 'B', thumbnailUrl: null, durationSeconds: 60, channel: { title: 'Fireship' }, progress: [], playlists: [] },
    ])
    const res = await request(app).get('/api/search?q=ab').set('Cookie', cookie(SESSION_COOKIE, 'u'))
    expect(res.body.videos.items[0]).toMatchObject({ state: 'progress', playlist: { id: 'p1', position: 4, count: 17 } })
    expect(res.body.videos.items[1]).toMatchObject({ state: 'todo', playlist: null, channel: 'Fireship' })
  })

  it('a note: each line that holds the term, its nearest marker and its section; a legacy note too', async () => {
    const { app, SESSION_COOKIE } = await loadApp()
    const doc = { type: 'doc', content: [h('Plan'), p('Intro', 120), p('Un useEffect s’exécute après le rendu.'), p('Rien'), p('Toujours nettoyer l’useÉffect.', 520)] }
    db.note.findMany.mockResolvedValue([
      { id: 'n1', doc, content: '', playlist: null, video: { youtubeId: 'yt1', title: 'useEffect en profondeur', playlists: [{ playlist: { id: 'p1', title: 'fullstack' } }] } },
      { id: 'n2', doc: null, content: '# Révisions\nRevoir useEffect avant l’examen.', playlist: { id: 'p1', title: 'fullstack' }, video: null },
    ])
    const res = await request(app).get('/api/search?q=useeffect').set('Cookie', cookie(SESSION_COOKIE, 'u'))
    expect(res.body.notes.total).toBe(3)
    expect(res.body.notes.items.map((n: { text: string; marker: number | null; section: string | null }) => [n.text, n.marker, n.section])).toEqual([
      ['Un useEffect s’exécute après le rendu.', 120, 'Plan'],
      ['Toujours nettoyer l’useÉffect.', 520, 'Plan'],
      ['Revoir useEffect avant l’examen.', null, 'Révisions'],
    ])
    expect(res.body.notes.items[0].video).toEqual({ youtubeId: 'yt1', title: 'useEffect en profondeur', playlist: { id: 'p1', title: 'fullstack' } })
  })

  it('a note MySQL found but no line holds whole is still listed, with the text around the term', async () => {
    const { app, SESSION_COOKIE } = await loadApp()
    db.note.findMany.mockResolvedValue([{ id: 'n1', doc: { type: 'doc', content: [p('use'), p('Effect')] }, content: 'use\nEffect', playlist: null, video: null }])
    const res = await request(app).get('/api/search?q=use%0AEffect').set('Cookie', cookie(SESSION_COOKIE, 'u'))
    expect(res.body.notes.items).toHaveLength(1)
  })
})

describe('search helpers (YC-22)', () => {
  it('folds case and accents as MySQL compares them', () => {
    expect(fold('Éléphant ÇA')).toBe('elephant ca')
  })

  it('cuts a long line around the term, at words, and says so', () => {
    const long = `${'mot '.repeat(60)}le useEffect ici ${'fin '.repeat(60)}`
    const e = excerpt(long, 'useEffect')
    expect(e.length).toBeLessThanOrEqual(142)
    expect(e).toContain('useEffect')
    expect(e.startsWith('…')).toBe(true)
    expect(e.endsWith('…')).toBe(true)
    expect(e).not.toMatch(/…\S*mo…|…ot /)
    expect(excerpt('court', 'x')).toBe('court')
  })

  it('a line keeps the marker above it and the title it sits under', () => {
    const lines = noteLines({ type: 'doc', content: [p('a', 10), h('Titre'), p('b'), p('c', 30)] } as NoteDoc)
    expect(lines).toEqual([
      { text: 'a', marker: 10, section: null },
      { text: 'Titre', marker: 10, section: 'Titre' },
      { text: 'b', marker: 10, section: 'Titre' },
      { text: 'c', marker: 30, section: 'Titre' },
    ])
  })
})
