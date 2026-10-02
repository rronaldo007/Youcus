import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { currentChapterIndex } from '@/lib/chapters'
import { VideoChapters } from './VideoChapters'

const chapters = [
  { position: 0, startSeconds: 0, title: 'Intro' },
  { position: 1, startSeconds: 98, title: 'Setup NodeJS Server' },
  { position: 2, startSeconds: 1238, title: 'Routes' },
  { position: 3, startSeconds: 3723, title: 'Controllers' },
]

describe('currentChapterIndex (YC-6)', () => {
  it('is the last chapter that has started', () => {
    expect(currentChapterIndex(chapters, 0)).toBe(0)
    expect(currentChapterIndex(chapters, 97.9)).toBe(0)
    expect(currentChapterIndex(chapters, 98)).toBe(1)
    expect(currentChapterIndex(chapters, 5000)).toBe(3)
    expect(currentChapterIndex([], 10)).toBe(-1)
  })
})

describe('VideoChapters (YC-6)', () => {
  it('lists the chapters with their timestamps, hours included', () => {
    render(<VideoChapters chapters={chapters} currentSeconds={0} onSeek={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Chapitres (4)' })).toBeInTheDocument()
    expect(screen.getByText('00:00')).toBeInTheDocument()
    expect(screen.getByText('01:38')).toBeInTheDocument()
    expect(screen.getByText('1:02:03')).toBeInTheDocument()
  })

  it('moves the player to the chapter clicked', () => {
    const onSeek = vi.fn()
    render(<VideoChapters chapters={chapters} currentSeconds={0} onSeek={onSeek} />)
    fireEvent.click(screen.getByRole('button', { name: /Routes/ }))
    expect(onSeek).toHaveBeenCalledWith(1238)
  })

  it('highlights the chapter playing and follows the playback', () => {
    const { rerender } = render(<VideoChapters chapters={chapters} currentSeconds={100} onSeek={vi.fn()} />)
    const current = () => screen.getByRole('button', { current: true })
    expect(current()).toHaveTextContent('Setup NodeJS Server')
    expect(current()).toHaveTextContent('● en cours')
    rerender(<VideoChapters chapters={chapters} currentSeconds={1300} onSeek={vi.fn()} />)
    expect(current()).toHaveTextContent('Routes')
    expect(screen.getAllByText('● en cours')).toHaveLength(1)
  })

  it('shows nothing when the description has no chapters', () => {
    const { container } = render(<VideoChapters chapters={[]} currentSeconds={0} onSeek={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
})
