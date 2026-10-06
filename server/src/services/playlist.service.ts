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
  /**
   * The channel under the card (YC-74): whose videos these are, so the one channel they all share. A
   * playlist a user saved belongs to THEIR channel on YouTube, which says nothing of its content: it
   * only stands in when no video names its channel. Null when there is none or several.
   */
  channelTitle?: string | null
  /** The videos come from several channels: the card says « Plusieurs chaînes ». */
  multipleChannels?: boolean
  /** Last time the user watched or marked one of its videos, for the « Récentes » filter (YC-74). */
  lastActivityAt?: string | null
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
  /**
   * Whose videos these are, for the « À propos » card (YC-75): the one channel they all share, else
   * the playlist's own when no video names one. A saved playlist belongs to the user's channel.
   */
  contentChannel: { title: string; avatarUrl: string | null } | null
  /** The videos come from several channels. */
  multipleChannels: boolean
  privacyStatus: 'PUBLIC' | 'UNLISTED' | 'PRIVATE' | null
  /** When the last video was added to the playlist on YouTube, if YouTube said. */
  lastAddedAt: string | null
  /** The playlist on YouTube; null for a playlist merged in Youcus, which exists nowhere else. */
  youtubeUrl: string | null
  /** The playlists a merge is made of (YC-95), oldest import first; empty for any other playlist. */
  sources: PlaylistSource[]
  /** The merge this playlist is a source of, which hides it from the library (YC-95). */
  mergedIntoId: string | null
}

/** A playlist inside a merge (YC-95): hidden from the library, so its note is shown here. */
export interface PlaylistSource {
  id: string
  youtubeId: string
  title: string
  thumbnailUrl: string | null
  channelTitle: string | null
  videoCount: number
  importedAt: string
  /** Plain text of the user's note on this playlist, null when there is none. */
  note: string | null
  youtubeUrl: string
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
    // A source of a merge shows only inside its merge (YC-95).
    where: { ownerId: userId, mergedIntoId: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      youtubeId: true,
      title: true,
      thumbnailUrl: true,
      channel: { select: { title: true } },
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
          channel: { select: { title: true } },
          progress: { where: { userId }, select: { completed: true, updatedAt: true } },
        },
      },
    },
  })
  const available = new Map<string, number>()
  const completed = new Map<string, number>()
  const channels = new Map<string, Set<string>>()
  const lastActivity = new Map<string, Date>()
  for (const entry of entries) {
    const progress = entry.video.progress[0]
    // Any progress dates the playlist, even on a video that has become unavailable since.
    if (progress && progress.updatedAt > (lastActivity.get(entry.playlistId) ?? new Date(0))) {
      lastActivity.set(entry.playlistId, progress.updatedAt)
    }
    if (entry.video.channel) {
      channels.set(entry.playlistId, (channels.get(entry.playlistId) ?? new Set()).add(entry.video.channel.title))
    }
    if (availabilityOf(entry.video) !== 'AVAILABLE') continue
    available.set(entry.playlistId, (available.get(entry.playlistId) ?? 0) + 1)
    if (progress?.completed) {
      completed.set(entry.playlistId, (completed.get(entry.playlistId) ?? 0) + 1)
    }
  }

  return rows.map((r) => {
    const videoChannels = [...(channels.get(r.id) ?? [])]
    return {
      id: r.id,
      youtubeId: r.youtubeId,
      title: r.title,
      thumbnailUrl: r.thumbnailUrl,
      videoCount: r._count.videos,
      completedCount: completed.get(r.id) ?? 0,
      availableCount: available.get(r.id) ?? 0,
      channelTitle: videoChannels.length === 1 ? videoChannels[0] : videoChannels.length === 0 ? (r.channel?.title ?? null) : null,
      multipleChannels: videoChannels.length > 1,
      lastActivityAt: lastActivity.get(r.id)?.toISOString() ?? null,
    }
  })
}

/** Détail d'une playlist de l'utilisateur avec ses vidéos ordonnées. */
export async function getPlaylist(userId: string, id: string): Promise<PlaylistDetail> {
  const pl = await prisma.playlist.findFirst({
    where: { id, ownerId: userId },
    include: {
      channel: { select: { title: true, avatarUrl: true } },
      sources: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          youtubeId: true,
          title: true,
          thumbnailUrl: true,
          createdAt: true,
          channel: { select: { title: true } },
          notes: { where: { authorId: userId }, select: { content: true } },
          _count: { select: { videos: true } },
        },
      },
      videos: {
        orderBy: { position: 'asc' },
        include: {
          video: { include: { progress: { where: { userId } }, channel: { select: { title: true, avatarUrl: true } } } },
        },
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
  const videoChannels = new Map<string, { title: string; avatarUrl: string | null }>()
  for (const pv of pl.videos) if (pv.video.channel) videoChannels.set(pv.video.channel.title, pv.video.channel)
  const addedDates = pl.videos.map((pv) => pv.addedAt?.getTime() ?? 0).filter((t) => t > 0)
  const merged = isMerge(pl)
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
    contentChannel:
      videoChannels.size === 1 ? [...videoChannels.values()][0] : videoChannels.size === 0 ? (pl.channel ?? null) : null,
    multipleChannels: videoChannels.size > 1,
    privacyStatus: pl.privacyStatus ?? null,
    lastAddedAt: addedDates.length ? new Date(Math.max(...addedDates)).toISOString() : null,
    youtubeUrl: merged ? null : `https://www.youtube.com/playlist?list=${pl.youtubeId}`,
    sources: pl.sources.map((src) => ({
      id: src.id,
      youtubeId: src.youtubeId,
      title: src.title,
      thumbnailUrl: src.thumbnailUrl,
      channelTitle: src.channel?.title ?? null,
      videoCount: src._count.videos,
      importedAt: src.createdAt.toISOString(),
      note: src.notes[0]?.content.trim() || null,
      youtubeUrl: `https://www.youtube.com/playlist?list=${src.youtubeId}`,
    })),
    mergedIntoId: pl.mergedIntoId,
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
  if (isMerge(existing)) {
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

/** A merge is a Youcus playlist: its synthetic id exists nowhere on YouTube. */
function isMerge(playlist: { youtubeId: string }): boolean {
  return playlist.youtubeId.startsWith('merge:')
}

/**
 * Fusionne plusieurs playlists de l'utilisateur (YC-95).
 * Les sources sont gardées entières (vidéos, note) et masquées de la bibliothèque par `mergedIntoId`.
 * Si la sélection contient déjà une fusion, c'est elle qui accueille les autres : jamais de fusion de
 * fusions. Vidéos dédupliquées par videoId, dans l'ordre des sources choisies.
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

  const found = await prisma.playlist.findMany({
    where: { id: { in: uniqueIds }, ownerId: userId },
    include: { videos: { orderBy: { position: 'asc' } } },
  })
  if (found.length !== uniqueIds.length) {
    throw new HttpError(404, 'Une ou plusieurs playlists sont introuvables')
  }
  if (found.some((p) => p.mergedIntoId)) {
    throw new HttpError(400, 'Une de ces playlists fait déjà partie d’une fusion')
  }
  // In the order the user chose them, not the order the database returns.
  const selected = uniqueIds.map((id) => found.find((p) => p.id === id)!)
  const merges = selected.filter(isMerge)
  if (merges.length > 1) {
    throw new HttpError(400, 'Une seule fusion à la fois : ajoutez des playlists à une fusion existante')
  }
  const target = merges[0]
  const sources = selected.filter((p) => p !== target)

  const seen = new Set<string>()
  const rows: { videoId: string; position: number }[] = []
  for (const pv of target?.videos ?? []) {
    seen.add(pv.videoId)
    rows.push({ videoId: pv.videoId, position: rows.length })
  }
  const added: { videoId: string; position: number }[] = []
  for (const src of sources) {
    for (const pv of src.videos) {
      if (seen.has(pv.videoId)) continue
      seen.add(pv.videoId)
      added.push({ videoId: pv.videoId, position: rows.length + added.length })
    }
  }

  const merged = await prisma.$transaction(async (tx) => {
    const pl = target
      ? await tx.playlist.update({ where: { id: target.id }, data: { title } })
      : await tx.playlist.create({
          data: {
            ownerId: userId,
            youtubeId: `merge:${randomUUID()}`,
            title,
            thumbnailUrl: sources.find((s) => s.thumbnailUrl)?.thumbnailUrl ?? null,
          },
        })
    if (added.length > 0) {
      await tx.playlistVideo.createMany({ data: added.map((r) => ({ playlistId: pl.id, ...r })) })
    }
    await tx.playlist.updateMany({
      where: { id: { in: sources.map((s) => s.id) }, ownerId: userId },
      data: { mergedIntoId: pl.id },
    })
    return pl
  })

  return {
    id: merged.id,
    youtubeId: merged.youtubeId,
    title: merged.title,
    thumbnailUrl: merged.thumbnailUrl,
    videoCount: rows.length + added.length,
  }
}
