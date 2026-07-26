import { useEffect, useRef } from 'react'

// Types minimaux de la YouTube IFrame Player API.
interface YTPlayer {
  getCurrentTime(): number
  seekTo(seconds: number, allowSeekAhead: boolean): void
  destroy(): void
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
}

/**
 * Lecteur focus via la YouTube IFrame Player API (SDK JS).
 * Reprend à `startSeconds`, remonte la position via `onProgress`, signale la fin via `onEnded`.
 * Sans distraction : rel=0, modestbranding, iv_load_policy=3.
 */
export function FocusPlayer({ youtubeId, title, startSeconds = 0, onProgress, onEnded }: FocusPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onProgressRef = useRef(onProgress)
  const onEndedRef = useRef(onEnded)
  onProgressRef.current = onProgress
  onEndedRef.current = onEnded

  useEffect(() => {
    let cancelled = false
    let player: YTPlayer | null = null
    let interval: ReturnType<typeof setInterval> | undefined

    const report = () => {
      const t = Math.floor(player?.getCurrentTime() ?? 0)
      if (t > 0) onProgressRef.current?.(t)
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
            if (startSeconds > 0) e.target.seekTo(startSeconds, true)
          },
          onStateChange: (e: { data: number }) => {
            if (e.data === YT.PlayerState.PLAYING) {
              interval = setInterval(report, 5000)
            } else {
              if (interval) clearInterval(interval)
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
}
