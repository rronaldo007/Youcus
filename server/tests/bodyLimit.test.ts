import { describe, expect, it } from 'vitest'
import request from 'supertest'

// What the body parser refuses keeps its 4xx (YC-62): before, a long note got « Erreur interne ».
async function loadApp() {
  process.env.NODE_ENV = 'test'
  process.env.SESSION_SECRET = 'secret-de-test-assez-long'
  const { createApp } = await import('@/app')
  return createApp()
}

const note = (chars: number) => ({ doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'é'.repeat(chars) }] }] } })

describe('bodies the parser refuses (YC-62)', () => {
  it('a note near the 200,000 characters gets past the parser (then the session is checked)', async () => {
    const app = await loadApp()
    const res = await request(app).put('/api/videos/v1/note').send(note(150_000))
    expect(res.status).toBe(401)
  })

  it('a body over 1 Mo is « Contenu trop volumineux », a 413, not a 500', async () => {
    const app = await loadApp()
    const res = await request(app).put('/api/videos/v1/note').send(note(600_000))
    expect(res.status).toBe(413)
    expect(res.body).toEqual({ error: 'Contenu trop volumineux' })
  })

  it('a body that is not JSON is a 400 « Requête invalide »', async () => {
    const app = await loadApp()
    const res = await request(app).put('/api/videos/v1/note').set('Content-Type', 'application/json').send('{"doc": ')
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'Requête invalide' })
  })
})
