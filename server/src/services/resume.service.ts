import { prisma } from '@/lib/prisma'
import { availabilityOf } from '@/lib/availability'

/** The video the dashboard offers to resume (Figma « Tableau de bord » 11:5, « Reprendre », YC-74). */
export interface ResumeItem {
  youtubeId: string
  title: string
  thumbnailUrl: string | null
  durationSeconds: number
  watchedSeconds: number
  /** The playlist it is watched in, with its place there; null for a video kept on its own (YC-61). */
  playlist: { id: string; title: string; position: number; total: number } | null
}

/** How many recent progress rows to look through before giving up: a few may have gone unplayable. */
const LOOKBACK = 20

/**
 * The last video the user started and did not finish, still playable and still in one of their
 * playlists or in their library. Progress is global (CS-70), so a row can outlive the playlist it was
 * watched in: such a row is skipped, never offered.
 */
export async function findResume(userId: string): Promise<ResumeItem | null> {
  const rows = await prisma.progress.findMany({
    where: { userId, completed: false, watchedSeconds: { gt: 0 } },
    orderBy: { updatedAt: 'desc' },
    take: LOOKBACK,
    select: {
      watchedSeconds: true,
      video: {
        select: {
          id: true,
          youtubeId: true,
          title: true,
          thumbnailUrl: true,
          durationSeconds: true,
          status: true,
          embeddable: true,
          blockedRegions: true,
          // The user's playlists that hold it, the most recently imported first.
          playlists: {
            where: { playlist: { ownerId: userId, mergedIntoId: null } },
            orderBy: { playlist: { createdAt: 'desc' } },
            take: 1,
            select: { position: true, playlist: { select: { id: true, title: true } } },
          },
          libraryEntries: { where: { userId }, select: { videoId: true } },
        },
      },
    },
  })

  for (const { watchedSeconds, video } of rows) {
    if (availabilityOf(video) !== 'AVAILABLE') continue
    const item = {
      youtubeId: video.youtubeId,
      title: video.title,
      thumbnailUrl: video.thumbnailUrl,
      durationSeconds: video.durationSeconds,
      watchedSeconds,
    }
    const entry = video.playlists[0]
    if (entry) {
      // Its place among the playlist's videos, counted the way the playlist page orders them.
      const [before, total] = await Promise.all([
        prisma.playlistVideo.count({ where: { playlistId: entry.playlist.id, position: { lt: entry.position } } }),
        prisma.playlistVideo.count({ where: { playlistId: entry.playlist.id } }),
      ])
      return { ...item, playlist: { id: entry.playlist.id, title: entry.playlist.title, position: before + 1, total } }
    }
    if (video.libraryEntries.length > 0) return { ...item, playlist: null }
  }
  return null
}
