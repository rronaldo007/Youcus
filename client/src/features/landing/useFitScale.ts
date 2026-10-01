import { useLayoutEffect, useRef, useState } from 'react'

/**
 * The scale that fits a drawing of a fixed width into its box (never above 1): the hero scene is
 * drawn at 600 × 520 like Figma, and shown at 0.6 on a phone as the mobile frame does.
 */
export function useFitScale<T extends HTMLElement>(width: number) {
  const ref = useRef<T>(null)
  const [scale, setScale] = useState(1)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setScale(Math.min(1, el.clientWidth / width) || 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [width])
  return { ref, scale }
}
