import { Router, type NextFunction, type Request, type Response } from 'express'
import { z } from 'zod'
import { HttpError } from '@/middleware/errorHandler'
import { requireAuth } from '@/middleware/requireAuth'
import { getStats } from '@/services/stats.service'
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

const statsSchema = z.object({
  range: z.enum(['week', 'month']),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Jour invalide'),
  // Date.getTimezoneOffset(): from -14 h to +12 h.
  offset: z.coerce.number().int().min(-840).max(720),
})

// Statistiques (YC-79): the week or the month of the user, on their own calendar.
studyRouter.get(
  '/stats',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = statsSchema.safeParse(req.query)
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Requête invalide')
    }
    const { range, today, offset } = parsed.data
    res.json(await getStats(req.userId as string, { range, today, offsetMinutes: offset }))
  }),
)
