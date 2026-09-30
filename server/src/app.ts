import path from 'node:path'
import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import helmet from 'helmet'
import pinoHttp from 'pino-http'
import { env } from '@/config/env'
import { logger } from '@/lib/logger'
import { apiRouter } from '@/routes'
import { errorHandler, notFound } from '@/middleware/errorHandler'

/**
 * What the served client needs beyond its own origin (YC-11): the YouTube IFrame API (script and
 * player frame) and YouTube images (thumbnails, channel avatars). Everything else stays 'self'.
 */
const CSP_DIRECTIVES = {
  scriptSrc: ["'self'", 'https://www.youtube.com'],
  frameSrc: ['https://www.youtube.com', 'https://www.youtube-nocookie.com'],
  imgSrc: ["'self'", 'data:', 'https://i.ytimg.com', 'https://*.ggpht.com', 'https://*.googleusercontent.com'],
}

/**
 * Serves the built client: hashed assets cached for a year, index.html never cached, and every
 * other GET outside /api answered with index.html so the client router handles deep links.
 */
function serveClient(app: express.Express, dist: string) {
  const root = path.resolve(dist)
  app.use('/assets', express.static(path.join(root, 'assets'), { immutable: true, maxAge: '1y' }))
  // A missing asset is a 404, never index.html served as JavaScript.
  app.use('/assets', notFound)
  app.use(express.static(root, { index: false, maxAge: 0 }))
  app.get(/^\/(?!api(\/|$)).*/, (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache')
    res.sendFile(path.join(root, 'index.html'))
  })
}

export function createApp() {
  const app = express()

  app.use(helmet({ contentSecurityPolicy: { directives: CSP_DIRECTIVES } }))
  app.use(cors({ origin: [env.CLIENT_ORIGIN, ...env.CORS_EXTRA_ORIGINS], credentials: true }))
  app.use(express.json())
  app.use(cookieParser(env.SESSION_SECRET))
  app.use(pinoHttp({ logger }))

  app.use('/api', apiRouter)
  if (env.CLIENT_DIST) serveClient(app, env.CLIENT_DIST)

  app.use(notFound)
  app.use(errorHandler)

  return app
}
