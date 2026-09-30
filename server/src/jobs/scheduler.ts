import { env, isYouTubeConfigured } from '@/config/env'
import { runMetadataRefresh } from '@/jobs/refreshMetadata'

const DAY = 24 * 60 * 60 * 1000

/**
 * Starts the daily metadata refresh (YC-8): a first run one minute after boot, then every 24 h.
 * Off in tests, without a YouTube key, or with METADATA_REFRESH=off. Timers are unref'd so they
 * never keep the process alive on their own. Returns a stop function.
 */
export function startMetadataRefresh(): () => void {
  if (env.NODE_ENV === 'test' || env.METADATA_REFRESH === 'off' || !isYouTubeConfigured()) return () => {}
  const first = setTimeout(() => void runMetadataRefresh(), 60 * 1000)
  const daily = setInterval(() => void runMetadataRefresh(), DAY)
  first.unref()
  daily.unref()
  return () => {
    clearTimeout(first)
    clearInterval(daily)
  }
}
