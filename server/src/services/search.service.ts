import { prisma } from '@/lib/prisma'
import { accessibleBy } from '@/lib/videoAccess'
import { markdownToDoc } from '@/lib/markdownToDoc'
import { noteLines, type NoteDoc } from '@/lib/noteDoc'

/**
 * The search (YC-22), Figma « Recherche » 110:36166: the playlists, videos and notes of one user,
 * never YouTube (search.list costs 100 units and brings the drift back).
 *
 * A substring, not the words of a FULLTEXT index: « Effect » finds « useEffect », as the highlight
 * shows it. The columns are utf8mb4_unicode_ci, so LIKE ignores case and accents; the rows are the
 * user's own (an index on the owner), measured under 300 ms on 1 000 notes.
 */

export const MIN_QUERY = 2
export const MAX_QUERY = 100
/** What a section lists; its count says how many there are in all. */
export const MAX_ITEMS = 50
/** The lines of one note that may show: past that, the note is said once more by the next ones. */
export const MAX_LINES_PER_NOTE = 5
/** The part of a long line around the term. */
const EXCERPT = 140

export type VideoState = 'todo' | 'progress' | 'seen'

export interface SearchPlaylist {
  id: string
  title: string
  thumbnailUrl: string | null
  channel: string | null
  videoCount: number
  completedCount: number
  /** Videos of this playlist whose title holds the term (« le terme est dans 3 titres »). */
  titleMatches: number
}

export interface SearchVideo {
  youtubeId: string
  title: string
  thumbnailUrl: string | null
  channel: string | null
  durationSeconds: number
  state: VideoState
  /** The first playlist of the user that holds it, and its place there; null for a video alone. */
  playlist: { id: string; title: string; position: number; count: number } | null
}

export interface SearchNoteLine {
  noteId: string
  text: string
  marker: number | null
  section: string | null
  /** The note of a video (opened at the marker) or of a playlist. */
  video: { youtubeId: string; title: string; playlist: { id: string; title: string } | null } | null
  playlist: { id: string; title: string } | null
}

export interface SearchResults {
  query: string
  playlists: { total: number; items: SearchPlaylist[] }
  videos: { total: number; items: SearchVideo[] }
  notes: { total: number; items: SearchNoteLine[] }
}

/** Lower case, no accents: how MySQL's unicode_ci compares, for the lines it does not cut. */
export const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** The part of a line around the first place it holds the term, cut at words. */
export function excerpt(text: string, query: string): string {
  const line = text.replace(/\s+/g, ' ').trim()
  if (line.length <= EXCERPT) return line
  const at = Math.max(0, fold(line).indexOf(fold(query)))
  let from = Math.max(0, at - Math.floor((EXCERPT - query.length) / 2))
  let to = Math.min(line.length, from + EXCERPT)
  from = Math.max(0, to - EXCERPT)
  if (from > 0) from = line.indexOf(' ', from) + 1 || from
  if (to < line.length) to = line.lastIndexOf(' ', to) > at + query.length ? line.lastIndexOf(' ', to) : to
  return `${from > 0 ? '…' : ''}${line.slice(from, to).trim()}${to < line.length ? '…' : ''}`
}

const stateOf = (p: { completed: boolean; watchedSeconds: number } | undefined): VideoState =>
  p?.completed ? 'seen' : (p?.watchedSeconds ?? 0) > 0 ? 'progress' : 'todo'

/** `%` and `_` are wildcards of LIKE, which Prisma passes as they are: here they are only characters. */
export const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`)

export async function search(userId: string, rawQuery: string): Promise<SearchResults> {
  const query = rawQuery.trim()
  const has = { contains: escapeLike(query) }

  const [playlists, videos, notes] = await Promise.all([
    searchPlaylists(userId, query, has),
    searchVideos(userId, has),
    searchNotes(userId, query, has),
  ])
  return { query, playlists, videos, notes }
}

async function searchPlaylists(userId: string, query: string, has: { contains: string }) {
  const where = {
    ownerId: userId,
    // A source of a merge is found through its merge (YC-95).
    mergedIntoId: null,
    OR: [{ title: has }, { channel: { title: has } }, { videos: { some: { video: { title: has } } } }],
  }
  const [total, rows] = await Promise.all([
    prisma.playlist.count({ where }),
    prisma.playlist.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: MAX_ITEMS,
      select: {
        id: true,
        title: true,
        thumbnailUrl: true,
        channel: { select: { title: true } },
        videos: { select: { video: { select: { title: true, progress: { where: { userId, completed: true }, select: { id: true } } } } } },
      },
    }),
  ])
  const q = fold(query)
  const items = rows
    .map((r) => ({
      id: r.id,
      title: r.title,
      thumbnailUrl: r.thumbnailUrl,
      channel: r.channel?.title ?? null,
      videoCount: r.videos.length,
      completedCount: r.videos.filter((v) => v.video.progress.length > 0).length,
      titleMatches: r.videos.filter((v) => fold(v.video.title).includes(q)).length,
    }))
    // Its own title first: a playlist named after the term before one that only holds it.
    .sort((a, b) => Number(fold(b.title).includes(q)) - Number(fold(a.title).includes(q)))
  return { total, items }
}

async function searchVideos(userId: string, has: { contains: string }) {
  const where = { AND: [accessibleBy(userId), { OR: [{ title: has }, { channel: { title: has } }] }] }
  const [total, rows] = await Promise.all([
    prisma.video.count({ where }),
    prisma.video.findMany({
      where,
      orderBy: { title: 'asc' },
      take: MAX_ITEMS,
      select: {
        youtubeId: true,
        title: true,
        thumbnailUrl: true,
        durationSeconds: true,
        channel: { select: { title: true } },
        progress: { where: { userId }, select: { completed: true, watchedSeconds: true } },
        playlists: {
          where: { playlist: { ownerId: userId, mergedIntoId: null } },
          orderBy: { playlist: { createdAt: 'desc' } },
          take: 1,
          select: { position: true, playlist: { select: { id: true, title: true, _count: { select: { videos: true } } } } },
        },
      },
    }),
  ])
  const items: SearchVideo[] = rows.map((r) => {
    const entry = r.playlists[0]
    return {
      youtubeId: r.youtubeId,
      title: r.title,
      thumbnailUrl: r.thumbnailUrl,
      channel: r.channel?.title ?? null,
      durationSeconds: r.durationSeconds,
      state: stateOf(r.progress[0]),
      playlist: entry
        ? { id: entry.playlist.id, title: entry.playlist.title, position: entry.position + 1, count: entry.playlist._count.videos }
        : null,
    }
  })
  return { total, items }
}

async function searchNotes(userId: string, query: string, has: { contains: string }) {
  const rows = await prisma.note.findMany({
    where: { authorId: userId, content: has },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      doc: true,
      content: true,
      playlist: { select: { id: true, title: true } },
      video: {
        select: {
          youtubeId: true,
          title: true,
          playlists: { where: { playlist: { ownerId: userId, mergedIntoId: null } }, orderBy: { playlist: { createdAt: 'desc' } }, take: 1, select: { playlist: { select: { id: true, title: true } } } },
        },
      },
    },
  })
  const q = fold(query)
  const all: SearchNoteLine[] = []
  for (const note of rows) {
    const doc = note.doc ? (note.doc as unknown as NoteDoc) : markdownToDoc(note.content)
    const lines = noteLines(doc).filter((l) => fold(l.text).includes(q))
    // MySQL found it, no line holds it whole (a term across two lines): the text around it, so the
    // note is never dropped.
    const found = lines.length ? lines : [{ text: note.content, marker: null, section: null }]
    for (const line of found.slice(0, MAX_LINES_PER_NOTE)) {
      all.push({
        noteId: note.id,
        text: excerpt(line.text, query),
        marker: note.video ? line.marker : null,
        section: line.section,
        video: note.video ? { youtubeId: note.video.youtubeId, title: note.video.title, playlist: note.video.playlists[0]?.playlist ?? null } : null,
        playlist: note.playlist,
      })
    }
  }
  return { total: all.length, items: all.slice(0, MAX_ITEMS) }
}
