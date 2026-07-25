import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { HttpError } from '@/middleware/errorHandler'
import { extractPlaylistId, fetchPlaylist, type YouTubeVideo } from '@/lib/youtube'

/**
 * Synchronise le contenu d'une playlist avec la liste fraîchement récupérée (CS-70).
 * Les Video sont partagées (upsert par youtubeId) et ne sont JAMAIS supprimées ici :
 * seules les lignes de jonction PlaylistVideo sont remplacées. Les Note et Progress
 * qui pointent vers les Video survivent donc au refresh par construction (corrige CS-68).
 * Retourne le nombre d'entrées de la playlist.
 */
async function syncVideos(
  tx: Prisma.TransactionClient,
  playlistId: string,
  videos: YouTubeVideo[],
): Promise<number> {
  // Une même vidéo peut apparaître deux fois dans une playlist YouTube :
  // on garde la première occurrence (la jonction a une PK composite).
  const unique = new Map<string, YouTubeVideo>()
  for (const v of videos) {
    if (!unique.has(v.youtubeId)) unique.set(v.youtubeId, v)
  }

  const rows: { playlistId: string; videoId: string; position: number }[] = []
  for (const v of unique.values()) {
    const video = await tx.video.upsert({
      where: { youtubeId: v.youtubeId },
      create: { youtubeId: v.youtubeId, title: v.title, thumbnailUrl: v.thumbnailUrl },
      update: { title: v.title, thumbnailUrl: v.thumbnailUrl },
    })
    rows.push({ playlistId, videoId: video.id, position: v.position })
  }

  await tx.playlistVideo.deleteMany({ where: { playlistId } })
  if (rows.length > 0) {
    await tx.playlistVideo.createMany({ data: rows })
  }
  return rows.length
}

export interface ImportedPlaylist {
  id: string
  youtubeId: string
  title: string
  thumbnailUrl: string | null
  videoCount: number
  completedCount?: number
}

/** Vidéo d'une playlist telle qu'exposée par l'API (position = celle de la jonction). */
export interface PlaylistVideo {
  id: string
  youtubeId: string
  title: string
  thumbnailUrl: string | null
  position: number
  durationSeconds: number
  completed: boolean
  watchedSeconds: number
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

  // Vidéos vues par playlist : la progression est globale (CS-70), on compte
  // les entrées de jonction dont la vidéo a un Progress completed de l'utilisateur.
  const completedRows = await prisma.playlistVideo.findMany({
    where: {
      playlistId: { in: rows.map((r) => r.id) },
      video: { progress: { some: { userId, completed: true } } },
    },
    select: { playlistId: true },
  })
  const completedByPlaylist = new Map<string, number>()
  for (const row of completedRows) {
    completedByPlaylist.set(row.playlistId, (completedByPlaylist.get(row.playlistId) ?? 0) + 1)
  }

  return rows.map((r) => ({
    id: r.id,
    youtubeId: r.youtubeId,
    title: r.title,
    thumbnailUrl: r.thumbnailUrl,
    videoCount: r._count.videos,
    completedCount: completedByPlaylist.get(r.id) ?? 0,
  }))
}

/** Détail d'une playlist de l'utilisateur avec ses vidéos ordonnées. */
export async function getPlaylist(userId: string, id: string): Promise<PlaylistDetail> {
  const pl = await prisma.playlist.findFirst({
    where: { id, ownerId: userId },
    include: {
      videos: {
        orderBy: { position: 'asc' },
        include: { video: { include: { progress: { where: { userId } } } } },
      },
    },
  })
  if (!pl) throw new HttpError(404, 'Playlist introuvable')
  return {
    id: pl.id,
    youtubeId: pl.youtubeId,
    title: pl.title,
    thumbnailUrl: pl.thumbnailUrl,
    description: pl.description,
    videoCount: pl.videos.length,
    videos: pl.videos.map((pv) => ({
      id: pv.video.id,
      youtubeId: pv.video.youtubeId,
      title: pv.video.title,
      thumbnailUrl: pv.video.thumbnailUrl,
      position: pv.position,
      durationSeconds: pv.video.durationSeconds,
      completed: pv.video.progress[0]?.completed ?? false,
      watchedSeconds: pv.video.progress[0]?.watchedSeconds ?? 0,
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
 * Upsert de la Playlist sur (ownerId, youtubeId) puis synchronisation de ses vidéos.
 */
export async function importPlaylist(
  userId: string,
  input: string,
  accessToken?: string,
): Promise<ImportedPlaylist> {
  const playlistId = extractPlaylistId(input)
  const data = await fetchPlaylist(playlistId, accessToken)

  const { playlist, videoCount } = await prisma.$transaction(async (tx) => {
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

    const count = await syncVideos(tx, pl.id, data.videos)
    return { playlist: pl, videoCount: count }
  })

  return {
    id: playlist.id,
    youtubeId: playlist.youtubeId,
    title: playlist.title,
    thumbnailUrl: playlist.thumbnailUrl,
    videoCount,
  }
}

/**
 * Rafraîchit une playlist déjà importée : re-fetch YouTube par son `youtubeId`
 * puis synchronise ses vidéos (ajouts / retraits pris en compte, notes et
 * progressions préservées — voir syncVideos).
 */
export async function refreshPlaylist(userId: string, id: string): Promise<ImportedPlaylist> {
  const existing = await prisma.playlist.findFirst({ where: { id, ownerId: userId } })
  if (!existing) throw new HttpError(404, 'Playlist introuvable')
  if (existing.youtubeId.startsWith('merge:')) {
    throw new HttpError(400, 'Une playlist fusionnée ne peut pas être rafraîchie')
  }

  const data = await fetchPlaylist(existing.youtubeId)

  const { playlist, videoCount } = await prisma.$transaction(async (tx) => {
    const pl = await tx.playlist.update({
      where: { id: existing.id },
      data: {
        title: data.title,
        description: data.description,
        thumbnailUrl: data.thumbnailUrl,
      },
    })
    const count = await syncVideos(tx, pl.id, data.videos)
    return { playlist: pl, videoCount: count }
  })

  return {
    id: playlist.id,
    youtubeId: playlist.youtubeId,
    title: playlist.title,
    thumbnailUrl: playlist.thumbnailUrl,
    videoCount,
  }
}

/**
 * Fusionne plusieurs playlists de l'utilisateur en une nouvelle playlist.
 * Avec le modèle N:N, la fusion référence directement les Video partagées :
 * déduplication par videoId, positions recalculées, sources conservées.
 * La fusion reçoit un `youtubeId` synthétique.
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
  const mergedRows: { videoId: string; position: number }[] = []
  for (const src of sources) {
    for (const pv of src.videos) {
      if (seen.has(pv.videoId)) continue
      seen.add(pv.videoId)
      mergedRows.push({ videoId: pv.videoId, position: mergedRows.length })
    }
  }

  const thumbnailUrl = sources.find((s) => s.thumbnailUrl)?.thumbnailUrl ?? null

  const created = await prisma.$transaction(async (tx) => {
    const pl = await tx.playlist.create({
      data: { ownerId: userId, youtubeId: `merge:${randomUUID()}`, title, thumbnailUrl },
    })
    if (mergedRows.length > 0) {
      await tx.playlistVideo.createMany({
        data: mergedRows.map((r) => ({ playlistId: pl.id, ...r })),
      })
    }
    return pl
  })

  return {
    id: created.id,
    youtubeId: created.youtubeId,
    title: created.title,
    thumbnailUrl: created.thumbnailUrl,
    videoCount: mergedRows.length,
  }
}
