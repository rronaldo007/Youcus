import { prisma } from '@/lib/prisma'
import { accessibleBy } from '@/lib/videoAccess'
import { HttpError } from '@/middleware/errorHandler'

export interface SetProgressInput {
  videoId: string
  /** Optionnel depuis CS-70 : la progression est globale, gardé pour compatibilité client. */
  playlistId?: string
  completed?: boolean
  watchedSeconds?: number
}

export interface ProgressResult {
  videoId: string
  completed: boolean
  watchedSeconds: number
}

/**
 * Crée/met à jour la progression d'une vidéo pour l'utilisateur (upsert sur userId+videoId).
 * La progression est GLOBALE (CS-70) : vue dans une playlist = vue partout.
 * Scoping: the video must be in one of the user's playlists or in their library (YC-61); with a
 * `playlistId`, in that playlist of the user.
 */
export async function setProgress(userId: string, input: SetProgressInput): Promise<ProgressResult> {
  const video = await prisma.video.findFirst({
    where: {
      id: input.videoId,
      ...(input.playlistId
        ? { playlists: { some: { playlistId: input.playlistId, playlist: { ownerId: userId } } } }
        : accessibleBy(userId)),
    },
    select: { id: true },
  })
  if (!video) throw new HttpError(404, 'Vidéo introuvable')

  // The day it became seen (YC-79), kept while it stays seen, gone when it is unmarked.
  const before =
    input.completed === true
      ? await prisma.progress.findUnique({ where: { userId_videoId: { userId, videoId: input.videoId } }, select: { completed: true } })
      : null
  const completedAt = input.completed === undefined || before?.completed ? {} : { completedAt: input.completed ? new Date() : null }

  const progress = await prisma.progress.upsert({
    where: { userId_videoId: { userId, videoId: input.videoId } },
    create: {
      userId,
      videoId: input.videoId,
      completed: input.completed ?? false,
      watchedSeconds: input.watchedSeconds ?? 0,
      ...completedAt,
    },
    update: {
      ...(input.completed !== undefined ? { completed: input.completed } : {}),
      ...(input.watchedSeconds !== undefined ? { watchedSeconds: input.watchedSeconds } : {}),
      ...completedAt,
    },
  })

  return {
    videoId: progress.videoId,
    completed: progress.completed,
    watchedSeconds: progress.watchedSeconds,
  }
}
