import { render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FocusPlayer } from './FocusPlayer'
import { localDay } from './studyLog'

// The study log (YC-79): the player counts the seconds really played, and sends them.

const sent = vi.hoisted(() => [] as number[])
vi.mock('./studyLog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./studyLog')>()
  return { ...actual, reportStudySeconds: (s: number) => void sent.push(s) }
})

describe('what the player counts (YC-79)', () => {
  type Events = { onReady: (e: { target: unknown }) => void; onStateChange: (e: { data: number }) => void }
  let instance: { seekTo: ReturnType<typeof vi.fn> }

  async function playing() {
    instance = { getCurrentTime: () => 0, seekTo: vi.fn(), playVideo: vi.fn(), destroy: vi.fn() } as never
    const PlayerMock = vi.fn(() => instance)
    vi.stubGlobal('YT', { Player: PlayerMock, PlayerState: { PLAYING: 1, PAUSED: 2, ENDED: 0 } })
    const view = render(<FocusPlayer youtubeId="abc123" title="Ma vidéo" />)
    await waitFor(() => expect(PlayerMock).toHaveBeenCalled())
    const events = ((PlayerMock.mock.calls[0] as unknown[])[1] as { events: Events }).events
    events.onReady({ target: instance })
    vi.useFakeTimers()
    events.onStateChange({ data: 1 })
    return { events, view }
  }

  beforeEach(() => {
    sent.length = 0
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('every 15 s of playback, then what is left at the pause', async () => {
    const { events } = await playing()
    vi.advanceTimersByTime(15_000)
    expect(sent).toEqual([15])
    vi.advanceTimersByTime(7_000)
    events.onStateChange({ data: 2 })
    expect(sent).toEqual([15, 7])
  })

  it('nothing while paused, and a seek adds nothing: only the clock while it plays', async () => {
    const { events } = await playing()
    vi.advanceTimersByTime(4_000)
    events.onStateChange({ data: 2 })
    vi.advanceTimersByTime(60_000)
    events.onStateChange({ data: 1 })
    ;(instance as unknown as { getCurrentTime: () => number }).getCurrentTime = () => 1800
    vi.advanceTimersByTime(3_000)
    events.onStateChange({ data: 0 })
    expect(sent).toEqual([4, 3])
  })

  it('leaving the page sends what was played since the last report', async () => {
    const { view } = await playing()
    vi.advanceTimersByTime(18_000)
    view.unmount()
    expect(sent).toEqual([15, 3])
  })
})

describe('the report itself (YC-79)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('the day is the user\'s own: 00:30 counts for the day it is there', () => {
    expect(localDay(new Date(2026, 9, 3, 0, 30))).toBe('2026-10-03')
    expect(localDay(new Date(2026, 0, 9, 23, 59))).toBe('2026-01-09')
  })
})
