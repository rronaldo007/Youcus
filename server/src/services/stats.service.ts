import { prisma } from '@/lib/prisma'
import { availabilityOf } from '@/lib/availability'
import { HttpError } from '@/middleware/errorHandler'

/**
 * The day the study log started in production (YC-79, PR #128): nothing was counted before it, so a
 * day before it is « not counted », never « nothing studied ».
 */
export const STUDY_LOG_SINCE = '2026-10-03'

export type StatsRange = 'week' | 'month'

export interface StatsQuery {
  range: StatsRange
  /** The user's calendar day, « 2026-10-03 ». */
  today: string
  /** `Date.getTimezoneOffset()` of the user: minutes from their time to UTC (Paris in summer: -120). */
  offsetMinutes: number
}

export interface StatsDay {
  day: string
  /** Null when it was not counted: before the log existed, or still to come. */
  seconds: number | null
}

export interface PlaylistStats {
  id: string
  title: string
  /** Playable videos only, as the dashboard counts them (YC-13). */
  seen: number
  total: number
  /** « Avancée » (decision of Ronaldo, 03/10): the length of the videos seen plus the position in the others. */
  advancedSeconds: number
  totalSeconds: number
}

const DAY_MS = 86_400_000
const dateOf = (iso: string) => new Date(`${iso}T00:00:00.000Z`)
const isoOf = (date: Date) => date.toISOString().slice(0, 10)
const addDays = (iso: string, n: number) => isoOf(new Date(dateOf(iso).getTime() + n * DAY_MS))

/** The week (Monday to Sunday) or the calendar month that holds `today`. */
export function rangeOf(range: StatsRange, today: string): { from: string; to: string } {
  const t = dateOf(today)
  if (range === 'week') {
    const from = addDays(today, -((t.getUTCDay() + 6) % 7))
    return { from, to: addDays(from, 6) }
  }
  return {
    from: isoOf(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1))),
    to: isoOf(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0))),
  }
}

/** Days studied in a row up to today; today not studied yet does not break it, it starts yesterday. */
export function streakOf(studiedDays: string[], today: string): number {
  const studied = new Set(studiedDays)
  let cursor = studied.has(today) ? today : addDays(today, -1)
  let streak = 0
  while (studied.has(cursor)) {
    streak += 1
    cursor = addDays(cursor, -1)
  }
  return streak
}

/** Statistiques (YC-79): what the study log and the progress really hold, nothing more. */
export async function getStats(userId: string, query: StatsQuery, now: Date = new Date()) {
  const { range, today, offsetMinutes } = query
  const t = dateOf(today)
  const serverToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  if (Number.isNaN(t.getTime()) || isoOf(t) !== today || Math.abs(t.getTime() - serverToday) > DAY_MS) {
    throw new HttpError(400, 'Jour invalide')
  }
  const { from, to } = rangeOf(range, today)

  const [rows, studied, user, playlists] = await Promise.all([
    prisma.studyDay.findMany({ where: { userId, day: { gte: dateOf(from), lte: dateOf(to) } }, select: { day: true, seconds: true } }),
    prisma.studyDay.findMany({
      where: { userId, day: { lte: t }, seconds: { gt: 0 } },
      orderBy: { day: 'desc' },
      take: 400,
      select: { day: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { weeklyGoalMinutes: true } }),
    prisma.playlist.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        videos: {
          select: {
            video: {
              select: {
                status: true,
                embeddable: true,
                blockedRegions: true,
                durationSeconds: true,
                progress: { where: { userId }, select: { completed: true, watchedSeconds: true } },
              },
            },
          },
        },
      },
    }),
  ])

  const byDay = new Map(rows.map((r) => [isoOf(r.day), r.seconds]))
  const days: StatsDay[] = []
  for (let day = from; day <= to; day = addDays(day, 1)) {
    days.push({ day, seconds: day < STUDY_LOG_SINCE || day > today ? null : (byDay.get(day) ?? 0) })
  }

  // The user's midnight, in UTC: the videos marked seen on their own days of the range.
  const midnight = (iso: string) => new Date(dateOf(iso).getTime() + offsetMinutes * 60_000)
  const completedCount = await prisma.progress.count({
    where: { userId, completedAt: { gte: midnight(from), lt: midnight(addDays(to, 1)) } },
  })

  return {
    range,
    from,
    to,
    today,
    since: STUDY_LOG_SINCE,
    days,
    totalSeconds: days.reduce((sum, d) => sum + (d.seconds ?? 0), 0),
    streakDays: streakOf(studied.map((s) => isoOf(s.day)), today),
    completedCount,
    goalMinutes: user?.weeklyGoalMinutes ?? null,
    playlists: playlists.map((p): PlaylistStats => {
      const playable = p.videos.map((pv) => pv.video).filter((v) => availabilityOf(v) === 'AVAILABLE')
      const seen = playable.filter((v) => v.progress[0]?.completed).length
      return {
        id: p.id,
        title: p.title,
        seen,
        total: playable.length,
        advancedSeconds: playable.reduce((sum, v) => {
          const progress = v.progress[0]
          if (progress?.completed) return sum + v.durationSeconds
          return sum + Math.min(progress?.watchedSeconds ?? 0, v.durationSeconds)
        }, 0),
        totalSeconds: playable.reduce((sum, v) => sum + v.durationSeconds, 0),
      }
    }),
  }
}
