import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { HttpError } from '@/middleware/errorHandler'
import { markdownToDoc } from '@/lib/markdownToDoc'
import { EMPTY_DOC, docToPlainText, type NoteDoc } from '@/lib/noteDoc'

export interface VideoNote {
  doc: NoteDoc
  updatedAt: Date
}

type StoredNote = { content: string; doc: Prisma.JsonValue; updatedAt: Date }
const NOTE_SELECT = { content: true, doc: true, updatedAt: true } as const

/**
 * The rich document of a stored note (YC-40). A note written before the rich editor has no
 * `doc` yet: its Markdown is converted on read, and replaced on the next save.
 */
function toNote(note: StoredNote | null): VideoNote | null {
  if (!note) return null
  const doc = note.doc ? (note.doc as unknown as NoteDoc) : note.content ? markdownToDoc(note.content) : EMPTY_DOC
  return { doc, updatedAt: note.updatedAt }
}

/**
 * What is written for a document: the JSON, and in `content` its plain text for export and
 * search. On the FIRST rich save of a legacy Markdown note, its original Markdown is copied to
 * `legacyMarkdown` and never touched again: an archive in case the conversion missed something.
 */
function stored(doc: NoteDoc, existing: { doc: Prisma.JsonValue; content: string } | null) {
  const written = { doc: doc as unknown as Prisma.InputJsonValue, content: docToPlainText(doc) }
  const isLegacy = existing !== null && existing.doc === null && existing.content.trim() !== ''
  return isLegacy ? { ...written, legacyMarkdown: existing.content } : written
}

/** Vérifie que la vidéo appartient à au moins une playlist de l'utilisateur (sinon 404). */
async function assertOwnsVideo(userId: string, videoId: string): Promise<void> {
  const video = await prisma.video.findFirst({
    where: { id: videoId, playlists: { some: { playlist: { ownerId: userId } } } },
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
export async function saveVideoNote(userId: string, videoId: string, doc: NoteDoc): Promise<VideoNote> {
  await assertOwnsVideo(userId, videoId)
  const where = { authorId_videoId: { authorId: userId, videoId } }
  const existing = await prisma.note.findUnique({ where, select: { doc: true, content: true } })
  const note = await prisma.note.upsert({
    where,
    create: { authorId: userId, videoId, doc: doc as unknown as Prisma.InputJsonValue, content: docToPlainText(doc) },
    update: stored(doc, existing),
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

/** Crée ou met à jour la note de l'utilisateur pour une playlist (une seule par playlist). */
export async function savePlaylistNote(userId: string, playlistId: string, doc: NoteDoc): Promise<VideoNote> {
  await assertOwnsPlaylist(userId, playlistId)
  const where = { authorId_playlistId: { authorId: userId, playlistId } }
  const existing = await prisma.note.findUnique({ where, select: { doc: true, content: true } })
  const note = await prisma.note.upsert({
    where,
    create: { authorId: userId, playlistId, doc: doc as unknown as Prisma.InputJsonValue, content: docToPlainText(doc) },
    update: stored(doc, existing),
    select: NOTE_SELECT,
  })
  return toNote(note) as VideoNote
}
