import { Router, type NextFunction, type Request, type Response } from 'express'
import { clearSession } from '@/lib/session'
import { requireAuth } from '@/middleware/requireAuth'
import { deleteAccount, exportUserData } from '@/services/account.service'

export const accountRouter = Router()

/** Adapte un handler async pour propager les erreurs vers errorHandler. */
function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next)
  }
}

// Export RGPD : renvoie toutes les données personnelles en JSON téléchargeable.
accountRouter.get(
  '/account/export',
  requireAuth,
  asyncHandler(async (req, res) => {
    const data = await exportUserData(req.userId as string)
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="youcus-donnees.json"')
    return res.status(200).send(JSON.stringify(data, null, 2))
  }),
)

// Suppression RGPD : efface le compte + données liées, puis invalide la session.
accountRouter.delete(
  '/account',
  requireAuth,
  asyncHandler(async (req, res) => {
    await deleteAccount(req.userId as string)
    clearSession(res)
    return res.json({ ok: true })
  }),
)
