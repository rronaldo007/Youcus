import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { HttpError } from '@/middleware/errorHandler'
import { deleteObject, getObject, putObject } from '@/lib/imageStorage'

/** 10 Mo per file (Figma menu « Insérer » 63:2013). */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
/** The longest side kept: wide enough for the expanded note, light enough to load fast. */
export const MAX_IMAGE_SIDE = 1600
/** A ceiling per account, so an account cannot fill the bucket. */
export const MAX_IMAGES_PER_USER = 1000
const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp', 'gif', 'avif'])

export interface NoteImageInfo {
  id: string
  width: number
  height: number
  name: string | null
}

/**
 * Stores an image sent by the user (YC-50). It is decoded and re-encoded by sharp, never kept as
 * sent: only real images pass, the EXIF data (GPS position of a photo) is dropped, the
 * orientation applied, the size capped at 1600 px, the format WebP.
 */
export async function addNoteImage(userId: string, file: Buffer, name: string | null): Promise<NoteImageInfo> {
  if (file.length === 0) throw new HttpError(400, 'Fichier vide')
  if (file.length > MAX_IMAGE_BYTES) throw new HttpError(413, 'Image trop lourde : 10 Mo maximum')
  const count = await prisma.noteImage.count({ where: { userId } })
  if (count >= MAX_IMAGES_PER_USER) throw new HttpError(409, `Limite de ${MAX_IMAGES_PER_USER} images atteinte`)

  let format: string | undefined
  try {
    format = (await sharp(file).metadata()).format
  } catch {
    format = undefined
  }
  if (!format || !ACCEPTED_FORMATS.has(format)) {
    throw new HttpError(415, 'Format non accepté : JPEG, PNG, WebP, GIF ou AVIF')
  }
  const { data, info } = await sharp(file)
    .rotate()
    .resize({ width: MAX_IMAGE_SIDE, height: MAX_IMAGE_SIDE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true })

  const id = randomUUID()
  const key = `notes/${userId}/${id}.webp`
  await putObject(key, data, 'image/webp')
  const cleanName = name?.trim().slice(0, 200) || null
  const row = await prisma.noteImage.create({
    data: { id, userId, key, width: info.width, height: info.height, bytes: data.length, name: cleanName },
  })
  return { id: row.id, width: row.width, height: row.height, name: row.name }
}

/** The file of an image, for its owner only; anyone else gets a 404, with no hint it exists. */
export async function readNoteImage(userId: string, id: string) {
  const row = await prisma.noteImage.findFirst({ where: { id, userId }, select: { key: true } })
  if (!row) throw new HttpError(404, 'Image introuvable')
  return getObject(row.key)
}

/**
 * The files of an account, removed from the bucket before the account goes (the rows go with
 * it by cascade). Best effort: a file that cannot be removed is logged, never blocks the deletion.
 */
export async function deleteUserImageFiles(userId: string): Promise<void> {
  const rows = await prisma.noteImage.findMany({ where: { userId }, select: { key: true } })
  for (const { key } of rows) {
    try {
      await deleteObject(key)
    } catch (err) {
      logger.warn({ err, key }, 'Image non supprimée du stockage')
    }
  }
}
