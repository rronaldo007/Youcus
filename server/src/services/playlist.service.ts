import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { HttpError } from '@/middleware/errorHandler'
import { extractPlaylistId, fetchPlaylist, type YouTubePlaylist, type YouTubeVideo } from '@/lib/youtube'
import { cacheAside, invalidate, playlistKey } from '@/lib/cache'
import { availabilityOf, type Availability } from '@/lib/availability'
import { syncChannels, syncChapters, videoMetadata } from '@/services/videoMetadata.service'
import { optionalAccessToken } from '@/services/youtubeToken.service'
import { sameNameKey } from '@/lib/playlistTitle'
import { carryMergeNote, type CarriedNote } from '@/services/note.service'

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
 * A playlist the user reordered (`customOrder`, YC-101) keeps their order: the videos still there keep their
 * place, the new ones go last in YouTube's order. `sourcePosition` always takes YouTube's.
 */
async function syncVideos(
  tx: Prisma.TransactionClient,
  playlistId: string,
  videos: YouTubeVideo[],
  channelIds: Map<string, string> = new Map(),
  customOrder = false,
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
      sourcePosition: v.position,
      creatorNote: v.creatorNote ?? null,
      addedAt: v.addedAt ? new Date(v.addedAt) : null,
    })
  }

  if (customOrder) await keepUserOrder(tx, playlistId, rows)
  await tx.playlistVideo.deleteMany({ where: { playlistId } })
  if (rows.length > 0) {
    await tx.playlistVideo.createMany({ data: rows })
  }
  return rows.length
}

/** Re-numbers fresh rows by the user's order (YC-101): known videos first as they were, new ones after. */
async function keepUserOrder(
  tx: Prisma.TransactionClient,
  playlistId: string,
  rows: Prisma.PlaylistVideoCreateManyInput[],
): Promise<void> {
  const before = await tx.playlistVideo.findMany({ where: { playlistId }, select: { videoId: true, position: true } })
  const placed = new Map(before.map((pv) => [pv.videoId, pv.position]))
  const ordered = [...rows].sort((a, b) => {
    const pa = placed.get(a.videoId)
    const pb = placed.get(b.videoId)
    if (pa !== undefined && pb !== undefined) return pa - pb
    if (pa !== undefined) return -1
    if (pb !== undefined) return 1
    return (a.sourcePosition ?? 0) - (b.sourcePosition ?? 0)
  })
  ordered.forEach((row, i) => {
    row.position = i
  })
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

/** The merge an import went into (YC-96): the client tells it, and offers to undo it. */
export interface MergedInto {
  id: string
  title: string
  /** Its playlists, oldest import first. */
  sources: { id: string; title: string }[]
}

export interface ImportResult extends ImportedPlaylist {
  /** Null when the import stands on its own. */
  merged: MergedInto | null
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
  /** The user put the videos in their own order (YC-101): the page offers to go back to the original one. */
  customOrder: boolean
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
    customOrder: pl.customOrder,
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
 * Une première importation qui porte le nom d'une playlist visible la rejoint dans une fusion (YC-96) ;
 * ré-importer la même playlist la rafraîchit seulement, et si elle est déjà source d'une fusion, ses
 * nouvelles vidéos y entrent.
 */
export async function importPlaylist(
  userId: string,
  input: string,
  accessToken?: string,
): Promise<ImportResult> {
  const playlistId = extractPlaylistId(input)
  const data = await fetchPlaylistCached(playlistId, accessToken)
  const prior = await prisma.playlist.findUnique({
    where: { ownerId_youtubeId: { ownerId: userId, youtubeId: data.youtubeId } },
    select: { mergedIntoId: true },
  })

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

    const count = await syncVideos(tx, pl.id, data.videos, channelIds, pl.customOrder)
    return { playlist: pl, videoCount: count }
  })

  let merged: MergedInto | null = null
  if (prior?.mergedIntoId) {
    await appendSourceToMerge(prior.mergedIntoId, playlist.id)
    merged = await describeMerge(prior.mergedIntoId)
  } else if (!prior) {
    const visible = await prisma.playlist.findMany({
      where: { ownerId: userId, mergedIntoId: null, id: { not: playlist.id } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, title: true, youtubeId: true },
    })
    const plan = planImportMerge(playlist, visible)
    if (plan) {
      const merge = await mergePlaylists(userId, plan.ids, plan.title)
      merged = await describeMerge(merge.id)
    }
  }

  return {
    id: playlist.id,
    youtubeId: playlist.youtubeId,
    title: playlist.title,
    thumbnailUrl: playlist.thumbnailUrl,
    videoCount,
    merged,
  }
}

interface PlaylistName {
  id: string
  title: string
  youtubeId: string
}

/**
 * What a first import merges with (YC-96): the visible playlists of the same name (sameNameKey), oldest
 * first. A merge of that name takes the import in, with any other playlist of that name, so there is
 * never a merge of merges; without one, a new merge is created under the oldest playlist's title. Two
 * merges of the same name: nothing is merged, the user chooses (the command of YC-105 leaves them too).
 */
export function planImportMerge(
  imported: PlaylistName,
  visible: PlaylistName[],
): { ids: string[]; title: string } | null {
  const key = sameNameKey(imported.title)
  const same = visible.filter((p) => p.id !== imported.id && sameNameKey(p.title) === key)
  if (same.length === 0) return null
  const merges = same.filter(isMerge)
  if (merges.length > 1) return null
  const into = merges[0]
  const others = same.filter((p) => p !== into)
  // The merge first: it keeps its videos and their order; the import's come last.
  const ids = [...(into ? [into.id] : []), ...others.map((p) => p.id), imported.id]
  return { ids, title: (into ?? same[0]).title }
}

/** A source re-imported (YC-96): its new videos join the end of its merge; none is removed here. */
async function appendSourceToMerge(mergeId: string, sourceId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const inMerge = await tx.playlistVideo.findMany({
      where: { playlistId: mergeId },
      select: { videoId: true, position: true },
    })
    const fromSource = await tx.playlistVideo.findMany({
      where: { playlistId: sourceId },
      orderBy: { position: 'asc' },
      select: { videoId: true },
    })
    const seen = new Set(inMerge.map((pv) => pv.videoId))
    let position = inMerge.reduce((max, pv) => Math.max(max, pv.position), -1) + 1
    const added: { playlistId: string; videoId: string; position: number; sourcePosition: number }[] = []
    for (const pv of fromSource) {
      if (seen.has(pv.videoId)) continue
      seen.add(pv.videoId)
      added.push({ playlistId: mergeId, videoId: pv.videoId, position, sourcePosition: position })
      position++
    }
    if (added.length > 0) await tx.playlistVideo.createMany({ data: added })
  })
}

async function describeMerge(mergeId: string): Promise<MergedInto | null> {
  return prisma.playlist.findUnique({
    where: { id: mergeId },
    select: { id: true, title: true, sources: { orderBy: { createdAt: 'asc' }, select: { id: true, title: true } } },
  })
}

/** A refresh, and for a merge the sources it could not refresh (YC-100): each says why, the others went on. */
export interface RefreshResult extends ImportedPlaylist {
  failedSources?: { id: string; title: string; message: string }[]
}

/**
 * Rafraîchit une playlist déjà importée depuis YouTube. Une fusion (YC-100) rafraîchit chacune de ses sources
 * puis se reconstruit : voir refreshMerge.
 */
export async function refreshPlaylist(userId: string, id: string): Promise<RefreshResult> {
  const existing = await prisma.playlist.findFirst({ where: { id, ownerId: userId } })
  if (!existing) throw new HttpError(404, 'Playlist introuvable')
  return isMerge(existing) ? refreshMerge(userId, existing) : refreshSource(userId, existing)
}

/**
 * Re-fetch YouTube par son `youtubeId` puis synchronise ses vidéos (ajouts / retraits pris en compte, notes et
 * progressions préservées — voir syncVideos).
 */
async function refreshSource(
  userId: string,
  existing: { id: string; youtubeId: string; privacyStatus: string | null },
): Promise<ImportedPlaylist> {
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
    const count = await syncVideos(tx, pl.id, data.videos, channelIds, pl.customOrder)
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
 * Refreshes a merge (YC-100): each source from YouTube, then the merge's own list. The merge keeps its order;
 * a video new in a source goes last; a video gone from EVERY source leaves it. A source that fails (private
 * without a token, deleted on YouTube) is told, keeps its videos, and the others go on. A merge made before
 * YC-95 has no known source: nothing to refresh it from.
 */
async function refreshMerge(userId: string, merge: { id: string; youtubeId: string; title: string; thumbnailUrl: string | null }): Promise<RefreshResult> {
  const sources = await prisma.playlist.findMany({
    where: { mergedIntoId: merge.id, ownerId: userId },
    orderBy: { createdAt: 'asc' },
  })
  if (sources.length === 0) {
    throw new HttpError(400, 'Cette fusion date d’avant le suivi de ses sources : elle ne peut pas être rafraîchie')
  }
  const sourceIds = sources.map((s) => s.id)
  const before = new Set(
    (await prisma.playlistVideo.findMany({ where: { playlistId: { in: sourceIds } }, select: { videoId: true } })).map((pv) => pv.videoId),
  )

  const failedSources: { id: string; title: string; message: string }[] = []
  for (const source of sources) {
    try {
      await refreshSource(userId, source)
    } catch (err) {
      failedSources.push({
        id: source.id,
        title: source.title,
        message: err instanceof HttpError ? err.message : 'Rafraîchissement impossible pour le moment',
      })
    }
  }

  const videoCount = await prisma.$transaction(async (tx) => {
    const rows = await tx.playlistVideo.findMany({
      where: { playlistId: { in: sourceIds } },
      select: { playlistId: true, videoId: true, position: true },
    })
    // The sources' videos now, oldest source first, each in its own order.
    rows.sort((a, b) => sourceIds.indexOf(a.playlistId) - sourceIds.indexOf(b.playlistId) || a.position - b.position)
    const after = [...new Set(rows.map((r) => r.videoId))]
    const inMerge = await tx.playlistVideo.findMany({ where: { playlistId: merge.id }, select: { videoId: true, position: true } })
    const present = new Set(inMerge.map((pv) => pv.videoId))
    const now = new Set(after)

    const gone = inMerge.filter((pv) => before.has(pv.videoId) && !now.has(pv.videoId)).map((pv) => pv.videoId)
    if (gone.length > 0) await tx.playlistVideo.deleteMany({ where: { playlistId: merge.id, videoId: { in: gone } } })

    let position = inMerge.reduce((max, pv) => Math.max(max, pv.position), -1) + 1
    const added = after
      .filter((videoId) => !present.has(videoId))
      .map((videoId) => ({ playlistId: merge.id, videoId, position, sourcePosition: position++ }))
    if (added.length > 0) await tx.playlistVideo.createMany({ data: added })
    return inMerge.length - gone.length + added.length
  })

  return {
    id: merge.id,
    youtubeId: merge.youtubeId,
    title: merge.title,
    thumbnailUrl: merge.thumbnailUrl,
    videoCount,
    ...(failedSources.length > 0 ? { failedSources } : {}),
  }
}

/** A merge is a Youcus playlist: its synthetic id exists nowhere on YouTube. */
export function isMerge(playlist: { youtubeId: string }): boolean {
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
      await tx.playlistVideo.createMany({ data: added.map((r) => ({ playlistId: pl.id, ...r, sourcePosition: r.position })) })
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

/** What detaching a source did (YC-97): the client says it, and the import toast's « Annuler » uses it. */
export interface DetachResult {
  /** The playlist taken out, visible again with its videos and its note. */
  detached: { id: string; title: string }
  /** The merge had one source left: it is gone, and that source is visible again too. */
  dissolved: boolean
  /** The merge as it stays; null once dissolved. */
  merge: MergedInto | null
  /** Where the note of a dissolved merge went (never thrown away). */
  mergeNote: CarriedNote
}

/**
 * Takes a source out of its merge (YC-97). It shows again in the library, whole: it kept its videos and its
 * note all along. The merge loses only the videos that came from that source and from no other one (a video
 * of unknown origin, from a merge made before YC-95, stays). With a single source left, the merge is
 * dissolved: that source shows again, the merge's note goes onto it, and the merge is deleted. Progress and
 * video notes belong to the videos, which are never deleted here.
 */
export async function detachSource(userId: string, mergeId: string, sourceId: string): Promise<DetachResult> {
  const merge = await prisma.playlist.findFirst({
    where: { id: mergeId, ownerId: userId },
    select: { id: true, title: true, youtubeId: true },
  })
  if (!merge || !isMerge(merge)) throw new HttpError(404, 'Fusion introuvable')
  const source = await prisma.playlist.findFirst({
    where: { id: sourceId, ownerId: userId, mergedIntoId: mergeId },
    select: { id: true, title: true },
  })
  if (!source) throw new HttpError(404, 'Cette playlist ne fait pas partie de la fusion')

  const { dissolved, mergeNote } = await prisma.$transaction(async (tx) => {
    await tx.playlist.update({ where: { id: source.id }, data: { mergedIntoId: null } })
    const remaining = await tx.playlist.findMany({ where: { mergedIntoId: mergeId }, select: { id: true } })

    if (remaining.length <= 1) {
      const kept = remaining[0]?.id ?? source.id
      const carried = await carryMergeNote(tx, userId, merge, kept)
      await tx.playlist.updateMany({ where: { mergedIntoId: mergeId }, data: { mergedIntoId: null } })
      await tx.playlist.delete({ where: { id: mergeId } })
      return { dissolved: true, mergeNote: carried }
    }

    const fromSource = await tx.playlistVideo.findMany({ where: { playlistId: source.id }, select: { videoId: true } })
    const elsewhere = await tx.playlistVideo.findMany({
      where: { playlistId: { in: remaining.map((p) => p.id) } },
      select: { videoId: true },
    })
    const kept = new Set(elsewhere.map((pv) => pv.videoId))
    const leaving = fromSource.map((pv) => pv.videoId).filter((id) => !kept.has(id))
    if (leaving.length > 0) {
      await tx.playlistVideo.deleteMany({ where: { playlistId: mergeId, videoId: { in: leaving } } })
    }
    return { dissolved: false, mergeNote: null }
  })

  return {
    detached: source,
    dissolved,
    merge: dissolved ? null : await describeMerge(mergeId),
    mergeNote,
  }
}

/**
 * The user's own order for the videos of a playlist (YC-101), any playlist, a merge too. The list must hold
 * every video of the playlist exactly once, else nothing is written (400): a stale screen never loses a video.
 * A later refresh keeps this order (`customOrder`).
 */
export async function reorderPlaylist(userId: string, id: string, videoIds: string[]): Promise<void> {
  const playlist = await prisma.playlist.findFirst({ where: { id, ownerId: userId }, select: { id: true } })
  if (!playlist) throw new HttpError(404, 'Playlist introuvable')
  const current = await prisma.playlistVideo.findMany({ where: { playlistId: id }, select: { videoId: true } })
  const known = new Set(current.map((pv) => pv.videoId))
  const sent = new Set(videoIds)
  if (sent.size !== videoIds.length || sent.size !== known.size || videoIds.some((v) => !known.has(v))) {
    throw new HttpError(400, 'La liste doit contenir chaque vidéo de la playlist une seule fois')
  }
  await prisma.$transaction(async (tx) => {
    for (const [position, videoId] of videoIds.entries()) {
      await tx.playlistVideo.update({ where: { playlistId_videoId: { playlistId: id, videoId } }, data: { position } })
    }
    await tx.playlist.update({ where: { id }, data: { customOrder: true } })
  })
}

/**
 * Back to the order the playlist came with (YC-101): YouTube's, or the merge's as it was built. No call to
 * YouTube: that order is kept in `sourcePosition`. A video without one (none expected) goes last.
 */
export async function resetPlaylistOrder(userId: string, id: string): Promise<void> {
  const playlist = await prisma.playlist.findFirst({ where: { id, ownerId: userId }, select: { id: true } })
  if (!playlist) throw new HttpError(404, 'Playlist introuvable')
  const rows = await prisma.playlistVideo.findMany({
    where: { playlistId: id },
    select: { videoId: true, position: true, sourcePosition: true },
  })
  const ordered = [...rows].sort(
    (a, b) =>
      (a.sourcePosition ?? Number.MAX_SAFE_INTEGER) - (b.sourcePosition ?? Number.MAX_SAFE_INTEGER) ||
      a.position - b.position,
  )
  await prisma.$transaction(async (tx) => {
    for (const [position, row] of ordered.entries()) {
      await tx.playlistVideo.update({
        where: { playlistId_videoId: { playlistId: id, videoId: row.videoId } },
        data: { position },
      })
    }
    await tx.playlist.update({ where: { id }, data: { customOrder: false } })
  })
}
