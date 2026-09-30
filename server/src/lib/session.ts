import type { CookieOptions, Request, Response } from 'express'
import { env } from '@/config/env'

/** Cookie de session (signé, httpOnly) contenant l'id utilisateur. */
export const SESSION_COOKIE = 'youcus_session'

/** Cookie court de protection CSRF pour le flux OAuth (paramètre `state`). */
export const OAUTH_STATE_COOKIE = 'youcus_oauth_state'

const SESSION_MAX_AGE = 1000 * 60 * 60 * 24 * 7 // 7 jours

function baseCookieOptions(): CookieOptions {
  const isProd = env.NODE_ENV === 'production'
  // In prod the old front (sevalla.page) and the API (sevalla.app) are cross-site: the cookie
  // must be SameSite=None; Secure to be sent. On the single origin (YC-11) None is first-party
  // and works on mobile too, so it stays the default until the old address is retired; then
  // SESSION_SAMESITE=lax. None is only accepted by browsers together with Secure.
  const sameSite = env.SESSION_SAMESITE ?? (isProd ? 'none' : 'lax')
  return {
    httpOnly: true,
    signed: true,
    secure: isProd || sameSite === 'none',
    sameSite,
    path: '/',
  }
}

/** Pose le cookie de session pour l'utilisateur connecté. */
export function setSession(res: Response, userId: string): void {
  res.cookie(SESSION_COOKIE, userId, { ...baseCookieOptions(), maxAge: SESSION_MAX_AGE })
}

/** Supprime le cookie de session (déconnexion). */
export function clearSession(res: Response): void {
  res.clearCookie(SESSION_COOKIE, baseCookieOptions())
}

/** Lit l'id utilisateur du cookie de session signé, ou null. */
export function getSessionUserId(req: Request): string | null {
  const raw = req.signedCookies?.[SESSION_COOKIE]
  return typeof raw === 'string' && raw.length > 0 ? raw : null
}

/** Pose le cookie `state` OAuth (courte durée). */
export function setOAuthState(res: Response, state: string): void {
  res.cookie(OAUTH_STATE_COOKIE, state, { ...baseCookieOptions(), maxAge: 1000 * 60 * 10 })
}

/** Vérifie que le `state` reçu correspond au cookie, puis le consomme. */
export function verifyAndClearOAuthState(req: Request, res: Response, received: string | undefined): boolean {
  const expected = req.signedCookies?.[OAUTH_STATE_COOKIE]
  res.clearCookie(OAUTH_STATE_COOKIE, baseCookieOptions())
  return Boolean(received) && typeof expected === 'string' && expected === received
}
