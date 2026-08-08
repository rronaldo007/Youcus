import { Router, type NextFunction, type Request, type Response } from 'express'
import { z } from 'zod'
import { HttpError } from '@/middleware/errorHandler'
import { requireAuth } from '@/middleware/requireAuth'
import { getPlaylistNote, getVideoNote, savePlaylistNote, saveVideoNote } from '@/services/note.service'

export const noteRouter = Router()

/** Limite de taille d'une note (colonne TEXT MySQL ~64 Ko). */
const MAX_NOTE_LENGTH = 50_000

/**
 * Corps attendu pour l'ecriture d'une note.
 * Zod plutot qu'un `typeof` a la main : le schema porte la contrainte de
 * longueur avec le type, et renvoie un message exploitable sans lever.
 */
const noteSchema = z.object({
  content: z
    .string({ message: 'Le contenu de la note est requis' })
    .max(MAX_NOTE_LENGTH, 'Note trop longue'),
})

/** Adapte un handler async pour propager les erreurs vers errorHandler. */
function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next)
  }
}

// Récupère la note Markdown de l'utilisateur pour une vidéo (null si absente).
noteRouter.get(
  '/videos/:videoId/note',
  requireAuth,
  asyncHandler(async (req, res) => {
    const note = await getVideoNote(req.userId as string, req.params.videoId)
    return res.json(note)
  }),
)

// Crée ou met à jour la note Markdown de l'utilisateur pour une vidéo.
noteRouter.put(
  '/videos/:videoId/note',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = noteSchema.safeParse(req.body)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Requête invalide'
      throw new HttpError(message === 'Note trop longue' ? 413 : 400, message)
    }
    const note = await saveVideoNote(req.userId as string, req.params.videoId, parsed.data.content)
    return res.json(note)
  }),
)

// Récupère la note Markdown de l'utilisateur pour une playlist (null si absente).
noteRouter.get(
  '/playlists/:playlistId/note',
  requireAuth,
  asyncHandler(async (req, res) => {
    const note = await getPlaylistNote(req.userId as string, req.params.playlistId)
    return res.json(note)
  }),
)

// Crée ou met à jour la note Markdown de l'utilisateur pour une playlist.
noteRouter.put(
  '/playlists/:playlistId/note',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = noteSchema.safeParse(req.body)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Requête invalide'
      throw new HttpError(message === 'Note trop longue' ? 413 : 400, message)
    }
    const note = await savePlaylistNote(req.userId as string, req.params.playlistId, parsed.data.content)
    return res.json(note)
  }),
)
