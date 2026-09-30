import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { HttpError } from '@/middleware/errorHandler'
import { extractPlaylistId, fetchPlaylist, type YouTubePlaylist, type YouTubeVideo } from '@/lib/youtube'
import { cacheAside, invalidate, playlistKey } from '@/lib/cache'
import { availabilityOf, type Availability } from '@/lib/availability'
import { syncChannels, syncChapters, videoMetadata } from '@/services/videoMetadata.service'
import { optionalAccessToken } from '@/services/youtubeToken.service'

/**
 * Lecture des métadonnées d'une playlist YouTube en cache-aside (CS-67).
 * Le cache n'est consulté que pour les playlists PUBLIQUES : une lecture
 * authentifiée (`accessToken`) peut porter sur une playlist privée, dont le
 * contenu ne doit pas être partagé entre utilisateurs via une clé commune.
 */
function fetchPlaylistCached(playlistId: string, accessToken?: string): Promise<YouTubePlaylist> {
  if (accessToken) return fetchPlaylist(playlistId, accessToken)
  return cacheAside(playlistKey(playlistId), () => fetchPlaylist(playlistId))
}

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
  channelIds: Map<string, string> = new Map(),
): Promise<number> {
  // Une même vidéo peut apparaître deux fois dans une playlist YouTube :
  // on garde la première occurrence (la jonction a une PK composite).
  const unique = new Map<string, YouTubeVideo>()
  for (const v of videos) {
    if (!unique.has(v.youtubeId)) unique.set(v.youtubeId, v)
  }

  const syncedAt = new Date()
  const rows: Prisma.PlaylistVideoCreateManyInput[] = []
  for (const v of unique.values()) {
    const metadata = v.details ? videoMetadata(v.details, channelIds, syncedAt) : {}
    const video = await tx.video.upsert({
      where: { youtubeId: v.youtubeId },
      create: { youtubeId: v.youtubeId, title: v.title, thumbnailUrl: v.thumbnailUrl, ...metadata },
      // A video that became private or was deleted keeps the title and thumbnail we already
      // knew: YouTube only sends "Private video" (YC-13).
      update: v.unavailable ? metadata : { title: v.title, thumbnailUrl: v.thumbnailUrl, ...metadata },
    })
    if (v.details) await syncChapters(tx, video.id, v.details)
    rows.push({
      playlistId,
      videoId: video.id,
      position: v.position,
      creatorNote: v.creatorNote ?? null,
      addedAt: v.addedAt ? new Date(v.addedAt) : null,
    })
  }

  await tx.playlistVideo.deleteMany({ where: { playlistId } })
  if (rows.length > 0) {
    await tx.playlistVideo.createMany({ data: rows })
  }
  return rows.length
}

/** Playlist columns filled from playlists.list (YC-1). */
function playlistMetadata(data: YouTubePlaylist, channelIds: Map<string, string>) {
  return {
    itemCount: data.itemCount ?? data.videos.length,
    privacyStatus: data.privacyStatus ?? null,
    channelId: data.channelYoutubeId ? (channelIds.get(data.channelYoutubeId) ?? null) : null,
    syncedAt: new Date(),
  }
}

export interface ImportedPlaylist {
  id: string
  youtubeId: string
  title: string
  thumbnailUrl: string | null
  videoCount: number
  completedCount?: number
  /** Videos that can be played: the progress percentage is counted on these only (YC-13). */
  availableCount?: number
}

/** Unavailable videos of a playlist, by reason (YC-13). */
export interface UnavailableSummary {
  total: number
  private: number
  deleted: number
  notEmbeddable: number
  blocked: number
  upcoming: number
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
  availability: Availability
  /** The playlist author's note on this video (playlistItems.contentDetails.note, YC-14). */
  creatorNote: string | null
}

export interface PlaylistDetail extends ImportedPlaylist {
  description: string | null
  videos: PlaylistVideo[]
  unavailable: UnavailableSummary
  /** Channel that owns the playlist on YouTube: the author of the creator notes (YC-14). */
  channelTitle: string | null
}

function summarize(availabilities: Availability[]): UnavailableSummary {
  const count = (a: Availability) => availabilities.filter((x) => x === a).length
  const summary = {
    private: count('PRIVATE'),
    deleted: count('DELETED'),
    notEmbeddable: count('NOT_EMBEDDABLE'),
    blocked: count('BLOCKED'),
    upcoming: count('UPCOMING'),
  }
  return { total: availabilities.filter((a) => a !== 'AVAILABLE').length, ...summary }
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

  // Per playlist: playable videos and, among them, those seen. Progress is global (CS-70); an
  // unavailable video counts neither way, so a deleted video never blocks 100 % (YC-13).
  const entries = await prisma.playlistVideo.findMany({
    where: { playlistId: { in: rows.map((r) => r.id) } },
    select: {
      playlistId: true,
      video: {
        select: {
          status: true,
          embeddable: true,
          blockedRegions: true,
          progress: { where: { userId, completed: true }, select: { id: true } },
        },
      },
    },
  })
  const available = new Map<string, number>()
  const completed = new Map<string, number>()
  for (const entry of entries) {
    if (availabilityOf(entry.video) !== 'AVAILABLE') continue
    available.set(entry.playlistId, (available.get(entry.playlistId) ?? 0) + 1)
    if (entry.video.progress.length > 0) {
      completed.set(entry.playlistId, (completed.get(entry.playlistId) ?? 0) + 1)
    }
  }

  return rows.map((r) => ({
    id: r.id,
    youtubeId: r.youtubeId,
    title: r.title,
    thumbnailUrl: r.thumbnailUrl,
    videoCount: r._count.videos,
    completedCount: completed.get(r.id) ?? 0,
    availableCount: available.get(r.id) ?? 0,
  }))
}

/** Détail d'une playlist de l'utilisateur avec ses vidéos ordonnées. */
export async function getPlaylist(userId: string, id: string): Promise<PlaylistDetail> {
  const pl = await prisma.playlist.findFirst({
    where: { id, ownerId: userId },
    include: {
      channel: { select: { title: true } },
      videos: {
        orderBy: { position: 'asc' },
        include: { video: { include: { progress: { where: { userId } } } } },
      },
    },
  })
  if (!pl) throw new HttpError(404, 'Playlist introuvable')
  const videos = pl.videos.map((pv) => ({
    id: pv.video.id,
    youtubeId: pv.video.youtubeId,
    title: pv.video.title,
    thumbnailUrl: pv.video.thumbnailUrl,
    position: pv.position,
    durationSeconds: pv.video.durationSeconds,
    completed: pv.video.progress[0]?.completed ?? false,
    watchedSeconds: pv.video.progress[0]?.watchedSeconds ?? 0,
    availability: availabilityOf(pv.video),
    creatorNote: pv.creatorNote,
  }))
  return {
    id: pl.id,
    youtubeId: pl.youtubeId,
    title: pl.title,
    thumbnailUrl: pl.thumbnailUrl,
    description: pl.description,
    videoCount: videos.length,
    availableCount: videos.filter((v) => v.availability === 'AVAILABLE').length,
    videos,
    unavailable: summarize(videos.map((v) => v.availability)),
    channelTitle: pl.channel?.title ?? null,
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
  const data = await fetchPlaylistCached(playlistId, accessToken)

  const { playlist, videoCount } = await prisma.$transaction(async (tx) => {
    const channelIds = await syncChannels(tx, data.channels)
    const metadata = playlistMetadata(data, channelIds)
    const pl = await tx.playlist.upsert({
      where: { ownerId_youtubeId: { ownerId: userId, youtubeId: data.youtubeId } },
      create: {
        ownerId: userId,
        youtubeId: data.youtubeId,
        title: data.title,
        description: data.description,
        thumbnailUrl: data.thumbnailUrl,
        ...metadata,
      },
      update: {
        title: data.title,
        description: data.description,
        thumbnailUrl: data.thumbnailUrl,
        ...metadata,
      },
    })

    const count = await syncVideos(tx, pl.id, data.videos, channelIds)
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

  // Le rafraîchissement manuel est une demande explicite de fraîcheur :
  // on purge la clé avant de relire, sinon l'utilisateur reverrait le cache.
  await invalidate(playlistKey(existing.youtubeId))
  // YC-30: a private playlist was imported with the user's token, the server key cannot see it.
  const accessToken = await optionalAccessToken(userId)
  let data: YouTubePlaylist
  try {
    data = await fetchPlaylist(existing.youtubeId, accessToken)
  } catch (err) {
    if (!accessToken && existing.privacyStatus === 'PRIVATE' && err instanceof HttpError && err.status === 404) {
      throw new HttpError(403, 'Connectez votre compte YouTube pour rafraîchir cette playlist privée')
    }
    throw err
  }

  const { playlist, videoCount } = await prisma.$transaction(async (tx) => {
    const channelIds = await syncChannels(tx, data.channels)
    const pl = await tx.playlist.update({
      where: { id: existing.id },
      data: {
        title: data.title,
        description: data.description,
        thumbnailUrl: data.thumbnailUrl,
        ...playlistMetadata(data, channelIds),
      },
    })
    const count = await syncVideos(tx, pl.id, data.videos, channelIds)
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
