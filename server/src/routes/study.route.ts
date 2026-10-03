import { Router, type NextFunction, type Request, type Response } from 'express'
import { z } from 'zod'
import { HttpError } from '@/middleware/errorHandler'
import { requireAuth } from '@/middleware/requireAuth'
import { MAX_REPORT_SECONDS, addStudySeconds } from '@/services/study.service'

export const studyRouter = Router()

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next)
  }
}

const reportSchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Jour invalide'),
  seconds: z.number().int().min(1).max(MAX_REPORT_SECONDS),
})

// Seconds of real playback, sent by the player while it plays (YC-79).
studyRouter.post(
  '/study',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = reportSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Requête invalide')
    }
    res.json(await addStudySeconds(req.userId as string, parsed.data))
  }),
)
