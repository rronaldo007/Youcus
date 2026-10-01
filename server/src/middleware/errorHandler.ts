import type { NextFunction, Request, Response } from 'express'
import { logger } from '@/lib/logger'

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: 'Ressource introuvable' })
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    if (err.status >= 500) logger.error({ err }, 'Erreur non gérée')
    res.status(err.status).json({ error: err.message })
    return
  }
  // A body the parser refused (too large, not JSON) is the client's doing: its 4xx is kept, with
  // a sentence, not turned into a 500 that the editor would retry forever (YC-62).
  const parser = err as { type?: string; status?: number }
  if (parser.type === 'entity.too.large') {
    res.status(413).json({ error: 'Contenu trop volumineux' })
    return
  }
  if (parser.type === 'entity.parse.failed' || parser.type === 'encoding.unsupported') {
    res.status(400).json({ error: 'Requête invalide' })
    return
  }
  // YC-34: an unexpected error's message can expose internals (a Prisma query, a table name,
  // a library detail). It goes to the log only; the browser gets a generic message.
  logger.error({ err }, 'Erreur non gérée')
  res.status(500).json({ error: 'Erreur interne' })
}
