import type { LibraryVideo } from '@/types'

export type LibraryVideoState = 'todo' | 'progress' | 'seen'

/** À voir, En cours or Vue (Figma « Carte de vidéo » 104:150), for the card and the filters. */
export function libraryVideoState(video: LibraryVideo): LibraryVideoState {
  if (video.completed) return 'seen'
  return video.watchedSeconds > 0 ? 'progress' : 'todo'
}
