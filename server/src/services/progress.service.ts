import { prisma } from '@/lib/prisma'
import { HttpError } from '@/middleware/errorHandler'

export interface SetProgressInput {
  videoId: string
  playlistId: string
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
 * Vérifie que la vidéo appartient à une playlist de l'utilisateur (scoping).
 */
export async function setProgress(userId: string, input: SetProgressInput): Promise<ProgressResult> {
  const video = await prisma.video.findFirst({
    where: { id: input.videoId, playlistId: input.playlistId, playlist: { ownerId: userId } },
    select: { id: true },
  })
  if (!video) throw new HttpError(404, 'Vidéo introuvable')

  const progress = await prisma.progress.upsert({
    where: { userId_videoId: { userId, videoId: input.videoId } },
    create: {
      userId,
      videoId: input.videoId,
      playlistId: input.playlistId,
      completed: input.completed ?? false,
      watchedSeconds: input.watchedSeconds ?? 0,
    },
    update: {
      ...(input.completed !== undefined ? { completed: input.completed } : {}),
      ...(input.watchedSeconds !== undefined ? { watchedSeconds: input.watchedSeconds } : {}),
    },
  })

  return {
    videoId: progress.videoId,
    completed: progress.completed,
    watchedSeconds: progress.watchedSeconds,
  }
}
