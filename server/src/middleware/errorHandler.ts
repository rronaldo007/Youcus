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
  const status = err instanceof HttpError ? err.status : 500
  const message = err instanceof Error ? err.message : 'Erreur interne'
  if (status >= 500) logger.error({ err }, 'Erreur non gérée')
  res.status(status).json({ error: message })
}
