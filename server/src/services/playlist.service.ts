import { prisma } from '@/lib/prisma'
import { HttpError } from '@/middleware/errorHandler'
import { extractPlaylistId, fetchPlaylist } from '@/lib/youtube'

export interface ImportedPlaylist {
  id: string
  youtubeId: string
  title: string
  thumbnailUrl: string | null
  videoCount: number
}

export interface PlaylistVideo {
  id: string
  youtubeId: string
  title: string
  thumbnailUrl: string | null
  position: number
  durationSeconds: number
}

export interface PlaylistDetail extends ImportedPlaylist {
  description: string | null
  videos: PlaylistVideo[]
}

/** Liste les playlists de l'utilisateur (résumé + nombre de vidéos), plus récentes d'abord. */
export async function listPlaylists(userId: string): Promise<ImportedPlaylist[]> {
  const rows = await prisma.playlist.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      youtubeId: true,
      title: true,
      thumbnailUrl: true,
      _count: { select: { videos: true } },
    },
  })
  return rows.map((r) => ({
    id: r.id,
    youtubeId: r.youtubeId,
    title: r.title,
    thumbnailUrl: r.thumbnailUrl,
    videoCount: r._count.videos,
  }))
}

/** Détail d'une playlist de l'utilisateur avec ses vidéos ordonnées. */
export async function getPlaylist(userId: string, id: string): Promise<PlaylistDetail> {
  const pl = await prisma.playlist.findFirst({
    where: { id, ownerId: userId },
    include: { videos: { orderBy: { position: 'asc' } } },
  })
  if (!pl) throw new HttpError(404, 'Playlist introuvable')
  return {
    id: pl.id,
    youtubeId: pl.youtubeId,
    title: pl.title,
    thumbnailUrl: pl.thumbnailUrl,
    description: pl.description,
    videoCount: pl.videos.length,
    videos: pl.videos.map((v) => ({
      id: v.id,
      youtubeId: v.youtubeId,
      title: v.title,
      thumbnailUrl: v.thumbnailUrl,
      position: v.position,
      durationSeconds: v.durationSeconds,
    })),
  }
}

/** Supprime une playlist de l'utilisateur (scoping par ownerId). */
export async function deletePlaylist(userId: string, id: string): Promise<void> {
  const result = await prisma.playlist.deleteMany({ where: { id, ownerId: userId } })
  if (result.count === 0) throw new HttpError(404, 'Playlist introuvable')
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
