import { describe, expect, it, vi } from 'vitest'
import type { NextFunction, Request, Response } from 'express'
import { requireAuth } from '@/middleware/requireAuth'
import { SESSION_COOKIE } from '@/lib/session'

function mockRes(): Response {
  const res = {} as Response
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  res.cookie = vi.fn().mockReturnValue(res)
  return res
}

describe('requireAuth', () => {
  it('renvoie 401 sans cookie de session', () => {
    const req = { signedCookies: {} } as unknown as Request
    const res = mockRes()
    const next = vi.fn() as unknown as NextFunction

    requireAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('appelle next et renseigne req.userId avec une session valide', () => {
    const req = { signedCookies: { [SESSION_COOKIE]: 'user-42' } } as unknown as Request
    const res = mockRes()
    const next = vi.fn() as unknown as NextFunction

    requireAuth(req, res, next)

    expect(next).toHaveBeenCalledOnce()
    expect(req.userId).toBe('user-42')
    expect(res.status).not.toHaveBeenCalled()
    // Session glissante : le cookie est réémis pour repousser l'expiration.
    expect(res.cookie).toHaveBeenCalledWith(SESSION_COOKIE, 'user-42', expect.objectContaining({ maxAge: expect.any(Number) }))
  })
})
