import { prisma } from '@/lib/prisma'
import { HttpError } from '@/middleware/errorHandler'

export interface VideoNote {
  content: string
  updatedAt: Date
}

/** Vérifie que la vidéo appartient à une playlist de l'utilisateur (sinon 404). */
async function assertOwnsVideo(userId: string, videoId: string): Promise<void> {
  const video = await prisma.video.findFirst({
    where: { id: videoId, playlist: { ownerId: userId } },
    select: { id: true },
  })
  if (!video) throw new HttpError(404, 'Vidéo introuvable')
}

/** Récupère la note de l'utilisateur pour une vidéo, ou null si aucune. */
export async function getVideoNote(userId: string, videoId: string): Promise<VideoNote | null> {
  await assertOwnsVideo(userId, videoId)
  const note = await prisma.note.findUnique({
    where: { authorId_videoId: { authorId: userId, videoId } },
    select: { content: true, updatedAt: true },
  })
  return note
}

/**
 * Crée ou met à jour la note Markdown de l'utilisateur pour une vidéo.
 * Une seule note par (utilisateur, vidéo) — upsert sur la contrainte unique.
 */
export async function saveVideoNote(userId: string, videoId: string, content: string): Promise<VideoNote> {
  await assertOwnsVideo(userId, videoId)
  const note = await prisma.note.upsert({
    where: { authorId_videoId: { authorId: userId, videoId } },
    create: { authorId: userId, videoId, content },
    update: { content },
    select: { content: true, updatedAt: true },
  })
  return note
}
