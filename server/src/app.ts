import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import helmet from 'helmet'
import pinoHttp from 'pino-http'
import { env } from '@/config/env'
import { logger } from '@/lib/logger'
import { apiRouter } from '@/routes'
import { errorHandler, notFound } from '@/middleware/errorHandler'

export function createApp() {
  const app = express()

  app.use(helmet())
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }))
  app.use(express.json())
  app.use(cookieParser(env.SESSION_SECRET))
  app.use(pinoHttp({ logger }))

  app.use('/api', apiRouter)

  app.use(notFound)
  app.use(errorHandler)

  return app
}
