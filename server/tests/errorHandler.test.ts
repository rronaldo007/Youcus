import express from 'express'
import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { logger } from '@/lib/logger'
import { HttpError, errorHandler } from '@/middleware/errorHandler'

function appThrowing(err: unknown) {
  const app = express()
  app.get('/boom', () => {
    throw err
  })
  app.use(errorHandler)
  return app
}

describe('errorHandler (YC-34)', () => {
  afterEach(() => vi.restoreAllMocks())

  it("never sends an unexpected error's message to the browser, but logs it", async () => {
    const log = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
    const secret = 'Invalid `prisma.playlist.update()` invocation: table Playlist'

    const res = await request(appThrowing(new Error(secret))).get('/boom')

    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: 'Erreur interne' })
    expect(res.text).not.toContain('prisma')
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ err: expect.objectContaining({ message: secret }) }), expect.any(String))
  })

  it('keeps the message of an HttpError, written for the user', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => undefined)
    const res = await request(appThrowing(new HttpError(404, 'Playlist introuvable'))).get('/boom')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'Playlist introuvable' })
  })

  it('keeps the message of a deliberate 5xx HttpError (quota, service not configured)', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => undefined)
    const res = await request(appThrowing(new HttpError(503, 'Quota YouTube dépassé, réessayez plus tard'))).get('/boom')
    expect(res.status).toBe(503)
    expect(res.body).toEqual({ error: 'Quota YouTube dépassé, réessayez plus tard' })
  })

  it('gives the code of an HttpError, for the client to act on (YC-81)', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => undefined)
    const res = await request(appThrowing(new HttpError(503, 'Quota YouTube dépassé', 'youtube_quota'))).get('/boom')
    expect(res.body).toEqual({ error: 'Quota YouTube dépassé', code: 'youtube_quota' })
  })
})
