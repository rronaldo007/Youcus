import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ScrollPlayhead } from './ScrollPlayhead'

describe('ScrollPlayhead (YC-91)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('is as long as the part of the page already read', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 1
    })
    vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(3000)
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 })
    const { container } = render(<ScrollPlayhead />)
    const bar = container.querySelector('[data-scroll-playhead]') as HTMLElement
    expect(bar.style.transform).toBe('scaleX(0)')

    act(() => {
      Object.defineProperty(window, 'scrollY', { configurable: true, value: 1000 })
      window.dispatchEvent(new Event('scroll'))
    })
    expect(bar.style.transform).toBe('scaleX(0.5)')
  })
})
