import { prisma } from '@/lib/prisma'
import { HttpError } from '@/middleware/errorHandler'
import { refreshAccessToken, revokeToken } from '@/lib/googleOAuth'

/**
 * Renvoie un jeton d'accès YouTube valide pour l'utilisateur,
 * en le rafraîchissant si nécessaire. 403 si le compte n'est pas (ou plus) connecté à YouTube.
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user?.ytAccessToken) {
    throw new HttpError(403, 'Connectez votre compte YouTube (reconnexion requise)')
  }

  const expiresAt = user.ytTokenExpiry?.getTime() ?? 0
  // Marge de 60 s pour éviter d'utiliser un jeton sur le point d'expirer.
  if (expiresAt - Date.now() > 60_000) return user.ytAccessToken

  // Jeton mort (pas de refresh token, ou refus de Google : révoqué, ou expiré au bout de 7 jours
  // quand l'app OAuth est en « Testing ») : on l'efface et on répond 403, pour que le client
  // propose de reconnecter YouTube. Le 401 reste réservé à l'absence de session Youcus.
  const refreshed = user.ytRefreshToken
    ? await refreshAccessToken(user.ytRefreshToken).catch(() => null)
    : null
  if (!refreshed) {
    await prisma.user.update({
      where: { id: userId },
      data: { ytAccessToken: null, ytRefreshToken: null, ytTokenExpiry: null, ytExpiredAt: new Date() },
    })
    throw new HttpError(403, 'Accès YouTube expiré, reconnectez votre compte YouTube')
  }
  await prisma.user.update({
    where: { id: userId },
    data: { ytAccessToken: refreshed.accessToken, ytTokenExpiry: refreshed.expiresAt },
  })
  return refreshed.accessToken
}

/**
 * The user's YouTube token when they have one that works, otherwise `undefined` (YC-30).
 * For reads that can do without the account: a public playlist is read with the server API key.
 * A dead token is still cleared by getValidAccessToken.
 */
export async function optionalAccessToken(userId: string): Promise<string | undefined> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { ytAccessToken: true } })
  if (!user?.ytAccessToken) return undefined
  try {
    return await getValidAccessToken(userId)
  } catch (err) {
    if (err instanceof HttpError && err.status === 403) return undefined
    throw err
  }
}

/**
 * « Déconnecter YouTube » (YC-80): the grant is revoked at Google, then the tokens are erased here,
 * whatever Google answered: the user asked Youcus to forget the access, and it does. `revoked` says
 * whether Google confirmed it, so the page can tell the user to check their Google account if not.
 */
export async function disconnectYouTube(userId: string): Promise<{ revoked: boolean }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { ytAccessToken: true, ytRefreshToken: true },
  })
  const token = user?.ytRefreshToken ?? user?.ytAccessToken
  if (!token) return { revoked: true }
  const revoked = await revokeToken(token)
  // A choice, not an expiry: no « Connexion YouTube expirée » after it (YC-84).
  await prisma.user.update({
    where: { id: userId },
    data: { ytAccessToken: null, ytRefreshToken: null, ytTokenExpiry: null, ytExpiredAt: null },
  })
  return { revoked }
}
