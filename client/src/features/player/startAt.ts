/** 100 hours: the longest YouTube videos (server MAX_MARKER_SECONDS). */
const MAX_SECONDS = 360_000

/**
 * The moment asked by the address, `?t=245` (YC-22: a line of a note found by the search opens its
 * video at its marker); null when there is none, or it is not a second of a video.
 */
export function startAt(params: URLSearchParams): number | null {
  const raw = params.get('t')
  if (raw === null || !/^\d+$/.test(raw)) return null
  const seconds = Number(raw)
  return seconds <= MAX_SECONDS ? seconds : null
}
