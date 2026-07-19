import type { CookieOptions, Request, Response } from 'express'
import { env } from '@/config/env'

/** Cookie de session (signé, httpOnly) contenant l'id utilisateur. */
export const SESSION_COOKIE = 'youcus_session'

/** Cookie court de protection CSRF pour le flux OAuth (paramètre `state`). */
export const OAUTH_STATE_COOKIE = 'youcus_oauth_state'

const SESSION_MAX_AGE = 1000 * 60 * 60 * 24 * 7 // 7 jours

function baseCookieOptions(): CookieOptions {
  const isProd = env.NODE_ENV === 'production'
  return {
    httpOnly: true,
    signed: true,
    secure: isProd,
    // En prod, le front (sevalla.page) et l'API (sevalla.app) sont cross-site :
    // le cookie de session doit être SameSite=None; Secure pour être envoyé.
    sameSite: isProd ? 'none' : 'lax',
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
