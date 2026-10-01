import { prisma } from '@/lib/prisma'
import { HttpError } from '@/middleware/errorHandler'
import { availabilityOf, type Availability } from '@/lib/availability'
import { extractVideoId, fetchVideo } from '@/lib/youtube'
import { syncChannels, syncChapters, videoMetadata } from '@/services/videoMetadata.service'

/** A video of the user's library, kept on its own outside any playlist (YC-61). */
export interface LibraryVideo {
  id: string
  youtubeId: string
  title: string
  thumbnailUrl: string | null
  durationSeconds: number
  channelTitle: string | null
  availability: Availability
  addedAt: string
  completed: boolean
  watchedSeconds: number
  /** When it was marked seen: the last change of a completed progress, null otherwise. */
  completedAt: string | null
}

const include = (userId: string) => ({
  video: {
    include: {
      channel: { select: { title: true } },
      progress: { where: { userId } },
    },
  },
})

type Row = {
  addedAt: Date
  video: {
    id: string
    youtubeId: string
    title: string
    thumbnailUrl: string | null
    durationSeconds: number
    status: Parameters<typeof availabilityOf>[0]['status']
    embeddable: boolean
    blockedRegions: unknown
    channel: { title: string } | null
    progress: { completed: boolean; watchedSeconds: number; updatedAt: Date }[]
  }
}

function toLibraryVideo(row: Row): LibraryVideo {
  const progress = row.video.progress[0]
  return {
    id: row.video.id,
    youtubeId: row.video.youtubeId,
    title: row.video.title,
    thumbnailUrl: row.video.thumbnailUrl,
    durationSeconds: row.video.durationSeconds,
    channelTitle: row.video.channel?.title ?? null,
    availability: availabilityOf(row.video),
    addedAt: row.addedAt.toISOString(),
    completed: progress?.completed ?? false,
    watchedSeconds: progress?.watchedSeconds ?? 0,
    completedAt: progress?.completed ? progress.updatedAt.toISOString() : null,
  }
}

/**
 * Adds a video to the user's library from a link or an id. The Video row is shared (CS-70):
 * upserted by its YouTube id with fresh metadata, then only the library entry is the user's.
 * Adding it again changes nothing and answers the same video.
 */
export async function addLibraryVideo(userId: string, input: string): Promise<LibraryVideo> {
  const youtubeId = extractVideoId(input)
  if (!youtubeId) throw new HttpError(400, 'Lien de vidéo YouTube invalide')
  const { video: data, channels } = await fetchVideo(youtubeId)

  await prisma.$transaction(async (tx) => {
    const channelIds = await syncChannels(tx, channels)
    const metadata = data.details ? videoMetadata(data.details, channelIds, new Date()) : {}
    const video = await tx.video.upsert({
      where: { youtubeId: data.youtubeId },
      create: { youtubeId: data.youtubeId, title: data.title, thumbnailUrl: data.thumbnailUrl, ...metadata },
      update: { title: data.title, thumbnailUrl: data.thumbnailUrl, ...metadata },
    })
    if (data.details) await syncChapters(tx, video.id, data.details)
    await tx.libraryVideo.upsert({
      where: { userId_videoId: { userId, videoId: video.id } },
      create: { userId, videoId: video.id },
      update: {},
    })
  })

  return getLibraryVideo(userId, youtubeId)
}

/** The videos of the user's library, the last added first. */
export async function listLibraryVideos(userId: string): Promise<LibraryVideo[]> {
  const rows = await prisma.libraryVideo.findMany({
    where: { userId },
    orderBy: { addedAt: 'desc' },
    include: include(userId),
  })
  return rows.map(toLibraryVideo)
}

/** One video of the user's library, by its YouTube id (the player's address); 404 otherwise. */
export async function getLibraryVideo(userId: string, youtubeId: string): Promise<LibraryVideo> {
  const row = await prisma.libraryVideo.findFirst({
    where: { userId, video: { youtubeId } },
    include: include(userId),
  })
  if (!row) throw new HttpError(404, 'Vidéo introuvable dans ta bibliothèque')
  return toLibraryVideo(row)
}

/** Takes a video out of the library. Its note and progress stay: adding it back finds them. */
export async function removeLibraryVideo(userId: string, videoId: string): Promise<void> {
  const result = await prisma.libraryVideo.deleteMany({ where: { userId, videoId } })
  if (result.count === 0) throw new HttpError(404, 'Vidéo introuvable dans ta bibliothèque')
}
