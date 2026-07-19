import { Router, type NextFunction, type Request, type Response } from 'express'
import { z } from 'zod'
import { isYouTubeConfigured } from '@/config/env'
import { HttpError } from '@/middleware/errorHandler'
import { requireAuth } from '@/middleware/requireAuth'
import {
  deletePlaylist,
  getPlaylist,
  importPlaylist,
  listPlaylists,
  mergePlaylists,
  refreshPlaylist,
} from '@/services/playlist.service'
import { importSelectedPlaylists, listMyPlaylists } from '@/services/youtubeAccount.service'
import { setProgress } from '@/services/progress.service'

export const playlistRouter = Router()

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next)
  }
}

const importSchema = z.object({
  url: z.string().min(1, 'URL ou identifiant de playlist requis'),
})

const mergeSchema = z.object({
  sourceIds: z.array(z.string()).min(2, 'Sélectionnez au moins 2 playlists à fusionner'),
  title: z.string().min(1, 'Nom de la playlist fusionnée requis'),
})

const batchSchema = z.object({
  playlistIds: z.array(z.string()).min(1, 'Sélectionnez au moins une playlist'),
})

const progressSchema = z.object({
  videoId: z.string().min(1),
  playlistId: z.string().min(1),
  completed: z.boolean().optional(),
  watchedSeconds: z.number().int().nonnegative().optional(),
})

// Enregistre la progression d'une vidéo (vu / position de lecture).
playlistRouter.post(
  '/progress',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = progressSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Requête invalide')
    }
    res.json(await setProgress(req.userId as string, parsed.data))
  }),
)

// Playlists du compte YouTube de l'utilisateur (via son jeton OAuth).
playlistRouter.get(
  '/youtube/my-playlists',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await listMyPlaylists(req.userId as string))
  }),
)

// Import en lot des playlists sélectionnées depuis le compte.
playlistRouter.post(
  '/playlists/import-batch',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = batchSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Requête invalide')
    }
    res.status(201).json(await importSelectedPlaylists(req.userId as string, parsed.data.playlistIds))
  }),
)

// Importe une playlist YouTube pour l'utilisateur connecté.
playlistRouter.post(
  '/playlists/import',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!isYouTubeConfigured()) {
      throw new HttpError(503, 'Import YouTube non configuré sur le serveur')
    }
    const parsed = importSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Requête invalide')
    }
    const playlist = await importPlaylist(req.userId as string, parsed.data.url)
    res.status(201).json(playlist)
  }),
)

// Fusionne plusieurs playlists en une nouvelle.
playlistRouter.post(
  '/playlists/merge',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = mergeSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Requête invalide')
    }
    const playlist = await mergePlaylists(req.userId as string, parsed.data.sourceIds, parsed.data.title)
    res.status(201).json(playlist)
  }),
)

// Liste des playlists de l'utilisateur connecté.
playlistRouter.get(
  '/playlists',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await listPlaylists(req.userId as string))
  }),
)

// Rafraîchit le contenu d'une playlist depuis YouTube.
playlistRouter.post(
  '/playlists/:id/refresh',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!isYouTubeConfigured()) {
      throw new HttpError(503, 'Import YouTube non configuré sur le serveur')
    }
    res.json(await refreshPlaylist(req.userId as string, req.params.id))
  }),
)

// Détail d'une playlist (avec ses vidéos).
playlistRouter.get(
  '/playlists/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await getPlaylist(req.userId as string, req.params.id))
  }),
)

// Suppression d'une playlist.
playlistRouter.delete(
  '/playlists/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    await deletePlaylist(req.userId as string, req.params.id)
    res.json({ ok: true })
  }),
)
