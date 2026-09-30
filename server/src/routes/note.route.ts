import { Router, type NextFunction, type Request, type Response } from 'express'
import { HttpError } from '@/middleware/errorHandler'
import { requireAuth } from '@/middleware/requireAuth'
import { getPlaylistNote, getVideoNote, savePlaylistNote, saveVideoNote } from '@/services/note.service'
import { parseNoteDoc } from '@/lib/noteDoc'

export const noteRouter = Router()

/** Reads `{ doc }` from the body (YC-40): the validated document, or a 400 / 413. */
function docFrom(body: unknown) {
  const parsed = parseNoteDoc((body as { doc?: unknown } | undefined)?.doc)
  if (!parsed.ok) throw new HttpError(parsed.status, parsed.message)
  return parsed.doc
}

/** Adapte un handler async pour propager les erreurs vers errorHandler. */
function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next)
  }
}

// Récupère la note de l'utilisateur pour une vidéo (null si absente).
noteRouter.get(
  '/videos/:videoId/note',
  requireAuth,
  asyncHandler(async (req, res) => {
    const note = await getVideoNote(req.userId as string, req.params.videoId)
    return res.json(note)
  }),
)

// Crée ou met à jour la note de l'utilisateur pour une vidéo.
noteRouter.put(
  '/videos/:videoId/note',
  requireAuth,
  asyncHandler(async (req, res) => {
    const note = await saveVideoNote(req.userId as string, req.params.videoId, docFrom(req.body))
    return res.json(note)
  }),
)

// Récupère la note de l'utilisateur pour une playlist (null si absente).
noteRouter.get(
  '/playlists/:playlistId/note',
  requireAuth,
  asyncHandler(async (req, res) => {
    const note = await getPlaylistNote(req.userId as string, req.params.playlistId)
    return res.json(note)
  }),
)

// Crée ou met à jour la note de l'utilisateur pour une playlist.
noteRouter.put(
  '/playlists/:playlistId/note',
  requireAuth,
  asyncHandler(async (req, res) => {
    const note = await savePlaylistNote(req.userId as string, req.params.playlistId, docFrom(req.body))
    return res.json(note)
  }),
)
