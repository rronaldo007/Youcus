import { render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FocusPlayer } from './FocusPlayer'

describe('FocusPlayer', () => {
  let PlayerMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // Le constructeur renvoie une instance avec les méthodes du player.
    PlayerMock = vi.fn(() => ({ getCurrentTime: () => 0, seekTo: vi.fn(), destroy: vi.fn() }))
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
})
