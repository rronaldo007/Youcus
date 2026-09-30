import { prisma } from '@/lib/prisma'
import { listMyPlaylists as ytListMyPlaylists } from '@/lib/youtube'
import { importPlaylist } from '@/services/playlist.service'
import { getValidAccessToken } from '@/services/youtubeToken.service'

export interface MyPlaylistItem {
  youtubeId: string
  title: string
  thumbnailUrl: string | null
  videoCount: number
  alreadyImported: boolean
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
