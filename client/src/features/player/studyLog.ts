import { apiFetch } from '@/lib/api'

/** The player reports what it played every this many seconds (YC-79). */
export const STUDY_REPORT_SECONDS = 15
/** The most the server takes in one report. */
const MAX_REPORT_SECONDS = 120

/** The user's calendar day, « 2026-10-03 »: a session at 00:30 counts for the day it is there. */
export function localDay(now: Date = new Date()): string {
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${mm}-${dd}`
}

/**
 * Seconds of real playback, added to the user's day (YC-79). Fire-and-forget, and `keepalive` so the
 * last report leaves even with the page that is being closed.
 */
export function reportStudySeconds(seconds: number): void {
  const whole = Math.min(Math.round(seconds), MAX_REPORT_SECONDS)
  if (whole < 1) return
  apiFetch('/study', { method: 'POST', keepalive: true, body: JSON.stringify({ day: localDay(), seconds: whole }) }).catch(() => {
    /* fire-and-forget */
  })
}
