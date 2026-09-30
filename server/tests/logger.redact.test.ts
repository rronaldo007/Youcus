import { Writable } from 'node:stream'
import { pino } from 'pino'
import { pinoHttp } from 'pino-http'
import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { loggerOptions } from '@/lib/logger'

/** YC-39: the request log of the real middleware must never carry the session cookie. */
function appLoggingTo(lines: string[]) {
  const sink = new Writable({
    write(chunk, _enc, done) {
      lines.push(chunk.toString())
      done()
    },
  })
  const app = express()
  // The real options, only the level and destination changed so the test can read the output.
  app.use(pinoHttp({ logger: pino({ ...loggerOptions(), level: 'info', transport: undefined }, sink) }))
  app.get('/login', (_req, res) => {
    res.cookie('youcus_session', 's:user-42.signature-secrete')
    res.json({ ok: true })
  })
  return app
}

describe('request log redaction (YC-39)', () => {
  it('never writes the session cookie, the authorization header or set-cookie', async () => {
    const lines: string[] = []
    await request(appLoggingTo(lines))
      .get('/login')
      .set('Cookie', 'youcus_session=s%3Auser-42.signature-envoyee')
      .set('Authorization', 'Bearer jeton-secret')

    const log = lines.join('\n')
    expect(log).toContain('"url":"/login"')
    expect(log).not.toContain('signature-envoyee')
    expect(log).not.toContain('jeton-secret')
    expect(log).not.toContain('signature-secrete')
    expect(log).toContain('[Redacted]')
  })
})
