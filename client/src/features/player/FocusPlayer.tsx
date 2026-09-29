import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

// Types minimaux de la YouTube IFrame Player API.
interface YTPlayer {
  getCurrentTime(): number
  seekTo(seconds: number, allowSeekAhead: boolean): void
  playVideo(): void
  destroy(): void
}

/** What the page can ask of the player (YC-6). */
export interface FocusPlayerHandle {
  /** Jumps to `seconds` and plays from there. */
  seekTo(seconds: number): void
}
interface YTNamespace {
  Player: new (el: HTMLElement, opts: unknown) => YTPlayer
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number }
}
declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiPromise: Promise<void> | null = null
function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve()
  if (apiPromise) return apiPromise
  apiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      resolve()
    }
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
  })
  return apiPromise
}

interface FocusPlayerProps {
  youtubeId: string
  title: string
  /** Position de reprise (secondes). */
  startSeconds?: number
  /** Appelé périodiquement et aux pauses/fin avec la position courante. */
  onProgress?: (seconds: number) => void
  /** Appelé quand la vidéo se termine. */
  onEnded?: () => void
  /** Current position, every second while playing and right after a seek (YC-6). */
  onTimeUpdate?: (seconds: number) => void
}

/**
 * Lecteur focus via la YouTube IFrame Player API (SDK JS).
 * Reprend à `startSeconds`, remonte la position via `onProgress`, signale la fin via `onEnded`.
 * Sans distraction : rel=0, modestbranding, iv_load_policy=3.
 */
export const FocusPlayer = forwardRef<FocusPlayerHandle, FocusPlayerProps>(function FocusPlayer(
  { youtubeId, title, startSeconds = 0, onProgress, onEnded, onTimeUpdate },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YTPlayer | null>(null)
  const onProgressRef = useRef(onProgress)
  const onEndedRef = useRef(onEnded)
  const onTimeUpdateRef = useRef(onTimeUpdate)
  onProgressRef.current = onProgress
  onEndedRef.current = onEnded
  onTimeUpdateRef.current = onTimeUpdate

  useImperativeHandle(
    ref,
    () => ({
      seekTo(seconds: number) {
        const player = playerRef.current
        if (!player) return
        player.seekTo(seconds, true)
        player.playVideo()
        onTimeUpdateRef.current?.(seconds)
      },
    }),
    [],
  )

  useEffect(() => {
    let cancelled = false
    let player: YTPlayer | null = null
    let interval: ReturnType<typeof setInterval> | undefined

    let ticks = 0

    const report = () => {
      const t = Math.floor(player?.getCurrentTime() ?? 0)
      if (t > 0) onProgressRef.current?.(t)
    }
    // Every second: the current position for the chapters; every fifth: the saved progress.
    const tick = () => {
      onTimeUpdateRef.current?.(player?.getCurrentTime() ?? 0)
      ticks += 1
      if (ticks % 5 === 0) report()
    }

    loadYouTubeApi().then(() => {
      if (cancelled || !containerRef.current || !window.YT) return
      const YT = window.YT
      player = new YT.Player(containerRef.current, {
        videoId: youtubeId,
        playerVars: {
          rel: 0,
          modestbranding: 1,
          iv_load_policy: 3,
          playsinline: 1,
          start: Math.floor(startSeconds),
        },
        events: {
          onReady: (e: { target: YTPlayer }) => {
            playerRef.current = e.target
            if (startSeconds > 0) e.target.seekTo(startSeconds, true)
            onTimeUpdateRef.current?.(startSeconds)
          },
          onStateChange: (e: { data: number }) => {
            if (e.data === YT.PlayerState.PLAYING) {
              if (interval) clearInterval(interval)
              interval = setInterval(tick, 1000)
            } else {
              if (interval) clearInterval(interval)
              interval = undefined
              onTimeUpdateRef.current?.(player?.getCurrentTime() ?? 0)
              report()
              if (e.data === YT.PlayerState.ENDED) onEndedRef.current?.()
            }
          },
        },
      })
    })

    return () => {
      cancelled = true
      if (interval) clearInterval(interval)
      player?.destroy()
      playerRef.current = null
    }
  }, [youtubeId, startSeconds])

  return (
    <div>
      <div className="aspect-video w-full overflow-hidden rounded-card bg-black">
        <div ref={containerRef} title={title} className="h-full w-full" />
      </div>
      <p className="mt-2 text-xs text-content-muted">
        Youcus retire les recommandations et l'habillage qui font dériver. Les publicités, elles,
        restent celles de YouTube : les conditions de son API interdisent de les bloquer, et elles
        rémunèrent les créateurs dont vous regardez le travail.
      </p>
    </div>
  )
})
