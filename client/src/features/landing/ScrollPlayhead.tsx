import { useEffect, useState } from 'react'

/**
 * The reading of a public page drawn as the playhead of a video (YC-91): a line in the signal at the top
 * of the screen, as long as the part already read. It follows the scroll, it never moves on its own.
 */
export function ScrollPlayhead() {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    let frame = 0
    const measure = () => {
      frame = 0
      const max = document.documentElement.scrollHeight - window.innerHeight
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [])
  return (
    <div
      aria-hidden="true"
      data-scroll-playhead=""
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[3px] origin-left bg-accent"
      style={{ transform: `scaleX(${progress})` }}
    />
  )
}
