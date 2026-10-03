import type { ReactNode } from 'react'
import { after, revealClass, useReveal } from './useReveal'

/** A block that enters when it scrolls into view (YC-91): for a heading or a lone paragraph. */
export function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const { ref, shown } = useReveal<HTMLDivElement>()
  return (
    <div ref={ref} style={after(delay)} className={`${className} ${revealClass(shown)}`}>
      {children}
    </div>
  )
}
