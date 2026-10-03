import { useEffect, useState } from 'react'

const query = (px: number) => `(min-width: ${px}px)`

/**
 * True while the window is at least `px` wide. For a control that must MOVE between two places of the
 * layout (one element, not two copies hidden by CSS). Tolerates a missing matchMedia: then false.
 */
export function useMinWidth(px: number) {
  const [wide, setWide] = useState(() => window.matchMedia?.(query(px))?.matches ?? false)
  useEffect(() => {
    const media = window.matchMedia?.(query(px))
    if (!media) return
    const update = () => setWide(media.matches)
    update()
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [px])
  return wide
}
