import { prisma } from '@/lib/prisma'
import { HttpError } from '@/middleware/errorHandler'
import { refreshAccessToken } from '@/lib/googleOAuth'
import { listMyPlaylists as ytListMyPlaylists } from '@/lib/youtube'
import { importPlaylist } from '@/services/playlist.service'

export interface MyPlaylistItem {
  youtubeId: string
  title: string
  thumbnailUrl: string | null
  videoCount: number
  alreadyImported: boolean
}

/**
 * Renvoie un jeton d'accès YouTube valide pour l'utilisateur,
 * en le rafraîchissant si nécessaire. 403 si le compte n'est pas connecté à YouTube.
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user?.ytAccessToken) {
    throw new HttpError(403, 'Connectez votre compte YouTube (reconnexion requise)')
  }

  const expiresAt = user.ytTokenExpiry?.getTime() ?? 0
  // Marge de 60 s pour éviter d'utiliser un jeton sur le point d'expirer.
  if (expiresAt - Date.now() > 60_000) return user.ytAccessToken

  if (!user.ytRefreshToken) {
    throw new HttpError(401, 'Session YouTube expirée, reconnectez-vous')
  }
  const refreshed = await refreshAccessToken(user.ytRefreshToken)
  await prisma.user.update({
    where: { id: userId },
    data: { ytAccessToken: refreshed.accessToken, ytTokenExpiry: refreshed.expiresAt },
  })
  return refreshed.accessToken
}

/** Liste les playlists du compte YouTube de l'utilisateur, en marquant les déjà importées. */
export async function listMyPlaylists(userId: string): Promise<MyPlaylistItem[]> {
  const token = await getValidAccessToken(userId)
  const mine = await ytListMyPlaylists(token)

  const existing = await prisma.playlist.findMany({
    where: { ownerId: userId, youtubeId: { in: mine.map((p) => p.youtubeId) } },
    select: { youtubeId: true },
  })
  const imported = new Set(existing.map((e) => e.youtubeId))

  return mine.map((p) => ({ ...p, alreadyImported: imported.has(p.youtubeId) }))
}

/** Importe en lot les playlists sélectionnées (avec le jeton utilisateur pour les privées). */
export async function importSelectedPlaylists(
  userId: string,
  playlistIds: string[],
): Promise<{ imported: number }> {
  const token = await getValidAccessToken(userId)
  let imported = 0
  for (const id of playlistIds) {
    await importPlaylist(userId, id, token)
    imported += 1
  }
  return { imported }
}
