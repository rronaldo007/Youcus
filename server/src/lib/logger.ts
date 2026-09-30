import { pino, type LoggerOptions } from 'pino'
import { env } from '@/config/env'

/**
 * Never logged (YC-39): pino-http writes every request's headers, and the session cookie would
 * let anyone who reads the logs replay a session for 7 days.
 */
export const LOG_REDACT_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'res.headers["set-cookie"]',
]

/** The app's logger options, shared with the tests so they check the real configuration. */
export function loggerOptions(): LoggerOptions {
  return {
    level: env.NODE_ENV === 'test' ? 'silent' : 'info',
    redact: LOG_REDACT_PATHS,
    transport:
      env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  }
}

export const logger = pino(loggerOptions())
