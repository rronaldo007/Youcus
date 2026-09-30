import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { chunk, fetchChannels, fetchVideoDetails, YOUTUBE_BATCH_SIZE } from '@/lib/youtube'
import { syncChannels, syncChapters, videoMetadata } from '@/services/videoMetadata.service'

/**
 * YouTube API policy (III.E.4): data read from the API must be refreshed or deleted after 30
 * days. Videos imported before YC-1 were never synced at all (no duration, no description).
 */
export const STALE_AFTER_DAYS = 30
/** Cap per run: 1,000 videos cost about 40 quota units out of 10,000 a day. */
export const DEFAULT_MAX_VIDEOS = 1000

export interface RefreshReport {
  checked: number
  refreshed: number
  /** Asked for but not served with the server key: private or deleted, their API data wiped. */
  unavailable: number
  quotaUnits: number
}

/**
 * Refreshes the videos never synced or synced more than 30 days ago (YC-8), with the server API
 * key, by batches of 50. A video YouTube does not return gets its API data wiped (description,
 * counters, chapters) as the policy requires, and is marked unavailable. Never cached: the Redis
 * cache is only for playlist reads, and a refresh must read fresh data anyway.
 */
export async function refreshStaleVideos(options: { maxVideos?: number; now?: Date } = {}): Promise<RefreshReport> {
  const now = options.now ?? new Date()
  const limit = new Date(now.getTime() - STALE_AFTER_DAYS * 24 * 3600 * 1000)
  const stale = await prisma.video.findMany({
    where: { OR: [{ syncedAt: null }, { syncedAt: { lt: limit } }] },
    orderBy: { syncedAt: 'asc' },
    take: options.maxVideos ?? DEFAULT_MAX_VIDEOS,
    select: { id: true, youtubeId: true },
  })

  const report: RefreshReport = { checked: stale.length, refreshed: 0, unavailable: 0, quotaUnits: 0 }
  for (const batch of chunk(stale, YOUTUBE_BATCH_SIZE)) {
    const details = await fetchVideoDetails(batch.map((v) => v.youtubeId))
    report.quotaUnits += 1
    const channelIds = [
      ...new Set([...details.values()].map((d) => d.channelYoutubeId).filter((id): id is string => Boolean(id))),
    ]
    const channels = channelIds.length > 0 ? await fetchChannels(channelIds) : []
    report.quotaUnits += Math.ceil(channelIds.length / YOUTUBE_BATCH_SIZE)

    await prisma.$transaction(async (tx) => {
      const channelMap = await syncChannels(tx, channels)
      for (const video of batch) {
        const d = details.get(video.youtubeId)
        if (!d) continue
        await tx.video.update({ where: { id: video.id }, data: videoMetadata(d, channelMap, now) })
        await syncChapters(tx, video.id, d)
        if (d.status === 'DELETED') report.unavailable += 1
        else report.refreshed += 1
      }
    })
  }
  return report
}

/** Runs the refresh and logs the report; a failure (quota, network) is logged, never thrown. */
export async function runMetadataRefresh(maxVideos?: number): Promise<RefreshReport | null> {
  try {
    const report = await refreshStaleVideos({ maxVideos })
    logger.info(report, 'Métadonnées YouTube rafraîchies (YC-8)')
    return report
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'Rafraîchissement des métadonnées interrompu')
    return null
  }
}
