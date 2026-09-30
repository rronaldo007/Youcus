import type { VideoStatus } from '@prisma/client'

/** Why a video cannot be played in Youcus, or AVAILABLE (YC-13). */
export type Availability = 'AVAILABLE' | 'PRIVATE' | 'DELETED' | 'NOT_EMBEDDABLE' | 'BLOCKED' | 'UPCOMING'

/** Youcus is used from France: a video blocked there cannot be played. */
export const VIEWER_REGION = 'FR'

/**
 * One reason per video, the most definitive first: gone (deleted, private) before "cannot be
 * embedded", before "blocked here", before "not started yet". A live stream plays.
 */
export function availabilityOf(video: {
  status: VideoStatus
  embeddable: boolean
  blockedRegions: unknown
}): Availability {
  if (video.status === 'DELETED') return 'DELETED'
  if (video.status === 'PRIVATE') return 'PRIVATE'
  if (!video.embeddable) return 'NOT_EMBEDDABLE'
  if (
    video.status === 'BLOCKED' ||
    (Array.isArray(video.blockedRegions) && video.blockedRegions.includes(VIEWER_REGION))
  ) {
    return 'BLOCKED'
  }
  if (video.status === 'UPCOMING') return 'UPCOMING'
  return 'AVAILABLE'
}
