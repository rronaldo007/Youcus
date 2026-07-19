import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '@/app'
import { SESSION_COOKIE } from '@/lib/session'

describe('POST /api/auth/logout', () => {
  it('répond 200 et supprime le cookie de session', async () => {
    const res = await request(createApp()).post('/api/auth/logout')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })

    // Le cookie de session est effacé (Set-Cookie qui le vide / l'expire).
    const setCookie = res.headers['set-cookie'] as unknown as string[] | undefined
    expect(setCookie?.some((c) => c.startsWith(`${SESSION_COOKIE}=`))).toBe(true)
  })
})
