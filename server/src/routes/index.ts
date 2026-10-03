import { Router } from 'express'
import { healthRouter } from '@/routes/health.route'
import { authRouter } from '@/routes/auth.route'
import { playlistRouter } from '@/routes/playlist.route'
import { accountRouter } from '@/routes/account.route'
import { noteRouter } from '@/routes/note.route'
import { videoRouter } from '@/routes/video.route'
import { libraryRouter } from '@/routes/library.route'
import { noteImageRouter } from '@/routes/noteImage.route'
import { searchRouter } from '@/routes/search.route'
import { studyRouter } from '@/routes/study.route'

export const apiRouter = Router()

apiRouter.use(healthRouter)
apiRouter.use(authRouter)
apiRouter.use(playlistRouter)
apiRouter.use(accountRouter)
apiRouter.use(noteRouter)
apiRouter.use(videoRouter)
apiRouter.use(libraryRouter)
apiRouter.use(noteImageRouter)
apiRouter.use(searchRouter)
apiRouter.use(studyRouter)
