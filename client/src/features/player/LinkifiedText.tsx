import { Fragment } from 'react'

// Only absolute http(s) URLs become links. Trailing punctuation stays text.
const URL_PATTERN = String.raw`https?:\/\/[^\s<>"'()]+[^\s<>"'().,;:!?]`
// A timestamp alone, not a piece of a longer number or time: 4:05, 12:34, 1:02:03, 00:01:38.
const TIME_PATTERN = String.raw`(?<![\d:])(?:\d{1,2}:)?\d{1,2}:[0-5]\d(?![\d:])`
// URLs first, so a time inside an address is never taken for a timestamp.
const TOKEN = new RegExp(`(${URL_PATTERN})|(${TIME_PATTERN})`, 'g')

function toSeconds(stamp: string): number {
  return stamp.split(':').reduce((total, part) => total * 60 + Number(part), 0)
}

type Part = string | { url: string } | { stamp: string; seconds: number }

/**
 * Plain text with its web addresses turned into links (YC-5) and, when `onSeek` is given, its
 * timestamps turned into buttons that move the player (YC-6). The description is plain text,
 * not Markdown. Safety comes from construction: React escapes every text part, and an href is
 * only ever an http(s) URL matched above, never a javascript: or data: address.
 * A timestamp past the end of the video (`maxSeconds`) stays plain text.
 */
export function LinkifiedText({
  text,
  onSeek,
  maxSeconds,
}: {
  text: string
  onSeek?: (seconds: number) => void
  maxSeconds?: number
}) {
  const parts: Part[] = []
  let last = 0
  for (const match of text.matchAll(TOKEN)) {
    const start = match.index ?? 0
    const [token, url] = match
    const seconds = url ? 0 : toSeconds(token)
    const seekable = !url && onSeek && (!maxSeconds || seconds < maxSeconds)
    if (!url && !seekable) continue
    if (start > last) parts.push(text.slice(last, start))
    parts.push(url ? { url } : { stamp: token, seconds })
    last = start + token.length
  }
  if (last < text.length) parts.push(text.slice(last))

  return (
    <>
      {parts.map((part, i) => {
        if (typeof part === 'string') return <Fragment key={i}>{part}</Fragment>
        if ('url' in part) {
          return (
            <a
              key={i}
              href={part.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="break-all text-brand-purple hover:underline"
            >
              {part.url}
            </a>
          )
        }
        return (
          <button
            key={i}
            type="button"
            onClick={() => onSeek?.(part.seconds)}
            aria-label={`Aller à ${part.stamp}`}
            className="font-medium text-brand-purple hover:underline"
          >
            {part.stamp}
          </button>
        )
      })}
    </>
  )
}
