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
  // `.url()` seul ne suffit PAS : Zod accepte « localhost:4000/callback »,
  // en y voyant un schema nomme « localhost ». Or c'est precisement l'erreur
  // de l'incident OAuth (§14) : l'adresse du front mise a la place de l'API.
  // On exige donc explicitement http:// ou https://.
  GOOGLE_CALLBACK_URL: z
    .string()
    .url()
    .refine((v) => /^https?:\/\//.test(v), {
      message: 'GOOGLE_CALLBACK_URL doit commencer par http:// ou https://',
    })
    .optional(),
  YOUTUBE_API_KEY: z.string().optional(),
  // Daily refresh of YouTube metadata, 30-day policy (YC-8). 'off' disables it.
  METADATA_REFRESH: z.enum(['on', 'off']).default('on'),
  // Cache NoSQL. Optionnel par conception : sans lui, l'API YouTube est
  // interrogée directement (voir lib/cache.ts).
  REDIS_URL: z.string().url().optional(),
  // Built client (Vite dist) served by the API itself, so front and API share one origin and
  // the session cookie is first-party on mobile (YC-11). Unset in dev: Vite serves the client.
  // An empty value (`CLIENT_DIST=`) means unset, never a crash at boot.
  CLIENT_DIST: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
  // Session cookie SameSite (YC-11). Unset: 'none' in production (front and API were on two
  // sites), 'lax' elsewhere. Once every public link points to the single origin, set 'lax'.
  SESSION_SAMESITE: z.enum(['lax', 'none']).optional(),
})

const DEV_SESSION_SECRET = 'dev-secret-change-me'

export const env = schema.parse(process.env)

// Le schema ci-dessus donne une valeur par defaut au secret de session, pour
// qu'un `npm run dev` fonctionne sans configuration. En production ce defaut
// serait une faille beante : la chaine est publique dans le depot, donc
// n'importe qui pourrait forger un cookie de session signe et usurper un
// compte. On refuse donc de demarrer plutot que de tourner en silence.
if (env.NODE_ENV === 'production' && env.SESSION_SECRET === DEV_SESSION_SECRET) {
  throw new Error(
    'SESSION_SECRET doit etre defini en production : le secret de developpement est public.',
  )
}
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
