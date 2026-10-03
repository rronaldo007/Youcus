import { afterEach, describe, expect, it, vi } from 'vitest'
import { shiftTheme } from './themeShift'

/** The document seen as a slot the test fills or empties. */
type Doc = { startViewTransition?: unknown }

/** A browser with view transitions: runs the update at once and lets the test end the transition. */
function withViewTransitions() {
  let finish = () => {}
  const start = vi.fn((update: () => void) => {
    update()
    return { finished: new Promise<void>((resolve) => (finish = resolve)) }
  })
  ;(document as unknown as Doc).startViewTransition = start
  return { start, finish: () => finish() }
}

const reduceMotion = (reduce: boolean) =>
  vi.spyOn(window, 'matchMedia').mockImplementation((q: string) => ({ matches: reduce && q.includes('reduce'), media: q }) as MediaQueryList)

describe('shiftTheme (YC-92)', () => {
  afterEach(() => {
    delete (document as unknown as Doc).startViewTransition
    delete document.documentElement.dataset.themeShift
    vi.restoreAllMocks()
  })

  it('opens the day from the control, then forgets the shift once it is over', async () => {
    reduceMotion(false)
    const vt = withViewTransitions()
    const update = vi.fn()
    shiftTheme('light', { x: 100, y: 40 }, update)
    const root = document.documentElement
    expect(vt.start).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledTimes(1)
    expect(root.dataset.themeShift).toBe('day')
    expect(root.style.getPropertyValue('--yc-sun-x')).toBe('100px')
    expect(root.style.getPropertyValue('--yc-sun-y')).toBe('40px')
    // The light reaches the farthest corner (jsdom: 1024 × 768), soft edge included.
    const reach = Math.hypot(1024 - 100, 768 - 40)
    expect(parseFloat(root.style.getPropertyValue('--yc-dawn-to'))).toBeGreaterThanOrEqual(reach + 160)

    vt.finish()
    await Promise.resolve()
    await Promise.resolve()
    expect(root.dataset.themeShift).toBeUndefined()
  })

  it('lets the night fall when going dark', () => {
    reduceMotion(false)
    withViewTransitions()
    shiftTheme('dark', undefined, vi.fn())
    expect(document.documentElement.dataset.themeShift).toBe('night')
  })

  it('changes at once under reduced motion, or without view transitions', () => {
    reduceMotion(true)
    const vt = withViewTransitions()
    const update = vi.fn()
    shiftTheme('dark', undefined, update)
    expect(update).toHaveBeenCalledTimes(1)
    expect(vt.start).not.toHaveBeenCalled()
    expect(document.documentElement.dataset.themeShift).toBeUndefined()

    reduceMotion(false)
    delete (document as unknown as Doc).startViewTransition
    shiftTheme('light', undefined, update)
    expect(update).toHaveBeenCalledTimes(2)
    expect(document.documentElement.dataset.themeShift).toBeUndefined()
  })
})
