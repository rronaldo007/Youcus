import { Router } from 'express'
import { appVersion } from '@/lib/appVersion'

export const healthRouter = Router()

healthRouter.get('/health', (_req, res) => {
  // The version tells which release production runs (YC-106).
  res.json({ status: 'ok', service: 'youcus-api', version: appVersion(), timestamp: new Date().toISOString() })
})
