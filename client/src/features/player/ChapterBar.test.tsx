import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { VideoChapter } from '@/types'
import { ChapterBar } from './ChapterBar'

// YC-88: the bar under the video, cut where each chapter starts (Figma 22:1425).

const ch = (startSeconds: number, title: string, position = 0): VideoChapter => ({ position, startSeconds, title })
const chapters = [ch(0, 'Intro', 0), ch(60, 'Le tableau de dépendances', 1), ch(300, 'Le nettoyage', 2)]

function bar(props: Partial<Parameters<typeof ChapterBar>[0]> = {}) {
  const onSeek = vi.fn()
  const view = render(<ChapterBar chapters={chapters} durationSeconds={600} currentSeconds={120} onSeek={onSeek} {...props} />)
  const segments = [...view.container.querySelectorAll<HTMLElement>('[data-chapter-segment]')]
  return { onSeek, segments, slider: screen.queryByRole('slider'), ...view }
}

describe('the bar cut at the chapters (YC-88)', () => {
  it('shows nothing for a video without chapters, or without a length', () => {
    expect(bar({ chapters: [] }).container).toBeEmptyDOMElement()
  })

  it('shows nothing without a length', () => {
    expect(bar({ durationSeconds: 0 }).container).toBeEmptyDOMElement()
  })

  it('one piece per chapter, as long as the chapter', () => {
    const { segments } = bar()
    expect(segments.map((s) => s.style.flexGrow)).toEqual(['60', '240', '300'])
  })

  it('fills what is played, and the playhead stands in the chapter playing', () => {
    const { segments, slider } = bar()
    const fill = (s: HTMLElement) => (s.querySelector('.bg-accent') as HTMLElement).style.width
    expect(segments.map(fill)).toEqual(['100%', '25%', '0%'])
    expect(segments.map((s) => !!s.querySelector('[data-playhead]'))).toEqual([false, true, false])
    expect((segments[1].querySelector('[data-playhead]') as HTMLElement).style.left).toBe('25%')
    expect(slider).toHaveAttribute('aria-valuenow', '120')
    expect(slider).toHaveAttribute('aria-valuemax', '600')
    expect(slider).toHaveAttribute('aria-valuetext', '02:00, Le tableau de dépendances')
  })

  it('the legend says where, in which chapter, and how long', () => {
    bar()
    expect(screen.getByText('02:00 · Le tableau de dépendances')).toBeInTheDocument()
    expect(screen.getByText('10:00')).toBeInTheDocument()
  })

  it('a click goes to that point of the chapter clicked', () => {
    const { segments, onSeek } = bar()
    vi.spyOn(segments[2], 'getBoundingClientRect').mockReturnValue({ left: 100, width: 200, top: 0, height: 44 } as DOMRect)
    fireEvent.click(segments[2], { clientX: 150 })
    // A quarter of « Le nettoyage » (300 → 600).
    expect(onSeek).toHaveBeenCalledWith(375)
  })

  it('the keyboard: 5 s with the arrows, chapter to chapter with the page keys, the start with Home', () => {
    const { slider, onSeek } = bar()
    const key = (k: string) => fireEvent.keyDown(slider as HTMLElement, { key: k })
    key('ArrowRight')
    key('ArrowLeft')
    key('PageDown')
    key('PageUp')
    key('Home')
    expect(onSeek.mock.calls.map((c) => c[0])).toEqual([125, 115, 300, 60, 0])
  })

  it('never seeks past the end nor before the start', () => {
    const { slider, onSeek } = bar({ currentSeconds: 598 })
    fireEvent.keyDown(slider as HTMLElement, { key: 'ArrowRight' })
    expect(onSeek).toHaveBeenLastCalledWith(600)
  })

  it('a first chapter after 0:00 leaves a first piece without a title; a chapter past the end is dropped', () => {
    const { segments } = bar({ chapters: [ch(30, 'Début'), ch(900, 'Après la fin')], currentSeconds: 10 })
    expect(segments.map((s) => s.style.flexGrow)).toEqual(['30', '570'])
    expect(screen.getByText('00:10')).toBeInTheDocument()
  })
})
