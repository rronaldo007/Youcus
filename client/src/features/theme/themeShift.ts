import type { Theme } from './useTheme'

/** Where the change was asked for, in viewport pixels: the day rises from there. */
export interface ShiftOrigin {
  x: number
  y: number
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> }
}

/** The centre of the control that was clicked. */
export function originOf(el: Element): ShiftOrigin {
  const box = el.getBoundingClientRect()
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
}

/**
 * Changes the theme as the sky does (YC-92): to light, the day opens in a circle of soft light from the
 * control; to dark, the same gesture backwards, the light closing into the control. The browser takes a picture of the page before and
 * after, and only the passage between the two is drawn, so nothing is laid out while it moves.
 * Under reduced motion, or where the browser has no view transitions, the theme simply changes.
 */
export function shiftTheme(to: Theme, from: ShiftOrigin | undefined, update: () => void) {
  const doc = document as ViewTransitionDocument
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
  if (!doc.startViewTransition || reduced) {
    update()
    return
  }
  const root = document.documentElement
  const x = from?.x ?? window.innerWidth / 2
  const y = from?.y ?? 0
  // The light must reach the farthest corner, its soft edge included.
  const reach = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
  const feather = Math.max(160, reach * 0.35)
  root.style.setProperty('--yc-sun-x', `${Math.round(x)}px`)
  root.style.setProperty('--yc-sun-y', `${Math.round(y)}px`)
  root.style.setProperty('--yc-dawn-feather', `${Math.round(feather)}px`)
  root.style.setProperty('--yc-dawn-to', `${Math.ceil(reach + feather)}px`)
  root.dataset.themeShift = to === 'light' ? 'day' : 'night'
  // An entrance still running would be frozen half-way in the picture « before » and go on moving in the
  // page « after »: the two would not lie on each other. Bring them to their end first; loops go on.
  document.getAnimations?.().forEach((a) => {
    if (a.effect?.getComputedTiming().endTime !== Infinity) a.finish()
  })
  doc.startViewTransition(update).finished.finally(() => {
    delete root.dataset.themeShift
  })
}
