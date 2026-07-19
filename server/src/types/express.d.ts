import 'express'

declare global {
  namespace Express {
    interface Request {
      /** Renseigné par le middleware requireAuth après validation de la session. */
      userId?: string
    }
  }
}
