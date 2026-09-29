import { Router, type NextFunction, type Request, type Response } from 'express'
import { requireAuth } from '@/middleware/requireAuth'
import { getVideo } from '@/services/video.service'

export const videoRouter = Router()

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next)
  }
}

// One video with its YouTube metadata and chapters (YC-4).
videoRouter.get(
  '/videos/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await getVideo(req.userId as string, req.params.id))
  }),
)
