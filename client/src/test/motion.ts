import { expect } from 'vitest'

/**
 * Every animation of a page waits for motion-safe (prefers-reduced-motion), and so does every
 * block hidden before its entrance: under reduced motion, nothing moves and nothing stays hidden.
 */
export function expectMotionOnlyWhenWelcome(container: HTMLElement) {
  const classes = [...container.querySelectorAll('*')].flatMap((el) => [...el.classList])
  const moving = classes.filter((c) => c.includes('animate-') && c !== 'motion-reduce:animate-none')
  expect(moving.length).toBeGreaterThan(0)
  expect(moving.filter((c) => !c.startsWith('motion-safe:'))).toEqual([])
  expect(classes.filter((c) => c.endsWith('opacity-0') && !c.startsWith('motion-safe:') && !c.includes('hover:'))).toEqual([])
}
