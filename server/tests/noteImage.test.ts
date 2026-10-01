import { createHmac } from 'node:crypto'
import { Readable } from 'node:stream'
import sharp from 'sharp'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Images of the notes (YC-50): the real sharp decodes and re-encodes; only the database and the
// object storage are stood in for.

const SECRET = vi.hoisted(() => {
  // Before any import: the env module reads the session secret once, when it is first loaded.
  process.env.SESSION_SECRET = 'secret-de-test-assez-long'
  process.env.NODE_ENV = 'test'
  return 'secret-de-test-assez-long'
})
const db = vi.hoisted(() => ({
  noteImage: { count: vi.fn(), create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
}))
const storage = vi.hoisted(() => ({ putObject: vi.fn(), getObject: vi.fn(), deleteObject: vi.fn() }))
const configured = vi.hoisted(() => ({ value: true }))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/imageStorage', () => storage)
vi.mock('@/config/env', async (original) => {
  const actual = await original<typeof import('@/config/env')>()
  return { ...actual, isImageStorageConfigured: () => configured.value }
})

const { addNoteImage, readNoteImage, MAX_IMAGE_SIDE } = await import('@/services/noteImage.service')
const { parseNoteDoc } = await import('@/lib/noteDoc')

/** A real PNG, `w` × `h`, with EXIF data (a camera and a GPS position) when asked. */
async function png(w: number, h: number, exif = false): Promise<Buffer> {
  const image = sharp({ create: { width: w, height: h, channels: 3, background: { r: 200, g: 60, b: 40 } } })
  return (exif ? image.withExif({ IFD0: { Make: 'Phone', Model: 'X' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '45/1 45/1 0/1' } }) : image).png().toBuffer()
}

const stored = () => storage.putObject.mock.calls[0] as [string, Buffer, string]

describe('addNoteImage (YC-50)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    db.noteImage.count.mockResolvedValue(0)
    db.noteImage.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => data)
  })

  it('stores a WebP of THIS user, under a key of their own, and answers its id and size', async () => {
    const info = await addNoteImage('u1', await png(800, 600), 'schéma.png')
    const [key, body, type] = stored()
    expect(type).toBe('image/webp')
    expect(key).toBe(`notes/u1/${info.id}.webp`)
    expect((await sharp(body).metadata()).format).toBe('webp')
    expect(info).toMatchObject({ width: 800, height: 600, name: 'schéma.png' })
    expect(info.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(db.noteImage.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: 'u1', key, bytes: body.length }) })
  })

  it('caps the longest side at 1600 px, never enlarges a small one', async () => {
    await addNoteImage('u1', await png(4000, 1000), null)
    const big = await sharp(stored()[1]).metadata()
    expect([big.width, big.height]).toEqual([MAX_IMAGE_SIDE, 400])
    vi.clearAllMocks()
    db.noteImage.count.mockResolvedValue(0)
    db.noteImage.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => data)
    await addNoteImage('u1', await png(120, 80), null)
    expect((await sharp(stored()[1]).metadata()).width).toBe(120)
  })

  it('drops the EXIF data of a photo, its GPS position with it', async () => {
    const photo = await png(300, 200, true)
    expect((await sharp(photo).metadata()).exif).toBeDefined()
    await addNoteImage('u1', photo, null)
    expect((await sharp(stored()[1]).metadata()).exif).toBeUndefined()
  })

  it('refuses what is not an image, whatever its name says', async () => {
    await expect(addNoteImage('u1', Buffer.from('<svg onload="alert(1)"></svg>'), 'x.png')).rejects.toMatchObject({ status: 415 })
    await expect(addNoteImage('u1', Buffer.from('%PDF-1.7 not an image'), 'x.jpg')).rejects.toMatchObject({ status: 415 })
    expect(storage.putObject).not.toHaveBeenCalled()
  })

  it('refuses an empty file, one over 10 Mo, and a full account', async () => {
    await expect(addNoteImage('u1', Buffer.alloc(0), null)).rejects.toMatchObject({ status: 400 })
    await expect(addNoteImage('u1', Buffer.alloc(10 * 1024 * 1024 + 1), null)).rejects.toMatchObject({ status: 413 })
    db.noteImage.count.mockResolvedValue(1000)
    await expect(addNoteImage('u1', await png(10, 10), null)).rejects.toMatchObject({ status: 409 })
    expect(storage.putObject).not.toHaveBeenCalled()
  })

  it('keeps 200 characters of the file name at most', async () => {
    const info = await addNoteImage('u1', await png(10, 10), `${'a'.repeat(300)}.png`)
    expect(info.name).toHaveLength(200)
  })
})

describe('readNoteImage (YC-50)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('serves an image to its owner only: anyone else gets a 404', async () => {
    db.noteImage.findFirst.mockResolvedValue(null)
    await expect(readNoteImage('u2', 'img1')).rejects.toMatchObject({ status: 404 })
    expect(db.noteImage.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'img1', userId: 'u2' } }))
    expect(storage.getObject).not.toHaveBeenCalled()
  })
})

async function loadApp() {
  vi.resetModules()
  process.env.NODE_ENV = 'test'
  process.env.SESSION_SECRET = SECRET
  const [{ createApp }, { SESSION_COOKIE }] = await Promise.all([import('@/app'), import('@/lib/session')])
  const signature = createHmac('sha256', SECRET).update('u1').digest('base64').replace(/=+$/, '')
  return { app: createApp(), cookie: `${SESSION_COOKIE}=${encodeURIComponent(`s:u1.${signature}`)}` }
}

describe('/api/note-images (YC-50)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    configured.value = true
    db.noteImage.count.mockResolvedValue(0)
    db.noteImage.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => data)
  })

  it('needs a session', async () => {
    const { app } = await loadApp()
    expect((await request(app).post('/api/note-images').set('Content-Type', 'image/png').send(await png(10, 10))).status).toBe(401)
    expect((await request(app).get('/api/note-images/img1')).status).toBe(401)
  })

  it('says so when the storage is not configured', async () => {
    configured.value = false
    const { app, cookie } = await loadApp()
    const res = await request(app).post('/api/note-images').set('Cookie', cookie).set('Content-Type', 'image/png').send(await png(10, 10))
    expect(res.status).toBe(503)
    expect(res.body.error).toMatch(/pas configurées/)
  })

  it('takes the file as the body, its name from X-File-Name', async () => {
    const { app, cookie } = await loadApp()
    const res = await request(app)
      .post('/api/note-images')
      .set('Cookie', cookie)
      .set('Content-Type', 'image/png')
      .set('X-File-Name', encodeURIComponent('cycle de vie.png'))
      .send(await png(64, 48))
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ width: 64, height: 48, name: 'cycle de vie.png' })
  })

  it('answers 413 with a sentence, not a 500, over 10 Mo', async () => {
    const { app, cookie } = await loadApp()
    const res = await request(app)
      .post('/api/note-images')
      .set('Cookie', cookie)
      .set('Content-Type', 'image/png')
      .send(Buffer.alloc(10 * 1024 * 1024 + 10))
    expect(res.status).toBe(413)
    expect(res.body.error).toMatch(/10 Mo/)
  })

  it('streams the file to its owner, cached privately', async () => {
    db.noteImage.findFirst.mockResolvedValue({ key: 'notes/u1/img1.webp' })
    storage.getObject.mockResolvedValue({ body: Readable.from([Buffer.from('WEBPDATA')]), contentType: 'image/webp', length: 8 })
    const { app, cookie } = await loadApp()
    const res = await request(app).get('/api/note-images/img1').set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toBe('image/webp')
    expect(res.headers['cache-control']).toBe('private, max-age=31536000, immutable')
    expect(res.body.toString()).toBe('WEBPDATA')
  })
})

describe('the image node of a note (YC-50)', () => {
  const ID = '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e'
  const doc = (attrs: Record<string, unknown>) => ({ type: 'doc', content: [{ type: 'noteImage', attrs }] })

  it('keeps the id, the texts and a real choice of layout; the defaults are not stored', () => {
    const parsed = parseNoteDoc(doc({ id: ID, alt: ' Schéma ', caption: 'Figure 1', align: 'left', width: 60 }))
    expect(parsed).toEqual({ ok: true, doc: doc({ id: ID, alt: 'Schéma', caption: 'Figure 1', align: 'left', width: 60 }) })
    const plain = parseNoteDoc(doc({ id: ID, alt: null, caption: '', align: 'center', width: 100 }))
    expect(plain).toEqual({ ok: true, doc: doc({ id: ID }) })
  })

  it('never takes an address: an image is an id of the user, nothing else', () => {
    for (const id of ['https://evil.example/x.png', 'javascript:alert(1)', '../../etc/passwd', '']) {
      expect(parseNoteDoc(doc({ id })).ok).toBe(false)
    }
    // An unknown attribute (a src slipped in) is dropped, not stored.
    const parsed = parseNoteDoc(doc({ id: ID, src: 'https://evil.example/x.png' }))
    expect(parsed).toEqual({ ok: true, doc: doc({ id: ID }) })
  })

  it('refuses a layout the editor does not offer, and texts over 300 characters', () => {
    expect(parseNoteDoc(doc({ id: ID, align: 'right' })).ok).toBe(false)
    expect(parseNoteDoc(doc({ id: ID, width: 5 })).ok).toBe(false)
    expect(parseNoteDoc(doc({ id: ID, alt: 'a'.repeat(301) })).ok).toBe(false)
  })
})
