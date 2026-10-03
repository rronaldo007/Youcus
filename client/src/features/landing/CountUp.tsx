import { useEffect, useState } from 'react'
import { motionWelcome } from './useReveal'

/**
 * A figure that counts up to its value once `run` turns true (YC-91): it says « accumulated », not « printed ».
 * Assistive technology reads the final figure only; under reduced motion the figure is simply there.
 */
export function CountUp({ to, suffix = '', run, ms = 1400 }: { to: number; suffix?: string; run: boolean; ms?: number }) {
  const [value, setValue] = useState(() => (motionWelcome() ? 0 : to))
  useEffect(() => {
    // Under reduced motion the first state is already the figure.
    if (!run || !motionWelcome()) return
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms)
      setValue(Math.round(to * (1 - (1 - t) ** 3)))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [run, to, ms])
  return (
    <>
      <span aria-hidden="true" className="tabular-nums">
        {value}
        {suffix}
      </span>
      <span className="sr-only">
        {to}
        {suffix}
      </span>
    </>
  )
}

/** « REC 00:00:00 » of the hero: a clock that really runs while the visitor reads, still under reduced motion. */
export function RecClock() {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    if (!motionWelcome()) return
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => window.clearInterval(id)
  }, [])
  const pad = (n: number) => String(n).padStart(2, '0')
  return <span className="tabular-nums">{`${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`}</span>
}
