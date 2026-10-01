import type { ReactNode } from 'react'
import { matches } from '@/features/search/search'

/** The text, the term marked in yellow (Figma « Résultat de recherche » 108:370: Avant / Terme / Après). */
export function Highlight({ text, query }: { text: string; query: string }) {
  const parts: ReactNode[] = []
  let last = 0
  for (const [start, end] of matches(text, query)) {
    if (start > last) parts.push(text.slice(last, start))
    parts.push(
      <mark key={start} className="rounded-[3px] bg-[#f6de84] px-0.5 text-[#17150f] dark:bg-[#5a4a14] dark:text-content">
        {text.slice(start, end)}
      </mark>,
    )
    last = end
  }
  if (last < text.length) parts.push(text.slice(last))
  return <>{parts}</>
}
