import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CountUp, RecClock } from './CountUp'

const reduceMotion = (reduce: boolean) =>
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) => ({ matches: reduce && query.includes('reduce'), media: query }) as MediaQueryList,
  )

describe('CountUp and RecClock (YC-91)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('counts up to the figure once running, and says only the final figure', () => {
    reduceMotion(false)
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
    const { container, rerender } = render(<CountUp to={100} suffix=" %" run={false} />)
    const shown = () => container.querySelector('[aria-hidden="true"]')?.textContent
    expect(shown()).toBe('0 %')
    expect(container.querySelector('.sr-only')?.textContent).toBe('100 %')

    rerender(<CountUp to={100} suffix=" %" run />)
    act(() => vi.advanceTimersByTime(700))
    expect(Number(shown()?.replace(' %', ''))).toBeGreaterThan(0)
    expect(Number(shown()?.replace(' %', ''))).toBeLessThan(100)
    act(() => vi.advanceTimersByTime(1000))
    expect(shown()).toBe('100 %')
  })

  it('shows the figure at once under reduced motion', () => {
    reduceMotion(true)
    const { container } = render(<CountUp to={900} suffix="+" run={false} />)
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe('900+')
  })

  it('runs the clock of the hero, and keeps it still under reduced motion', () => {
    vi.useFakeTimers()
    reduceMotion(false)
    const running = render(<RecClock />)
    act(() => vi.advanceTimersByTime(65_000))
    expect(running.container.textContent).toBe('00:01:05')
    running.unmount()

    reduceMotion(true)
    const still = render(<RecClock />)
    act(() => vi.advanceTimersByTime(5_000))
    expect(still.container.textContent).toBe('00:00:00')
  })
})
