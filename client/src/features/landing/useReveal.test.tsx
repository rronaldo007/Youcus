import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { revealClass, useReveal } from './useReveal'

function Block() {
  const { ref, shown } = useReveal<HTMLDivElement>()
  return (
    <div ref={ref} data-testid="block" className={revealClass(shown)}>
      Bloc
    </div>
  )
}

type Callback = (entries: Array<{ isIntersecting: boolean }>) => void

/** A watcher of the scroll that the test moves by hand. */
function fakeObserver() {
  const watchers: Array<{ callback: Callback; disconnect: ReturnType<typeof vi.fn> }> = []
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      disconnect = vi.fn()
      constructor(callback: Callback) {
        watchers.push({ callback, disconnect: this.disconnect })
      }
      observe() {}
    },
  )
  return watchers
}

describe('useReveal (YC-91)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('keeps a block hidden until it scrolls into view, then lets it enter once', () => {
    const watchers = fakeObserver()
    render(<Block />)
    const block = screen.getByTestId('block')
    expect(block).toHaveClass('motion-safe:opacity-0')

    act(() => watchers[0].callback([{ isIntersecting: false }]))
    expect(block).toHaveClass('motion-safe:opacity-0')

    act(() => watchers[0].callback([{ isIntersecting: true }]))
    expect(block).toHaveClass('motion-safe:animate-yc-enter')
    expect(block).not.toHaveClass('motion-safe:opacity-0')
    expect(watchers[0].disconnect).toHaveBeenCalled()
  })

  it('shows the block at once where nothing watches the scroll', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    // `in window` sees a stubbed key: remove it, as in a browser without the API.
    delete (window as { IntersectionObserver?: unknown }).IntersectionObserver
    render(<Block />)
    expect(screen.getByTestId('block')).toHaveClass('motion-safe:animate-yc-enter')
  })
})
