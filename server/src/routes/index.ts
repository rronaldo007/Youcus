import { Router } from 'express'
import { healthRouter } from '@/routes/health.route'

export const apiRouter = Router()

apiRouter.use(healthRouter)
