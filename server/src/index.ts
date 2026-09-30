import { createApp } from '@/app'
import { env } from '@/config/env'
import { logger } from '@/lib/logger'
import { startMetadataRefresh } from '@/jobs/scheduler'

const app = createApp()

app.listen(env.PORT, () => {
  logger.info(`API Youcus démarrée sur http://localhost:${env.PORT}`)
  startMetadataRefresh()
})
