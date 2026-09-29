import type { VideoChapter } from '@/types'

/** Index of the chapter playing at `seconds` (the last one that has started), or -1. */
export function currentChapterIndex(chapters: VideoChapter[], seconds: number): number {
  let index = -1
  for (let i = 0; i < chapters.length; i++) {
    if (chapters[i].startSeconds <= seconds) index = i
    else break
  }
  return index
}
