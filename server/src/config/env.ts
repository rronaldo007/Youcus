import 'dotenv/config'
import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1).optional(),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
  SESSION_SECRET: z.string().min(8).default('dev-secret-change-me'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().optional(),
  YOUTUBE_API_KEY: z.string().optional(),
  // Cache NoSQL. Optionnel par conception : sans lui, l'API YouTube est
  // interrogée directement (voir lib/cache.ts).
  REDIS_URL: z.string().url().optional(),
})

export const env = schema.parse(process.env)
export type Env = z.infer<typeof schema>

/** Vrai si les trois variables Google OAuth sont renseignées. */
export function isGoogleOAuthConfigured(): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_CALLBACK_URL)
}

/** Vrai si la clé YouTube Data API v3 est renseignée. */
export function isYouTubeConfigured(): boolean {
  return Boolean(env.YOUTUBE_API_KEY)
}

/** Vrai si un cache Redis est configuré. L'application fonctionne sans. */
export function isCacheConfigured(): boolean {
  return Boolean(env.REDIS_URL)
}
