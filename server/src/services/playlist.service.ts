import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { HttpError } from '@/middleware/errorHandler'
import { extractPlaylistId, fetchPlaylist, type YouTubeVideo } from '@/lib/youtube'

/** Remplace le contenu vidéo d'une playlist par la liste fraîchement récupérée. */
async function replaceVideos(
  tx: Prisma.TransactionClient,
  playlistId: string,
  videos: YouTubeVideo[],
): Promise<void> {
  await tx.video.deleteMany({ where: { playlistId } })
  if (videos.length > 0) {
    await tx.video.createMany({
      data: videos.map((v) => ({
        playlistId,
        youtubeId: v.youtubeId,
        title: v.title,
        thumbnailUrl: v.thumbnailUrl,
        position: v.position,
      })),
    })
  }
}

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
export async function importPlaylist(
  userId: string,
  input: string,
  accessToken?: string,
): Promise<ImportedPlaylist> {
  const playlistId = extractPlaylistId(input)
  const data = await fetchPlaylist(playlistId, accessToken)

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

    await replaceVideos(tx, pl.id, data.videos)
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

/**
 * Rafraîchit une playlist déjà importée : re-fetch YouTube par son `youtubeId`
 * puis remplace ses vidéos (ajouts / retraits pris en compte).
 */
export async function refreshPlaylist(userId: string, id: string): Promise<ImportedPlaylist> {
  const existing = await prisma.playlist.findFirst({ where: { id, ownerId: userId } })
  if (!existing) throw new HttpError(404, 'Playlist introuvable')
  if (existing.youtubeId.startsWith('merge:')) {
    throw new HttpError(400, 'Une playlist fusionnée ne peut pas être rafraîchie')
  }

  const data = await fetchPlaylist(existing.youtubeId)

  const updated = await prisma.$transaction(async (tx) => {
    const pl = await tx.playlist.update({
      where: { id: existing.id },
      data: {
        title: data.title,
        description: data.description,
        thumbnailUrl: data.thumbnailUrl,
      },
    })
    await replaceVideos(tx, pl.id, data.videos)
    return pl
  })

  return {
    id: updated.id,
    youtubeId: updated.youtubeId,
    title: updated.title,
    thumbnailUrl: updated.thumbnailUrl,
    videoCount: data.videos.length,
  }
}

/**
 * Fusionne plusieurs playlists de l'utilisateur en une nouvelle playlist.
 * Vidéos dédupliquées par `youtubeId` (1re occurrence gardée), positions recalculées.
 * Les playlists sources sont conservées. La fusion reçoit un `youtubeId` synthétique.
 */
export async function mergePlaylists(
  userId: string,
  sourceIds: string[],
  title: string,
): Promise<ImportedPlaylist> {
  const uniqueIds = [...new Set(sourceIds)]
  if (uniqueIds.length < 2) {
    throw new HttpError(400, 'Sélectionnez au moins 2 playlists à fusionner')
  }

  const sources = await prisma.playlist.findMany({
    where: { id: { in: uniqueIds }, ownerId: userId },
    include: { videos: { orderBy: { position: 'asc' } } },
  })
  if (sources.length !== uniqueIds.length) {
    throw new HttpError(404, 'Une ou plusieurs playlists sont introuvables')
  }

  const seen = new Set<string>()
  const mergedVideos: YouTubeVideo[] = []
  for (const src of sources) {
    for (const v of src.videos) {
      if (seen.has(v.youtubeId)) continue
      seen.add(v.youtubeId)
      mergedVideos.push({
        youtubeId: v.youtubeId,
        title: v.title,
        thumbnailUrl: v.thumbnailUrl,
        position: mergedVideos.length,
      })
    }
  }

  const thumbnailUrl = sources.find((s) => s.thumbnailUrl)?.thumbnailUrl ?? null

  const created = await prisma.$transaction(async (tx) => {
    const pl = await tx.playlist.create({
      data: { ownerId: userId, youtubeId: `merge:${randomUUID()}`, title, thumbnailUrl },
    })
    await replaceVideos(tx, pl.id, mergedVideos)
    return pl
  })

  return {
    id: created.id,
    youtubeId: created.youtubeId,
    title: created.title,
    thumbnailUrl: created.thumbnailUrl,
    videoCount: mergedVideos.length,
  }
}
