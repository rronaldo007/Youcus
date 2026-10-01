import { Router, type NextFunction, type Request, type Response } from 'express'
import { z } from 'zod'
import { isYouTubeConfigured } from '@/config/env'
import { HttpError } from '@/middleware/errorHandler'
import { requireAuth } from '@/middleware/requireAuth'
import {
  addLibraryVideo,
  getLibraryVideo,
  listLibraryVideos,
  removeLibraryVideo,
} from '@/services/library.service'

export const libraryRouter = Router()

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next)
  }
}

const addSchema = z.object({
  url: z.string().min(1, 'Lien de vidéo requis').max(500),
})

// Videos kept on their own, outside any playlist (YC-61).
libraryRouter.get(
  '/library/videos',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await listLibraryVideos(req.userId as string))
  }),
)

libraryRouter.post(
  '/library/videos',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!isYouTubeConfigured()) {
      throw new HttpError(503, 'Import YouTube non configuré sur le serveur')
    }
    const parsed = addSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Requête invalide')
    }
    res.status(201).json(await addLibraryVideo(req.userId as string, parsed.data.url))
  }),
)

// By YouTube id: the player's address is /videos/:youtubeId.
libraryRouter.get(
  '/library/videos/:youtubeId',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await getLibraryVideo(req.userId as string, req.params.youtubeId))
  }),
)

libraryRouter.delete(
  '/library/videos/:videoId',
  requireAuth,
  asyncHandler(async (req, res) => {
    await removeLibraryVideo(req.userId as string, req.params.videoId)
    res.json({ ok: true })
  }),
)
