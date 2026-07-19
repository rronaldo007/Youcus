import type { NextFunction, Request, Response } from 'express'
import { getSessionUserId, setSession } from '@/lib/session'

/** Garde d'authentification : rejette (401) toute requête sans session valide. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const userId = getSessionUserId(req)
  if (!userId) {
    res.status(401).json({ error: 'Authentification requise' })
    return
  }
  // Session glissante : chaque requête authentifiée repousse l'expiration du cookie.
  setSession(res, userId)
  req.userId = userId
  next()
}
