import type { LibraryVideo, Playlist } from '@/types'
import { libraryVideoState } from '@/features/library/libraryVideoState'

/** « Bonjour » until 18 h, then « Bonsoir » (Figma « Tableau de bord » 11:5). */
export function greeting(now: Date, displayName: string): string {
  const first = displayName.trim().split(/\s+/)[0] ?? ''
  // Google gives the name as the person typed it, « ronaldo » included: a greeting starts it upper case.
  const firstName = first.charAt(0).toLocaleUpperCase('fr-FR') + first.slice(1)
  return `${now.getHours() < 18 ? 'Bonjour' : 'Bonsoir'} ${firstName}.`
}

/** « mardi 29 septembre » on a computer, « mardi 29 sept. » on a tablet or a phone. */
export function dayLabel(now: Date, short = false): string {
  return now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: short ? 'short' : 'long' })
}

/**
 * The videos left to watch: in each playlist the playable ones not seen yet, plus the videos kept
 * on their own and not seen. A video in two playlists counts in both, as each card says.
 */
export function videosToWatch(playlists: Playlist[], videos: LibraryVideo[]): number {
  const inPlaylists = playlists.reduce((sum, pl) => {
    const total = pl.availableCount ?? pl.videoCount
    return sum + Math.max(0, total - (pl.completedCount ?? 0))
  }, 0)
  const alone = videos.filter((v) => v.availability === 'AVAILABLE' && libraryVideoState(v) !== 'seen').length
  return inPlaylists + alone
}

/**
 * Time left to finish a video, never zero: « 10 min », and from an hour « 47 h 30 » (a course can last
 * two days: « 2850 min » was seen on a real one).
 */
export function timeLeft(durationSeconds: number, watchedSeconds: number): string {
  const minutes = Math.max(1, Math.ceil((durationSeconds - watchedSeconds) / 60))
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`
}
