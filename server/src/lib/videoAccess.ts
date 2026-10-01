import type { Prisma } from '@prisma/client'

/**
 * The videos a user may read, annotate and track: those of one of their playlists, or those
 * added on their own to their library (YC-61). One rule for the video, its note and its progress;
 * anything else is a 404, with no hint that the video exists.
 */
export function accessibleBy(userId: string): Prisma.VideoWhereInput {
  return {
    OR: [{ playlists: { some: { playlist: { ownerId: userId } } } }, { libraryEntries: { some: { userId } } }],
  }
}
