/**
 * "Content may be dated" (YC-15): a technical course published years ago may teach tools that
 * have changed. Only for the YouTube categories where that is true; never blocking.
 */
export const DATED_AFTER_YEARS = 3

/** YouTube category ids: 27 Education, 28 Science & Technology. */
const DATED_CATEGORIES = new Set(['27', '28'])

/** Whole years between two dates, counted the calendar way (an anniversary is a full year). */
function fullYearsBetween(from: Date, to: Date): number {
  let years = to.getFullYear() - from.getFullYear()
  const anniversaryPassed =
    to.getMonth() > from.getMonth() || (to.getMonth() === from.getMonth() && to.getDate() >= from.getDate())
  if (!anniversaryPassed) years -= 1
  return years
}

/** Age in years when the video should carry the alert, null otherwise. */
export function datedContentYears(
  publishedAt: string | null,
  categoryId: string | null,
  now: Date = new Date(),
): number | null {
  if (!publishedAt || !categoryId || !DATED_CATEGORIES.has(categoryId)) return null
  const published = new Date(publishedAt)
  if (Number.isNaN(published.getTime())) return null
  const years = fullYearsBetween(published, now)
  return years >= DATED_AFTER_YEARS ? years : null
}
