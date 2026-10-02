import type { VideoStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { accessibleBy } from '@/lib/videoAccess'
import { HttpError } from '@/middleware/errorHandler'

export interface VideoChapter {
  position: number
  startSeconds: number
  title: string
}

export interface VideoChannel {
  youtubeId: string
  title: string
  handle: string | null
  avatarUrl: string | null
}

/** One video with its YouTube metadata and chapters, as the player reads it (YC-4). */
export interface VideoDetail {
  id: string
  youtubeId: string
  title: string
  thumbnailUrl: string | null
  durationSeconds: number
  description: string | null
  publishedAt: string | null
  /** YouTube category id (snippet.categoryId), e.g. "28" for Science & Technology. */
  categoryId: string | null
  /** Numbers, not BigInt: JSON has no BigInt, and every real count fits in 2^53. */
  viewCount: number | null
  likeCount: number | null
  status: VideoStatus
  embeddable: boolean
  blockedRegions: string[] | null
  topics: string[] | null
  hasPaidPromotion: boolean
  definition: string | null
  hasCaptions: boolean
  /** When the counters were read: they are dated snapshots, never live values. */
  syncedAt: string | null
  channel: VideoChannel | null
  chapters: VideoChapter[]
  /** Where THIS user is in the video (global per video, CS-70): the note page resumes there (YC-77). */
  progress: { watchedSeconds: number; completed: boolean }
}

function asStringArray(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((v) => typeof v === 'string') ? value : null
}

/**
 * Detail of a video for the signed-in user. Scoping: the video must be in one of the user's
 * playlists or in their library (YC-61), otherwise 404 (same rule as notes and progress).
 */
export async function getVideo(userId: string, videoId: string): Promise<VideoDetail> {
  const video = await prisma.video.findFirst({
    where: { id: videoId, ...accessibleBy(userId) },
    include: {
      channel: { select: { youtubeId: true, title: true, handle: true, avatarUrl: true } },
      chapters: { orderBy: { position: 'asc' }, select: { position: true, startSeconds: true, title: true } },
      progress: { where: { userId }, select: { watchedSeconds: true, completed: true } },
    },
  })
  if (!video) throw new HttpError(404, 'Vidéo introuvable')

  return {
    id: video.id,
    youtubeId: video.youtubeId,
    title: video.title,
    thumbnailUrl: video.thumbnailUrl,
    durationSeconds: video.durationSeconds,
    description: video.description,
    publishedAt: video.publishedAt?.toISOString() ?? null,
    categoryId: video.categoryId,
    viewCount: video.viewCount === null ? null : Number(video.viewCount),
    likeCount: video.likeCount === null ? null : Number(video.likeCount),
    status: video.status,
    embeddable: video.embeddable,
    blockedRegions: asStringArray(video.blockedRegions),
    topics: asStringArray(video.topics),
    hasPaidPromotion: video.hasPaidPromotion,
    definition: video.definition,
    hasCaptions: video.hasCaptions,
    syncedAt: video.syncedAt?.toISOString() ?? null,
    channel: video.channel,
    chapters: video.chapters,
    progress: {
      watchedSeconds: video.progress[0]?.watchedSeconds ?? 0,
      completed: video.progress[0]?.completed ?? false,
    },
  }
}
