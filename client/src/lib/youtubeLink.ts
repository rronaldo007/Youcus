const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/

/**
 * The id of a video from a YouTube link (watch, youtu.be, shorts, embed, live) or a bare
 * 11-character id; null otherwise. Same rule as the server (server/src/lib/youtube.ts).
 */
export function videoIdOf(input: string): string | null {
  const trimmed = input.trim()
  if (VIDEO_ID.test(trimmed)) return trimmed
  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
  } catch {
    return null
  }
  const valid = (id: string | null | undefined) => (id && VIDEO_ID.test(id) ? id : null)
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, '')
  if (host === 'youtu.be') return valid(url.pathname.split('/')[1])
  if (host !== 'youtube.com' && host !== 'youtube-nocookie.com') return null
  return valid(url.searchParams.get('v')) ?? valid(url.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/]+)/)?.[1])
}

/**
 * What the import field received (YC-61): a link with `list=` is a playlist, even when it also
 * points at a video (the way YouTube shares a video inside a playlist); a video otherwise.
 */
export function isVideoLink(input: string): boolean {
  return !/[?&]list=/.test(input) && videoIdOf(input) !== null
}

/**
 * What the import window accepts (YC-81): a playlist link (`list=`) or a bare playlist id, or a video
 * link (YC-61); null for anything else, refused before asking the server.
 */
export function linkKind(input: string): 'playlist' | 'video' | null {
  const value = input.trim()
  if (/[?&]list=[A-Za-z0-9_-]+/.test(value) || /^(PL|UU|LL|FL|OL)[A-Za-z0-9_-]{10,}$/.test(value)) return 'playlist'
  if (isVideoLink(value)) return 'video'
  return null
}
