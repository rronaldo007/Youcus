import { prisma } from '@/lib/prisma'
import { HttpError } from '@/middleware/errorHandler'

/** At most this much in one report: the player sends every 15 s, a late report stays small. */
export const MAX_REPORT_SECONDS = 120

const DAY_MS = 86_400_000

export interface StudyReport {
  /** The user's calendar day, « 2026-10-03 ». */
  day: string
  seconds: number
}

/**
 * Adds seconds of real playback to the user's day (YC-79). The day is the user's own (time zones
 * run from -12 h to +14 h): it must be the server's UTC day, the day before or the day after.
 */
export async function addStudySeconds(userId: string, report: StudyReport, now: Date = new Date()) {
  const day = new Date(`${report.day}T00:00:00.000Z`)
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  if (Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== report.day || Math.abs(day.getTime() - today) > DAY_MS) {
    throw new HttpError(400, 'Jour invalide')
  }
  const row = await prisma.studyDay.upsert({
    where: { userId_day: { userId, day } },
    create: { userId, day, seconds: report.seconds },
    update: { seconds: { increment: report.seconds } },
  })
  return { day: report.day, seconds: row.seconds }
}
