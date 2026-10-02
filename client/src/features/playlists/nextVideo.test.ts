import { describe, expect, it } from 'vitest'
import type { Video } from '@/types'
import { nextVideo } from './nextVideo'
import { formatTotalDuration } from '@/lib/format'

const v = (i: number, extra: Partial<Video> = {}): Video => ({
  id: `v${i}`, youtubeId: `y${i}`, title: `T${i}`, thumbnailUrl: null, position: i, durationSeconds: 600, ...extra,
})

describe('nextVideo (YC-75)', () => {
  it('resumes the first video started and not finished', () => {
    // A finished video keeps its last position: it is not « started » any more.
    const next = nextVideo([v(0, { completed: true, watchedSeconds: 600 }), v(1), v(2, { watchedSeconds: 30 }), v(3, { watchedSeconds: 10 })])
    expect(next).toMatchObject({ number: 3, label: 'Reprendre à la vidéo 3' })
  })

  it('else goes on with the first not seen, or begins when nothing is seen', () => {
    expect(nextVideo([v(0, { completed: true }), v(1)])).toMatchObject({ number: 2, label: 'Reprendre à la vidéo 2' })
    expect(nextVideo([v(0), v(1)])).toMatchObject({ number: 1, label: 'Commencer' })
  })

  it('never offers an unavailable video, and starts again when all are seen', () => {
    expect(nextVideo([v(0, { availability: 'PRIVATE', watchedSeconds: 50 }), v(1)])).toMatchObject({ number: 2 })
    expect(nextVideo([v(0, { completed: true }), v(1, { completed: true })])).toMatchObject({ number: 1, label: 'Revoir depuis le début' })
    expect(nextVideo([v(0, { availability: 'DELETED' })])).toBeNull()
  })
})

describe('formatTotalDuration (YC-75)', () => {
  it('says minutes, then hours and minutes, then whole hours from ten', () => {
    expect(formatTotalDuration(42 * 60)).toBe('42 min')
    expect(formatTotalDuration(90 * 60)).toBe('1 h 30')
    // The real fullstack playlist of the local base: 47 h 29 of video.
    expect(formatTotalDuration(170961)).toBe('47 h')
  })
})
