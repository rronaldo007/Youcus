import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ThemeToggle } from './ThemeToggle'

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })
  afterEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  it('bascule la classe dark sur <html> et persiste le choix', () => {
    render(<ThemeToggle />)
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    fireEvent.click(screen.getByRole('button'))

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('youcus-theme')).toBe('dark')
  })
})
