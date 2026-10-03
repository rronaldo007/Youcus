import { useEffect, useRef, useState, type CSSProperties } from 'react'

/** Where nothing can watch the scroll (tests, old browsers), the block is shown at once: never left hidden. */
const canWatch = () => typeof window !== 'undefined' && 'IntersectionObserver' in window

/**
 * A block of the public site enters when it scrolls into view (YC-91), once. Until then it is hidden,
 * and only when motion is welcome: under prefers-reduced-motion it is simply there.
 */
export function useReveal<T extends Element>() {
  const ref = useRef<T>(null)
  const [shown, setShown] = useState(() => !canWatch())
  useEffect(() => {
    const el = ref.current
    if (shown || !el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true)
          observer.disconnect()
        }
      },
      // A little inside the bottom edge, so the entrance is seen; small enough to reach the last block of a page.
      { rootMargin: '0px 0px -40px 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [shown])
  return { ref, shown }
}

/** The class of a block that enters with `useReveal`. */
export const revealClass = (shown: boolean) => (shown ? 'motion-safe:animate-yc-enter' : 'motion-safe:opacity-0')

/** One after the other: the delay of an entrance. */
export const after = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` })

/** False under prefers-reduced-motion. Tolerates a missing matchMedia (tests that restore their mocks). */
export function motionWelcome() {
  return !window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
}
