import { prisma } from '@/lib/prisma'
import { accessibleBy } from '@/lib/videoAccess'
import { Prisma } from '@prisma/client'
import { HttpError } from '@/middleware/errorHandler'
import { markdownToDoc } from '@/lib/markdownToDoc'
import { EMPTY_DOC, docToPlainText, type NoteDoc, type NoteNode } from '@/lib/noteDoc'
import { readNotePreferences, type NotePage } from '@/lib/notePage'

export interface VideoNote {
  doc: NoteDoc
  /** Paper, tint and margin of the note (YC-45); null = the defaults. */
  page: NotePage | null
  updatedAt: Date
}

type StoredNote = { content: string; doc: Prisma.JsonValue; page: Prisma.JsonValue; updatedAt: Date }
const NOTE_SELECT = { content: true, doc: true, page: true, updatedAt: true } as const

/**
 * The rich document of a stored note (YC-40). A note written before the rich editor has no
 * `doc` yet: its Markdown is converted on read, and replaced on the next save.
 */
function toNote(note: StoredNote | null): VideoNote | null {
  if (!note) return null
  const doc = note.doc ? (note.doc as unknown as NoteDoc) : note.content ? markdownToDoc(note.content) : EMPTY_DOC
  return { doc, page: (note.page as unknown as NotePage | null) ?? null, updatedAt: note.updatedAt }
}

/**
 * What is written for a document: the JSON, and in `content` its plain text for export and
 * search. On the FIRST rich save of a legacy Markdown note, its original Markdown is copied to
 * `legacyMarkdown` and never touched again: an archive in case the conversion missed something.
 */
function stored(doc: NoteDoc, existing: { doc: Prisma.JsonValue; content: string } | null, page?: NotePage) {
  const written = {
    doc: doc as unknown as Prisma.InputJsonValue,
    content: docToPlainText(doc),
    // Only a page that was sent is written: a save of the text alone keeps the page.
    ...(page ? { page: page as unknown as Prisma.InputJsonValue } : {}),
  }
  const isLegacy = existing !== null && existing.doc === null && existing.content.trim() !== ''
  return isLegacy ? { ...written, legacyMarkdown: existing.content } : written
}

/**
 * The page a NEW note starts with (YC-48): the one sent, else the account's starting settings.
 * Only at creation: an existing note keeps its page whatever the settings become.
 */
async function startingPage(userId: string, page?: NotePage): Promise<NotePage> {
  if (page) return page
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { notePreferences: true } })
  return readNotePreferences(user?.notePreferences)
}

/** Checks the video is in one of the user's playlists or in their library (YC-61), else 404. */
async function assertOwnsVideo(userId: string, videoId: string): Promise<void> {
  const video = await prisma.video.findFirst({
    where: { id: videoId, ...accessibleBy(userId) },
    select: { id: true },
  })
  if (!video) throw new HttpError(404, 'Vidéo introuvable')
}

/** Vérifie que la playlist appartient à l'utilisateur (sinon 404). */
async function assertOwnsPlaylist(userId: string, playlistId: string): Promise<void> {
  const playlist = await prisma.playlist.findFirst({
    where: { id: playlistId, ownerId: userId },
    select: { id: true },
  })
  if (!playlist) throw new HttpError(404, 'Playlist introuvable')
}

/** Récupère la note de l'utilisateur pour une vidéo, ou null si aucune. */
export async function getVideoNote(userId: string, videoId: string): Promise<VideoNote | null> {
  await assertOwnsVideo(userId, videoId)
  const note = await prisma.note.findUnique({
    where: { authorId_videoId: { authorId: userId, videoId } },
    select: NOTE_SELECT,
  })
  return toNote(note)
}

/**
 * Crée ou met à jour la note de l'utilisateur pour une vidéo.
 * Une seule note par (utilisateur, vidéo) — upsert sur la contrainte unique.
 */
export async function saveVideoNote(userId: string, videoId: string, doc: NoteDoc, page?: NotePage): Promise<VideoNote> {
  await assertOwnsVideo(userId, videoId)
  const where = { authorId_videoId: { authorId: userId, videoId } }
  const existing = await prisma.note.findUnique({ where, select: { doc: true, content: true } })
  const note = await prisma.note.upsert({
    where,
    create: { authorId: userId, videoId, ...stored(doc, null, existing ? page : await startingPage(userId, page)) },
    update: stored(doc, existing, page),
    select: NOTE_SELECT,
  })
  return toNote(note) as VideoNote
}

/** Récupère la note de l'utilisateur pour une playlist, ou null si aucune. */
export async function getPlaylistNote(userId: string, playlistId: string): Promise<VideoNote | null> {
  await assertOwnsPlaylist(userId, playlistId)
  const note = await prisma.note.findUnique({
    where: { authorId_playlistId: { authorId: userId, playlistId } },
    select: NOTE_SELECT,
  })
  return toNote(note)
}

/** How many lines of a document are timestamped (YC-56 markers), at any depth (tabs, lists). */
export function countMarkers(doc: NoteDoc): number {
  let count = 0
  const walk = (node: NoteNode) => {
    if (typeof node.attrs?.marker === 'number') count++
    node.content?.forEach(walk)
  }
  doc.content.forEach(walk)
  return count
}

/** A video of a playlist that has a note, and how many markers it holds (YC-77). */
export interface VideoNoteMarkers {
  videoId: string
  markers: number
}

/**
 * The notes written on the videos of a playlist, for « Vidéos et leurs notes » of its note page
 * (Figma 23:1588, YC-77). A note left empty counts as none; a video without a line here has none.
 */
export async function listPlaylistVideoNotes(userId: string, playlistId: string): Promise<VideoNoteMarkers[]> {
  await assertOwnsPlaylist(userId, playlistId)
  const notes = await prisma.note.findMany({
    where: { authorId: userId, video: { playlists: { some: { playlistId } } } },
    select: { videoId: true, content: true, doc: true },
  })
  return notes.flatMap((n) => {
    if (!n.videoId || n.content.trim() === '') return []
    return [{ videoId: n.videoId, markers: n.doc ? countMarkers(n.doc as unknown as NoteDoc) : 0 }]
  })
}

/** A timestamped line of a note: when, and what it says (YC-56). */
export interface NoteMarkerLine {
  seconds: number
  text: string
}

/** The text of a node, its words one after the other. */
function textOf(node: NoteNode): string {
  if (node.text) return node.text
  return (node.content ?? []).map(textOf).join('')
}

/** The timestamped lines of a document, in time order (the « Repères » of a note). */
export function markerLines(doc: NoteDoc): NoteMarkerLine[] {
  const found: NoteMarkerLine[] = []
  const walk = (node: NoteNode) => {
    if (typeof node.attrs?.marker === 'number') found.push({ seconds: node.attrs.marker, text: textOf(node).trim() })
    node.content?.forEach(walk)
  }
  doc.content.forEach(walk)
  return found.sort((a, b) => a.seconds - b.seconds)
}

/** How many markers a card shows (Figma « Mes notes » 16:756: three at most). */
export const CARD_MARKERS = 3

interface NoteCardBase {
  id: string
  updatedAt: Date
  /** The first line written, for the card. */
  excerpt: string
}

/** A note of a video, as « Mes notes » shows it (YC-78). */
export interface VideoNoteCard extends NoteCardBase {
  kind: 'video'
  markers: NoteMarkerLine[]
  markerCount: number
  video: { id: string; youtubeId: string; title: string }
  /** The user's playlists that hold the video, with its place in each; none for a video kept on its own. */
  playlists: { id: string; title: string; position: number }[]
}

/** The note of a whole playlist (decision of Ronaldo, 02/10: a card too). */
export interface PlaylistNoteCard extends NoteCardBase {
  kind: 'playlist'
  playlist: { id: string; title: string; videoCount: number }
}

export type NoteCard = VideoNoteCard | PlaylistNoteCard

export interface NoteList {
  notes: NoteCard[]
  /** « 23 notes · 61 repères · 4 playlists »: the playlists the notes belong to. */
  totals: { notes: number; markers: number; playlists: number }
}

/**
 * Every note of the user, the most recent first, for « Mes notes » (YC-78). Only the notes on what
 * the user can still open: a video whose playlist was deleted keeps its row, its note is left out.
 * A note left empty is not a note.
 */
export async function listNotes(userId: string): Promise<NoteList> {
  const rows = await prisma.note.findMany({
    where: { authorId: userId, OR: [{ video: accessibleBy(userId) }, { playlist: { ownerId: userId } }] },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      content: true,
      doc: true,
      updatedAt: true,
      video: {
        select: {
          id: true,
          youtubeId: true,
          title: true,
          playlists: {
            where: { playlist: { ownerId: userId, mergedIntoId: null } },
            orderBy: { position: 'asc' },
            select: { position: true, playlist: { select: { id: true, title: true } } },
          },
        },
      },
      playlist: { select: { id: true, title: true, _count: { select: { videos: true } } } },
    },
  })
  const notes: NoteCard[] = []
  for (const row of rows) {
    if (row.content.trim() === '') continue
    const doc = row.doc ? (row.doc as unknown as NoteDoc) : markdownToDoc(row.content)
    const excerpt = (docToPlainText(doc).split('\n').find((l) => l.trim() !== '') ?? '').trim().slice(0, 200)
    const base = { id: row.id, updatedAt: row.updatedAt, excerpt }
    if (row.video) {
      const markers = markerLines(doc)
      notes.push({
        ...base,
        kind: 'video',
        markers: markers.slice(0, CARD_MARKERS),
        markerCount: markers.length,
        video: { id: row.video.id, youtubeId: row.video.youtubeId, title: row.video.title },
        playlists: row.video.playlists.map((pv) => ({ id: pv.playlist.id, title: pv.playlist.title, position: pv.position })),
      })
    } else if (row.playlist) {
      notes.push({
        ...base,
        kind: 'playlist',
        playlist: { id: row.playlist.id, title: row.playlist.title, videoCount: row.playlist._count.videos },
      })
    }
  }
  const playlists = new Set<string>()
  for (const n of notes) {
    if (n.kind === 'playlist') playlists.add(n.playlist.id)
    else n.playlists.forEach((p) => playlists.add(p.id))
  }
  return {
    notes,
    totals: {
      notes: notes.length,
      markers: notes.reduce((sum, n) => sum + (n.kind === 'video' ? n.markerCount : 0), 0),
      playlists: playlists.size,
    },
  }
}

/** Crée ou met à jour la note de l'utilisateur pour une playlist (une seule par playlist). */
export async function savePlaylistNote(userId: string, playlistId: string, doc: NoteDoc, page?: NotePage): Promise<VideoNote> {
  await assertOwnsPlaylist(userId, playlistId)
  const where = { authorId_playlistId: { authorId: userId, playlistId } }
  const existing = await prisma.note.findUnique({ where, select: { doc: true, content: true } })
  const note = await prisma.note.upsert({
    where,
    create: { authorId: userId, playlistId, ...stored(doc, null, existing ? page : await startingPage(userId, page)) },
    update: stored(doc, existing, page),
    select: NOTE_SELECT,
  })
  return toNote(note) as VideoNote
}
