import { Router, type NextFunction, type Request, type Response } from 'express'
import { z } from 'zod'
import { HttpError } from '@/middleware/errorHandler'
import { requireAuth } from '@/middleware/requireAuth'
import { MAX_QUERY, MIN_QUERY, search } from '@/services/search.service'

export const searchRouter = Router()

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next)
  }
}

const querySchema = z.object({
  q: z
    .string()
    .trim()
    .min(MIN_QUERY, `Au moins ${MIN_QUERY} caractères`)
    .max(MAX_QUERY, `${MAX_QUERY} caractères au plus`),
})

// The search page (YC-22): the user's playlists, videos and notes, never YouTube.
searchRouter.get(
  '/search',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = querySchema.safeParse(req.query)
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Requête invalide')
    }
    res.json(await search(req.userId as string, parsed.data.q))
  }),
)
