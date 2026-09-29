import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LinkifiedText } from './LinkifiedText'

describe('LinkifiedText timestamps (YC-6)', () => {
  it('turns timestamps into buttons that move the player', () => {
    const onSeek = vi.fn()
    render(<LinkifiedText text={'00:00:00 | Intro\n01:38 Setup\nat 1:02:03 the end'} onSeek={onSeek} />)
    fireEvent.click(screen.getByRole('button', { name: 'Aller à 01:38' }))
    expect(onSeek).toHaveBeenCalledWith(98)
    fireEvent.click(screen.getByRole('button', { name: 'Aller à 1:02:03' }))
    expect(onSeek).toHaveBeenCalledWith(3723)
    fireEvent.click(screen.getByRole('button', { name: 'Aller à 00:00:00' }))
    expect(onSeek).toHaveBeenCalledWith(0)
  })

  it('never takes a time inside an address, a longer number or a clock for a timestamp', () => {
    render(
      <LinkifiedText
        text="See https://site.com/t/12:30/x and 2024:10:05 and 12:345 and 1:2"
        onSeek={vi.fn()}
      />,
    )
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://site.com/t/12:30/x')
  })

  it('leaves a timestamp past the end of the video as plain text', () => {
    render(<LinkifiedText text="0:30 in, 9:00 out" onSeek={vi.fn()} maxSeconds={300} />)
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['0:30'])
  })

  it('keeps timestamps as plain text when there is no player to move', () => {
    render(<LinkifiedText text="01:38 Setup" />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
