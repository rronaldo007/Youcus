import { Router, type NextFunction, type Request, type Response } from 'express'
import { HttpError } from '@/middleware/errorHandler'
import { requireAuth } from '@/middleware/requireAuth'
import { getVideoNote, saveVideoNote } from '@/services/note.service'

export const noteRouter = Router()

/** Limite de taille d'une note (colonne TEXT MySQL ~64 Ko). */
const MAX_NOTE_LENGTH = 50_000

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
    const { content } = req.body as { content?: unknown }
    if (typeof content !== 'string') {
      throw new HttpError(400, 'Le contenu de la note est requis')
    }
    if (content.length > MAX_NOTE_LENGTH) {
      throw new HttpError(413, 'Note trop longue')
    }
    const note = await saveVideoNote(req.userId as string, req.params.videoId, content)
    return res.json(note)
  }),
)
