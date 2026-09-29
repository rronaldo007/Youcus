import { Fragment } from 'react'

// Only absolute http(s) URLs become links. Trailing punctuation stays text.
const URL_PATTERN = /https?:\/\/[^\s<>"'()]+[^\s<>"'().,;:!?]/g

/**
 * Plain text with its web addresses turned into links (YC-5). The description is plain text,
 * not Markdown: rendering it as Markdown would turn its # and * into formatting. Safety comes
 * from construction: React escapes every text part, and an href is only ever an http(s) URL
 * matched above, so a javascript: or data: address can never become a link.
 */
export function LinkifiedText({ text }: { text: string }) {
  const parts: (string | { url: string })[] = []
  let last = 0
  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0
    if (start > last) parts.push(text.slice(last, start))
    parts.push({ url: match[0] })
    last = start + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))

  return (
    <>
      {parts.map((part, i) =>
        typeof part === 'string' ? (
          <Fragment key={i}>{part}</Fragment>
        ) : (
          <a
            key={i}
            href={part.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="break-all text-brand-purple hover:underline"
          >
            {part.url}
          </a>
        ),
      )}
    </>
  )
}
