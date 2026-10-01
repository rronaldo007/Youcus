import express, { Router, type NextFunction, type Request, type Response } from 'express'
import { HttpError } from '@/middleware/errorHandler'
import { requireAuth } from '@/middleware/requireAuth'
import { addNoteImage, MAX_IMAGE_BYTES, readNoteImage } from '@/services/noteImage.service'
import { isImageStorageConfigured } from '@/config/env'

export const noteImageRouter = Router()

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next)
  }
}

// The file is the body itself (no multipart): its name comes in X-File-Name, URL-encoded.
const rawImage = express.raw({ type: () => true, limit: MAX_IMAGE_BYTES })
function readBody(req: Request, res: Response, next: NextFunction) {
  rawImage(req, res, (err?: unknown) => {
    if ((err as { type?: string } | undefined)?.type === 'entity.too.large') {
      return next(new HttpError(413, 'Image trop lourde : 10 Mo maximum'))
    }
    next(err)
  })
}

function fileName(req: Request): string | null {
  const raw = req.get('X-File-Name')
  if (!raw) return null
  try {
    return decodeURIComponent(raw)
  } catch {
    return null
  }
}

// An image for a note (YC-50): checked, re-encoded, stored; the note keeps its id.
noteImageRouter.post(
  '/note-images',
  requireAuth,
  (_req, _res, next) => next(isImageStorageConfigured() ? undefined : new HttpError(503, 'Les images ne sont pas configurées sur ce serveur')),
  readBody,
  asyncHandler(async (req, res) => {
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0)
    res.status(201).json(await addNoteImage(req.userId as string, body, fileName(req)))
  }),
)

// The file, to its owner only. Private cache: the id never changes, the file neither.
noteImageRouter.get(
  '/note-images/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const file = await readNoteImage(req.userId as string, req.params.id)
    res.setHeader('Content-Type', file.contentType)
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable')
    if (file.length !== undefined) res.setHeader('Content-Length', String(file.length))
    await new Promise<void>((resolve, reject) => {
      file.body.on('error', reject)
      res.on('finish', resolve)
      res.on('close', resolve)
      file.body.pipe(res)
    })
  }),
)
