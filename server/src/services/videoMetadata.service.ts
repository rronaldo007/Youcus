import { Prisma } from '@prisma/client'
import { parseChapters } from '@/lib/chapters'
import type { VideoDetails, YouTubeChannel } from '@/lib/youtube'

// Writing YouTube metadata, shared by the import (YC-1) and the 30-day refresh (YC-8).

/**
 * Rebuilds the chapters of a video from its description (YC-3). Chapters are derived data:
 * they are replaced on every sync, so an edited description never leaves stale chapters.
 */
export async function syncChapters(tx: Prisma.TransactionClient, videoId: string, details: VideoDetails): Promise<void> {
  const chapters = parseChapters(details.description, details.durationSeconds)
  await tx.chapter.deleteMany({ where: { videoId } })
  if (chapters.length > 0) {
    await tx.chapter.createMany({ data: chapters.map((c) => ({ videoId, ...c })) })
  }
}

/** Video columns filled from videos.list (YC-1). Counters become BigInt at the database edge. */
export function videoMetadata(
  d: VideoDetails,
  channelIds: Map<string, string>,
  syncedAt: Date,
): Omit<Prisma.VideoUncheckedCreateInput, 'youtubeId' | 'title'> {
  return {
    durationSeconds: d.durationSeconds,
    description: d.description,
    channelId: d.channelYoutubeId ? (channelIds.get(d.channelYoutubeId) ?? null) : null,
    publishedAt: d.publishedAt ? new Date(d.publishedAt) : null,
    viewCount: d.viewCount === null ? null : BigInt(d.viewCount),
    likeCount: d.likeCount === null ? null : BigInt(d.likeCount),
    status: d.status,
    embeddable: d.embeddable,
    blockedRegions: d.blockedRegions ?? Prisma.DbNull,
    topics: d.topics ?? Prisma.DbNull,
    hasPaidPromotion: d.hasPaidPromotion,
    definition: d.definition,
    hasCaptions: d.hasCaptions,
    syncedAt,
  }
}

/** Upserts the channels by YouTube id and returns YouTube id → Channel.id. */
export async function syncChannels(
  tx: Prisma.TransactionClient,
  channels: YouTubeChannel[] | undefined,
): Promise<Map<string, string>> {
  const ids = new Map<string, string>()
  for (const c of channels ?? []) {
    const data = { title: c.title, handle: c.handle, avatarUrl: c.avatarUrl }
    const row = await tx.channel.upsert({
      where: { youtubeId: c.youtubeId },
      create: { youtubeId: c.youtubeId, ...data },
      update: data,
    })
    ids.set(c.youtubeId, row.id)
  }
  return ids
}

