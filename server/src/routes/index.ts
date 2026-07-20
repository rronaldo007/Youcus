import { Router } from 'express'
import { healthRouter } from '@/routes/health.route'
import { authRouter } from '@/routes/auth.route'
import { playlistRouter } from '@/routes/playlist.route'
import { accountRouter } from '@/routes/account.route'

export const apiRouter = Router()

apiRouter.use(healthRouter)
apiRouter.use(authRouter)
apiRouter.use(playlistRouter)
apiRouter.use(accountRouter)
