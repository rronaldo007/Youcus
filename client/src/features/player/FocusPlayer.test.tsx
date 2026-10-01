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

  /** A player made ready, with every method a spy. */
  async function ready(props: Partial<Parameters<typeof FocusPlayer>[0]> = {}) {
    const ref = createRef<FocusPlayerHandle>()
    const instance = {
      getCurrentTime: vi.fn(() => 5),
      seekTo: vi.fn(),
      playVideo: vi.fn(),
      pauseVideo: vi.fn(),
      getPlayerState: vi.fn(() => 1),
      setPlaybackRate: vi.fn(),
      destroy: vi.fn(),
      loadModule: vi.fn(),
      unloadModule: vi.fn(),
      getOption: vi.fn(),
      setOption: vi.fn(),
    }
    PlayerMock.mockImplementation(() => instance)
    render(<FocusPlayer ref={ref} youtubeId="abc123" title="Ma vidéo" {...props} />)
    await waitFor(() => expect(PlayerMock).toHaveBeenCalled())
    type Events = { onReady: (e: { target: unknown }) => void; onApiChange: () => void; onPlaybackRateChange: (e: { data: number }) => void }
    const events = (PlayerMock.mock.calls[0][1] as { events: Events }).events
    events.onReady({ target: instance })
    return { ref, instance, events }
  }

  it('J / L move from where it is, never before 0 (YC-59)', async () => {
    const onTimeUpdate = vi.fn()
    const { ref, instance } = await ready({ onTimeUpdate })
    ref.current?.seekBy(10)
    expect(instance.seekTo).toHaveBeenLastCalledWith(15, true)
    expect(onTimeUpdate).toHaveBeenLastCalledWith(15)
    // Later, from where YouTube says it is.
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 5000)
    ref.current?.seekBy(-10)
    expect(instance.seekTo).toHaveBeenLastCalledWith(0, true)
    vi.restoreAllMocks()
  })

  it('two quick J add up, though YouTube still gives the old position (YC-59)', async () => {
    const { ref, instance } = await ready()
    instance.getCurrentTime.mockReturnValue(100)
    ref.current?.seekBy(-10)
    ref.current?.seekBy(-10)
    expect(instance.seekTo).toHaveBeenLastCalledWith(80, true)
  })

  it('space pauses while playing, plays otherwise (YC-59)', async () => {
    const { ref, instance } = await ready()
    ref.current?.togglePlay()
    expect(instance.pauseVideo).toHaveBeenCalledTimes(1)
    instance.getPlayerState.mockReturnValue(2)
    ref.current?.togglePlay()
    expect(instance.playVideo).toHaveBeenCalledTimes(1)
    expect(instance.pauseVideo).toHaveBeenCalledTimes(1)
  })

  it('takes the speed kept from the last video, and tells the speed set in its own menu (YC-59)', async () => {
    const onRateChange = vi.fn()
    const { ref, instance, events } = await ready({ rate: 1.5, onRateChange })
    expect(instance.setPlaybackRate).toHaveBeenCalledWith(1.5)
    ref.current?.setRate(2)
    expect(instance.setPlaybackRate).toHaveBeenLastCalledWith(2)
    events.onPlaybackRateChange({ data: 0.75 })
    expect(onRateChange).toHaveBeenCalledWith(0.75)
  })

  it('shows a caption language through the captions module, hides them by unloading it (YC-59)', async () => {
    const { ref, instance } = await ready()
    ref.current?.setCaptions('en')
    expect(instance.loadModule).toHaveBeenCalledWith('captions')
    expect(instance.setOption).toHaveBeenCalledWith('captions', 'track', { languageCode: 'en' })
    ref.current?.setCaptions(null)
    expect(instance.unloadModule).toHaveBeenCalledWith('captions')
  })

  it('keeps the captions of the last video, and reads the tracks once YouTube gives them (YC-59)', async () => {
    const onCaptionTracks = vi.fn()
    const { instance, events } = await ready({ captions: 'fr', onCaptionTracks })
    expect(instance.setOption).toHaveBeenCalledWith('captions', 'track', { languageCode: 'fr' })
    expect(onCaptionTracks).toHaveBeenLastCalledWith(null, null)
    instance.getOption.mockImplementation((_m: string, option: string) =>
      option === 'tracklist'
        ? [
            { languageCode: 'fr', languageName: 'Français', kind: '' },
            { languageCode: 'en', languageName: 'English', kind: 'asr' },
          ]
        : { languageCode: 'fr' },
    )
    events.onApiChange()
    expect(onCaptionTracks).toHaveBeenLastCalledWith(
      [
        { languageCode: 'fr', label: 'Français', auto: false },
        { languageCode: 'en', label: 'English', auto: true },
      ],
      'fr',
    )
  })

  it('if YouTube drops or refuses the undocumented captions calls, nothing breaks (YC-59)', async () => {
    const onCaptionTracks = vi.fn()
    const { ref, instance, events } = await ready({ onCaptionTracks })
    instance.setOption.mockImplementation(() => {
      throw new Error('gone')
    })
    instance.getOption.mockImplementation(() => {
      throw new Error('gone')
    })
    expect(() => ref.current?.setCaptions('fr')).not.toThrow()
    events.onApiChange()
    expect(onCaptionTracks).toHaveBeenLastCalledWith(null, null)
  })
})
