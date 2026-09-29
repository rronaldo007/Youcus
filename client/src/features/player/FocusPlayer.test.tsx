import { createRef } from 'react'
import { render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FocusPlayer, type FocusPlayerHandle } from './FocusPlayer'

describe('FocusPlayer', () => {
  let PlayerMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // Le constructeur renvoie une instance avec les méthodes du player.
    PlayerMock = vi.fn(() => ({ getCurrentTime: () => 0, seekTo: vi.fn(), playVideo: vi.fn(), destroy: vi.fn() }))
    vi.stubGlobal('YT', { Player: PlayerMock, PlayerState: { PLAYING: 1, PAUSED: 2, ENDED: 0 } })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('initialise le player YT avec la vidéo, la reprise et sans recommandations', async () => {
    render(<FocusPlayer youtubeId="abc123" title="Ma vidéo" startSeconds={42} />)

    await waitFor(() => expect(PlayerMock).toHaveBeenCalled())

    const opts = PlayerMock.mock.calls[0][1] as {
      videoId: string
      playerVars: { start: number; rel: number }
    }
    expect(opts.videoId).toBe('abc123')
    expect(opts.playerVars.start).toBe(42) // reprise à la dernière position
    expect(opts.playerVars.rel).toBe(0) // sans recommandations
  })

  it('moves to a second, plays, and reports the new position at once (YC-6)', async () => {
    const ref = createRef<FocusPlayerHandle>()
    const onTimeUpdate = vi.fn()
    render(<FocusPlayer ref={ref} youtubeId="abc123" title="Ma vidéo" onTimeUpdate={onTimeUpdate} />)
    await waitFor(() => expect(PlayerMock).toHaveBeenCalled())
    const opts = PlayerMock.mock.calls[0][1] as { events: { onReady: (e: { target: unknown }) => void } }
    const player = PlayerMock.mock.results[0].value as { seekTo: ReturnType<typeof vi.fn>; playVideo: ReturnType<typeof vi.fn> }
    opts.events.onReady({ target: player })

    ref.current?.seekTo(1238)

    expect(player.seekTo).toHaveBeenCalledWith(1238, true)
    expect(player.playVideo).toHaveBeenCalled()
    expect(onTimeUpdate).toHaveBeenLastCalledWith(1238)
  })
})
