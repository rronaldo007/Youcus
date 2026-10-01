import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

/** Same bounds as the server (server/src/services/search.service.ts). */
export const MIN_QUERY = 2
export const MAX_QUERY = 100

export type VideoState = 'todo' | 'progress' | 'seen'

export interface SearchPlaylist {
  id: string
  title: string
  thumbnailUrl: string | null
  channel: string | null
  videoCount: number
  completedCount: number
  titleMatches: number
}

export interface SearchVideo {
  youtubeId: string
  title: string
  thumbnailUrl: string | null
  channel: string | null
  durationSeconds: number
  state: VideoState
  playlist: { id: string; title: string; position: number; count: number } | null
}

export interface SearchNoteLine {
  noteId: string
  text: string
  marker: number | null
  section: string | null
  video: { youtubeId: string; title: string; playlist: { id: string; title: string } | null } | null
  playlist: { id: string; title: string } | null
}

export interface SearchResults {
  query: string
  playlists: { total: number; items: SearchPlaylist[] }
  videos: { total: number; items: SearchVideo[] }
  notes: { total: number; items: SearchNoteLine[] }
}

export const SEARCH_TYPES = ['all', 'playlists', 'videos', 'notes'] as const
export type SearchType = (typeof SEARCH_TYPES)[number]
export const readType = (value: string | null): SearchType => (SEARCH_TYPES.includes(value as SearchType) ? (value as SearchType) : 'all')

/** The address of the results: the term, and the filter when it is not « Tout ». */
export function searchPath(query: string, type: SearchType = 'all') {
  const params = new URLSearchParams({ q: query.trim() })
  if (type !== 'all') params.set('type', type)
  return `/recherche?${params}`
}

/** The results of a term of 2 characters or more, kept a little: going back shows them at once. */
export function useSearch(query: string) {
  const q = query.trim()
  return useQuery({
    queryKey: ['search', q],
    queryFn: () => apiFetch<SearchResults>(`/search?q=${encodeURIComponent(q)}`),
    enabled: q.length >= MIN_QUERY,
    staleTime: 30_000,
  })
}

const videoPath = (youtubeId: string, playlistId: string | undefined, at?: number | null) => {
  const base = playlistId ? `/playlists/${playlistId}/watch/${youtubeId}` : `/videos/${youtubeId}`
  return at === null || at === undefined ? base : `${base}?t=${at}`
}

export const playlistLink = (p: SearchPlaylist) => `/playlists/${p.id}`
export const videoLink = (v: SearchVideo) => videoPath(v.youtubeId, v.playlist?.id)
/** A line of a video's note opens the video at its marker; a playlist's note, the playlist. */
export const noteLink = (n: SearchNoteLine) =>
  n.video ? videoPath(n.video.youtubeId, n.video.playlist?.id, n.marker) : n.playlist ? `/playlists/${n.playlist.id}` : '/'

/** Where the results lead, in the order the page shows them under this filter. */
export function resultLinks(results: SearchResults, type: SearchType): string[] {
  return [
    ...(type === 'all' || type === 'playlists' ? results.playlists.items.map(playlistLink) : []),
    ...(type === 'all' || type === 'videos' ? results.videos.items.map(videoLink) : []),
    ...(type === 'all' || type === 'notes' ? results.notes.items.map(noteLink) : []),
  ]
}

/** A character as the search compares it: lower case, no accent (MySQL utf8mb4_unicode_ci). */
const foldChar = (c: string) => c.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/**
 * The places `text` holds `query`, whatever their case and accents: « element » marks
 * « Élément ». Returns [start, end) ranges in `text`.
 */
export function matches(text: string, query: string): [number, number][] {
  const q = [...query.trim()].map(foldChar).join('')
  if (!q) return []
  // The folded text, and for each of its characters the place it comes from in `text`.
  let folded = ''
  const from: number[] = []
  for (let i = 0; i < text.length; ) {
    const ch = String.fromCodePoint(text.codePointAt(i) as number)
    const f = foldChar(ch)
    for (let k = 0; k < f.length; k += 1) from.push(i)
    folded += f
    i += ch.length
  }
  from.push(text.length)
  const out: [number, number][] = []
  for (let at = folded.indexOf(q); at >= 0; at = folded.indexOf(q, at + q.length)) {
    out.push([from[at], from[at + q.length]])
  }
  return out
}
