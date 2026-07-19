import { prisma } from '@/lib/prisma'
import { extractPlaylistId, fetchPlaylist } from '@/lib/youtube'

export interface ImportedPlaylist {
  id: string
  youtubeId: string
  title: string
  thumbnailUrl: string | null
  videoCount: number
}

/**
 * Importe (ou ré-importe) une playlist YouTube pour un utilisateur.
 * Upsert de la Playlist sur (ownerId, youtubeId) puis remplacement de ses vidéos.
 */
export async function importPlaylist(userId: string, input: string): Promise<ImportedPlaylist> {
  const playlistId = extractPlaylistId(input)
  const data = await fetchPlaylist(playlistId)

  const playlist = await prisma.$transaction(async (tx) => {
    const pl = await tx.playlist.upsert({
      where: { ownerId_youtubeId: { ownerId: userId, youtubeId: data.youtubeId } },
      create: {
        ownerId: userId,
        youtubeId: data.youtubeId,
        title: data.title,
        description: data.description,
        thumbnailUrl: data.thumbnailUrl,
      },
      update: {
        title: data.title,
        description: data.description,
        thumbnailUrl: data.thumbnailUrl,
      },
    })

    // Remplace le contenu par les vidéos fraîchement récupérées.
    await tx.video.deleteMany({ where: { playlistId: pl.id } })
    if (data.videos.length > 0) {
      await tx.video.createMany({
        data: data.videos.map((v) => ({
          playlistId: pl.id,
          youtubeId: v.youtubeId,
          title: v.title,
          thumbnailUrl: v.thumbnailUrl,
          position: v.position,
        })),
      })
    }
    return pl
  })

  return {
    id: playlist.id,
    youtubeId: playlist.youtubeId,
    title: playlist.title,
    thumbnailUrl: playlist.thumbnailUrl,
    videoCount: data.videos.length,
  }
}
