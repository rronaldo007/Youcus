/**
 * Chapters parsed from a video description (YC-3). The YouTube Data API exposes no structured
 * chapters: the description is the only source, read with the rules YouTube applies before it
 * shows chapters on its own player.
 */

export interface ParsedChapter {
  position: number
  startSeconds: number
  title: string
}

/** YouTube shows chapters only when there are at least three. */
export const MIN_CHAPTERS = 3
/** YouTube ignores chapters shorter than ten seconds. */
export const MIN_CHAPTER_SECONDS = 10
/** Chapter.title is a VARCHAR(191). */
const MAX_TITLE_LENGTH = 191

// "0:00", "12:34", "1:02:03", "00:00:00": optional hours, minutes, seconds.
const TIME = String.raw`(?:(\d{1,2}):)?(\d{1,2}):([0-5]\d)`
// Timestamp at the start of the line, after an optional bullet or bracket, then the title.
const LEADING = new RegExp(String.raw`^[\s•*\-–—>\[(]*${TIME}[\])]?\s*(?:[-–—|:.)]\s*)?(.+)$`)
// Title first, timestamp at the end of the line ("Intro - 0:00").
const TRAILING = new RegExp(String.raw`^(.+?)\s*[-–—|:(\[]?\s*${TIME}[\])]?\s*$`)

function toSeconds(h: string | undefined, m: string, s: string): number {
  return Number(h ?? 0) * 3600 + Number(m) * 60 + Number(s)
}

function cleanTitle(raw: string): string {
  return raw
    .replace(/^[\s\-–—|:.]+/, '')
    .replace(/[\s\-–—|:]+$/, '')
    .trim()
    .slice(0, MAX_TITLE_LENGTH)
}

function parseLine(line: string): { startSeconds: number; title: string } | null {
  const lead = line.match(LEADING)
  if (lead) {
    const title = cleanTitle(lead[4])
    if (title) return { startSeconds: toSeconds(lead[1], lead[2], lead[3]), title }
  }
  const trail = line.match(TRAILING)
  if (trail) {
    const title = cleanTitle(trail[1])
    if (title) return { startSeconds: toSeconds(trail[2], trail[3], trail[4]), title }
  }
  return null
}

/**
 * Returns the chapters of a description, or [] when YouTube would not show any: the list must
 * start at 0:00, have at least three chapters, go strictly forward, and give each chapter at
 * least ten seconds. The first run of timestamped lines that starts at 0:00 is the one kept.
 * A chapter starting at or after the video end (when the duration is known) is dropped.
 */
export function parseChapters(description: string | null | undefined, durationSeconds = 0): ParsedChapter[] {
  if (!description) return []
  const lines = description.split(/\r?\n/)

  let found: { startSeconds: number; title: string }[] = []
  for (const line of lines) {
    const parsed = parseLine(line.trim())
    if (!parsed) {
      // A blank or plain line after a complete list ends it.
      if (found.length >= MIN_CHAPTERS) break
      continue
    }
    if (parsed.startSeconds === 0) {
      if (found.length >= MIN_CHAPTERS) break
      found = [parsed]
    } else if (found.length > 0) {
      found.push(parsed)
    }
  }

  if (durationSeconds > 0) found = found.filter((c) => c.startSeconds < durationSeconds)
  if (found.length < MIN_CHAPTERS || found[0].startSeconds !== 0) return []

  for (let i = 1; i < found.length; i++) {
    if (found[i].startSeconds - found[i - 1].startSeconds < MIN_CHAPTER_SECONDS) return []
  }
  if (durationSeconds > 0 && durationSeconds - found[found.length - 1].startSeconds < MIN_CHAPTER_SECONDS) {
    return []
  }

  return found.map((c, position) => ({ position, ...c }))
}
