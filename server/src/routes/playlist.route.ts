import { Router, type NextFunction, type Request, type Response } from 'express'
import { z } from 'zod'
import { isYouTubeConfigured } from '@/config/env'
import { HttpError } from '@/middleware/errorHandler'
import { requireAuth } from '@/middleware/requireAuth'
import { importPlaylist } from '@/services/playlist.service'

export const playlistRouter = Router()

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next)
  }
}

const importSchema = z.object({
  url: z.string().min(1, 'URL ou identifiant de playlist requis'),
})

// Importe une playlist YouTube pour l'utilisateur connecté.
playlistRouter.post(
  '/playlists/import',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!isYouTubeConfigured()) {
      throw new HttpError(503, 'Import YouTube non configuré sur le serveur')
    }
    const parsed = importSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Requête invalide')
    }
    const playlist = await importPlaylist(req.userId as string, parsed.data.url)
    res.status(201).json(playlist)
  }),
)
