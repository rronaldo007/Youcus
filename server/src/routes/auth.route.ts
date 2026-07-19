import { randomUUID } from 'node:crypto'
import { Router, type NextFunction, type Request, type Response } from 'express'
import { env, isGoogleOAuthConfigured } from '@/config/env'
import { buildGoogleAuthUrl, exchangeCodeForTokens } from '@/lib/googleOAuth'
import { prisma } from '@/lib/prisma'
import {
  clearSession,
  setOAuthState,
  setSession,
  verifyAndClearOAuthState,
} from '@/lib/session'
import { HttpError } from '@/middleware/errorHandler'
import { requireAuth } from '@/middleware/requireAuth'
import { upsertGoogleUser } from '@/services/auth.service'

export const authRouter = Router()

/** Adapte un handler async pour propager les erreurs vers errorHandler. */
function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next)
  }
}

// Étape 1 : redirige vers l'écran de consentement Google.
authRouter.get('/auth/google', (_req, res) => {
  if (!isGoogleOAuthConfigured()) {
    throw new HttpError(503, 'Connexion Google non configurée sur le serveur')
  }
  const state = randomUUID()
  setOAuthState(res, state)
  res.redirect(buildGoogleAuthUrl(state))
})

// Étape 2 : callback OAuth → échange, upsert, session, retour vers le client.
authRouter.get(
  '/auth/google/callback',
  asyncHandler(async (req, res) => {
    if (!isGoogleOAuthConfigured()) {
      throw new HttpError(503, 'Connexion Google non configurée sur le serveur')
    }

    const { code, state, error } = req.query
    if (error) {
      return res.redirect(`${env.CLIENT_ORIGIN}/?auth=denied`)
    }
    if (typeof code !== 'string' || !verifyAndClearOAuthState(req, res, state as string | undefined)) {
      throw new HttpError(400, 'Requête OAuth invalide (code ou state manquant)')
    }

    const { profile, tokens } = await exchangeCodeForTokens(code)
    const user = await upsertGoogleUser(profile, tokens)
    setSession(res, user.id)
    return res.redirect(env.CLIENT_ORIGIN)
  }),
)

// Déconnexion : invalide la session en supprimant le cookie.
authRouter.post('/auth/logout', (_req, res) => {
  clearSession(res)
  res.json({ ok: true })
})

// Profil de l'utilisateur connecté (protégé par requireAuth).
authRouter.get(
  '/auth/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId } })
    if (!user) {
      clearSession(res)
      throw new HttpError(401, 'Session invalide')
    }
    return res.json({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    })
  }),
)
