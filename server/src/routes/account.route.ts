import { Router, type NextFunction, type Request, type Response } from 'express'
import { clearSession } from '@/lib/session'
import { requireAuth } from '@/middleware/requireAuth'
import { deleteAccount, exportUserData } from '@/services/account.service'
import { prisma } from '@/lib/prisma'
import { HttpError } from '@/middleware/errorHandler'
import { parseNotePreferences, readNotePreferences } from '@/lib/notePage'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'

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

// Réglages › Notes (YC-48): the starting settings of every new note, the defaults if none.
accountRouter.get(
  '/account/note-preferences',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { notePreferences: true } })
    return res.json(readNotePreferences(user?.notePreferences))
  }),
)

accountRouter.put(
  '/account/note-preferences',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = parseNotePreferences(req.body)
    if (!parsed.ok) throw new HttpError(400, parsed.message)
    await prisma.user.update({
      where: { id: req.userId },
      data: { notePreferences: parsed.preferences as unknown as Prisma.InputJsonValue },
    })
    return res.json(parsed.preferences)
  }),
)

// Réglages › Étude (YC-79): the minutes of study aimed at each week, null for none.
const studyGoalSchema = z.object({ minutes: z.number().int().min(15).max(6000).nullable() })

accountRouter.get(
  '/account/study-goal',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { weeklyGoalMinutes: true } })
    return res.json({ minutes: user?.weeklyGoalMinutes ?? null })
  }),
)

accountRouter.put(
  '/account/study-goal',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = studyGoalSchema.safeParse(req.body)
    if (!parsed.success) throw new HttpError(400, 'Un objectif va de 15 à 6000 minutes par semaine.')
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { weeklyGoalMinutes: parsed.data.minutes },
      select: { weeklyGoalMinutes: true },
    })
    return res.json({ minutes: user.weeklyGoalMinutes })
  }),
)
