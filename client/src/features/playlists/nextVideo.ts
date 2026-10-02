import { isPlayable } from '@/lib/availability'
import type { Video } from '@/types'

export interface NextVideo {
  video: Video
  /** 1-based, the way the list numbers it. */
  number: number
  label: string
}

/**
 * The main button of a playlist (Figma « Détail de playlist » 16:434, « Reprendre à la vidéo 4 »):
 * the first video started and not finished, else the first not seen yet, else the first again. Only
 * playable videos count (YC-13); null when none can be played.
 */
export function nextVideo(videos: Video[]): NextVideo | null {
  const numbered = videos.map((video, i) => ({ video, number: i + 1 })).filter(({ video }) => isPlayable(video))
  const started = numbered.find(({ video }) => !video.completed && (video.watchedSeconds ?? 0) > 0)
  if (started) return { ...started, label: `Reprendre à la vidéo ${started.number}` }
  const unseen = numbered.find(({ video }) => !video.completed)
  if (unseen) {
    const begun = numbered.some(({ video }) => video.completed)
    return { ...unseen, label: begun ? `Reprendre à la vidéo ${unseen.number}` : 'Commencer' }
  }
  return numbered[0] ? { ...numbered[0], label: 'Revoir depuis le début' } : null
}
