import { randomUUID } from 'node:crypto'
import { Router, type NextFunction, type Request, type Response } from 'express'
import { env, isGoogleOAuthConfigured } from '@/config/env'
import { buildGoogleAuthUrl, exchangeCodeForTokens, type OAuthMode } from '@/lib/googleOAuth'
import { prisma } from '@/lib/prisma'
import {
  clearSession,
  getSessionUserId,
  setOAuthState,
  setSession,
  verifyAndClearOAuthState,
} from '@/lib/session'
import { HttpError } from '@/middleware/errorHandler'
import { requireAuth } from '@/middleware/requireAuth'
import { upsertGoogleUser } from '@/services/auth.service'
import { disconnectYouTube } from '@/services/youtubeToken.service'

export const authRouter = Router()

/** Adapte un handler async pour propager les erreurs vers errorHandler. */
function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next)
  }
}

/**
 * Le `state` porte le mode du flux (`<uuid>:login` ou `<uuid>:youtube`). Google le renvoie
 * tel quel, et il est comparé au cookie signé : le mode ne peut donc pas être forgé.
 */
function newState(mode: OAuthMode): string {
  return `${randomUUID()}:${mode}`
}

function modeOf(state: unknown): OAuthMode {
  return typeof state === 'string' && state.endsWith(':youtube') ? 'youtube' : 'login'
}

function startGoogleFlow(res: Response, mode: OAuthMode): void {
  if (!isGoogleOAuthConfigured()) {
    throw new HttpError(503, 'Connexion Google non configurée sur le serveur')
  }
  const state = newState(mode)
  setOAuthState(res, state)
  res.redirect(buildGoogleAuthUrl(state, mode))
}

// Étape 1 : connexion. Identité seule (scopes non sensibles), ouverte à tout compte Google.
authRouter.get('/auth/google', (_req, res) => {
  startGoogleFlow(res, 'login')
})

// Étape 1 bis : connecter YouTube (scope sensible), demandé seulement à l'utilisateur déjà connecté.
authRouter.get('/auth/google/youtube', requireAuth, (_req, res) => {
  startGoogleFlow(res, 'youtube')
})

// Étape 2 : callback OAuth → échange, upsert, session, retour vers le client.
authRouter.get(
  '/auth/google/callback',
  asyncHandler(async (req, res) => {
    if (!isGoogleOAuthConfigured()) {
      throw new HttpError(503, 'Connexion Google non configurée sur le serveur')
    }

    const { code, state, error } = req.query
    const mode = modeOf(state)
    if (error) {
      return res.redirect(
        mode === 'youtube' ? `${env.CLIENT_ORIGIN}/import?youtube=denied` : `${env.CLIENT_ORIGIN}/login?auth=denied`,
      )
    }
    if (typeof code !== 'string' || !verifyAndClearOAuthState(req, res, state as string | undefined)) {
      throw new HttpError(400, 'Requête OAuth invalide (code ou state manquant)')
    }

    const { profile, tokens, youtubeGranted } = await exchangeCodeForTokens(code)

    if (mode === 'youtube') {
      // Les jetons YouTube ne s'attachent qu'au compte de la session courante,
      // et seulement si c'est le même compte Google qui vient de consentir.
      const currentId = getSessionUserId(req)
      const current = currentId ? await prisma.user.findUnique({ where: { id: currentId } }) : null
      if (!current) {
        return res.redirect(`${env.CLIENT_ORIGIN}/login`)
      }
      if (current.googleId !== profile.googleId) {
        return res.redirect(`${env.CLIENT_ORIGIN}/import?youtube=mismatch`)
      }
      if (!youtubeGranted) {
        return res.redirect(`${env.CLIENT_ORIGIN}/import?youtube=denied`)
      }
      await upsertGoogleUser(profile, tokens)
      return res.redirect(`${env.CLIENT_ORIGIN}/import`)
    }

    // Connexion : on ne stocke des jetons que s'ils couvrent YouTube (jamais des jetons
    // d'identité seule, qui écraseraient un accès YouTube encore valide).
    const user = await upsertGoogleUser(profile, youtubeGranted ? tokens : undefined)
    setSession(res, user.id)
    return res.redirect(env.CLIENT_ORIGIN)
  }),
)

// Déconnexion : invalide la session en supprimant le cookie.
authRouter.post('/auth/logout', (_req, res) => {
  clearSession(res)
  res.json({ ok: true })
})

// « Déconnecter YouTube » from Réglages (YC-80): revoked at Google, erased here.
authRouter.delete(
  '/auth/youtube',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await disconnectYouTube(req.userId as string))
  }),
)

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
      youtubeConnected: Boolean(user.ytAccessToken),
    })
  }),
)
