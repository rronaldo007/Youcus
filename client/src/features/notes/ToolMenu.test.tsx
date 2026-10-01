import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToolMenu } from './ToolMenu'

/** A menu whose button sits at `left` on a screen `width` wide; the menu is 280 px. */
function openAt(left: number, width = 390) {
  vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(width)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const l = left + (parseFloat(this.style.left) || 0)
    return { left: l, right: l + 280, top: 0, bottom: 300, width: 280, height: 300, x: l, y: 0, toJSON: () => ({}) } as DOMRect
  })
  render(
    <ToolMenu buttonLabel="Menu" buttonClassName="b" buttonContent="M" menuLabel="Menu ouvert">
      {() => <button role="menuitem">Un</button>}
    </ToolMenu>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
  return screen.getByRole('menu', { name: 'Menu ouvert' })
}

describe('ToolMenu near the edge of the screen (YC-46)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('stays under its button when it fits', () => {
    expect(openAt(40).style.left).toBe('')
  })

  it('moves left to end 8 px before the right edge', () => {
    // 300 + 280 = 580, the limit is 390 - 8 = 382: 198 px to the left.
    expect(openAt(300).style.left).toBe('-198px')
  })

  it('never goes past the left edge', () => {
    // On a 200 px screen it can only move until its left side is 8 px from the edge.
    expect(openAt(100, 200).style.left).toBe('-92px')
  })
})
