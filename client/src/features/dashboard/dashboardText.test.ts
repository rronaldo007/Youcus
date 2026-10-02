import { describe, expect, it } from 'vitest'
import type { LibraryVideo, Playlist } from '@/types'
import { greeting, timeLeft, videosToWatch } from './dashboardText'

const at = (h: number) => new Date(2026, 9, 2, h, 0)

describe('dashboard texts (YC-74)', () => {
  it('says « Bonjour » until 18 h, « Bonsoir » after, with the first name only', () => {
    expect(greeting(at(9), 'Ronaldo Rukundo')).toBe('Bonjour Ronaldo.')
    expect(greeting(at(17), 'Ronaldo Rukundo')).toBe('Bonjour Ronaldo.')
    expect(greeting(at(18), 'Ronaldo Rukundo')).toBe('Bonsoir Ronaldo.')
    // The local account's real name, as Google gave it.
    expect(greeting(at(9), 'ronaldo rukundo')).toBe('Bonjour Ronaldo.')
  })

  it('counts the playable videos not seen, in playlists and on their own', () => {
    const pl = (over: Partial<Playlist>): Playlist => ({ id: 'p', youtubeId: 'y', title: 'T', thumbnailUrl: null, videoCount: 17, ...over })
    const video = (over: Partial<LibraryVideo>): LibraryVideo => ({
      id: 'v', youtubeId: 'y', title: 'V', thumbnailUrl: null, durationSeconds: 60, channelTitle: null,
      availability: 'AVAILABLE', addedAt: '', completed: false, watchedSeconds: 0, completedAt: null, ...over,
    })
    const playlists = [pl({ availableCount: 16, completedCount: 3 }), pl({ videoCount: 4 }), pl({ availableCount: 2, completedCount: 2 })]
    const videos = [video({}), video({ completed: true }), video({ availability: 'DELETED' })]
    // 13 + 4 + 0 in playlists, 1 video on its own.
    expect(videosToWatch(playlists, videos)).toBe(18)
  })

  it('rounds the time left up to the minute, never to zero, in hours from an hour', () => {
    expect(timeLeft(845, 245)).toBe('10 min')
    expect(timeLeft(845, 844)).toBe('1 min')
    expect(timeLeft(3600, 0)).toBe('1 h 00')
    // The real 47-hour course of the local base, 14 s in.
    expect(timeLeft(170961, 14)).toBe('47 h 30')
  })
})
