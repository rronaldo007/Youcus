import { Router } from 'express'
import { healthRouter } from '@/routes/health.route'
import { authRouter } from '@/routes/auth.route'

export const apiRouter = Router()

apiRouter.use(healthRouter)
apiRouter.use(authRouter)
