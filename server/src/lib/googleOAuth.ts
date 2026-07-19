import { env } from '@/config/env'
import { HttpError } from '@/middleware/errorHandler'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'

/** Profil Google normalisé, prêt pour l'upsert User. */
export interface GoogleProfile {
  googleId: string
  email: string
  displayName: string
  avatarUrl: string | null
}

/** Jetons OAuth de l'utilisateur (accès + rafraîchissement) pour l'API YouTube. */
export interface GoogleTokens {
  accessToken: string
  refreshToken: string | null
  expiresAt: Date
}

export interface GoogleAuthResult {
  profile: GoogleProfile
  tokens: GoogleTokens
}

// Scope YouTube en lecture seule : lister/importer les playlists du compte (dont privées).
const SCOPES = ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/youtube.readonly']

/** Construit l'URL de consentement Google (redirection du navigateur). */
export function buildGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID as string,
    redirect_uri: env.GOOGLE_CALLBACK_URL as string,
    response_type: 'code',
    scope: SCOPES.join(' '),
    state,
    access_type: 'offline',
    // `consent` garantit un refresh_token à chaque consentement.
    prompt: 'consent',
  })
  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

interface GoogleTokenResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}

interface GoogleUserInfo {
  id: string
  email: string
  name?: string
  picture?: string
}

function toExpiry(expiresIn: number | undefined): Date {
  return new Date(Date.now() + (expiresIn ?? 3600) * 1000)
}

/** Échange le code d'autorisation contre le profil Google et les jetons OAuth. */
export async function exchangeCodeForTokens(code: string): Promise<GoogleAuthResult> {
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID as string,
      client_secret: env.GOOGLE_CLIENT_SECRET as string,
      redirect_uri: env.GOOGLE_CALLBACK_URL as string,
      grant_type: 'authorization_code',
    }),
  })

  const token = (await tokenRes.json()) as GoogleTokenResponse
  if (!tokenRes.ok || !token.access_token) {
    throw new HttpError(502, `Échec de l'échange du code Google: ${token.error ?? 'inconnu'}`)
  }

  const infoRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  })
  if (!infoRes.ok) {
    throw new HttpError(502, 'Impossible de récupérer le profil Google')
  }

  const info = (await infoRes.json()) as GoogleUserInfo
  if (!info.id || !info.email) {
    throw new HttpError(502, 'Profil Google incomplet (id ou email manquant)')
  }

  return {
    profile: {
      googleId: info.id,
      email: info.email,
      displayName: info.name?.trim() || info.email,
      avatarUrl: info.picture ?? null,
    },
    tokens: {
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? null,
      expiresAt: toExpiry(token.expires_in),
    },
  }
}

/** Rafraîchit le jeton d'accès à partir du refresh_token. */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; expiresAt: Date }> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: env.GOOGLE_CLIENT_ID as string,
      client_secret: env.GOOGLE_CLIENT_SECRET as string,
      grant_type: 'refresh_token',
    }),
  })
  const token = (await res.json()) as GoogleTokenResponse
  if (!res.ok || !token.access_token) {
    throw new HttpError(401, 'Session YouTube expirée, reconnectez-vous')
  }
  return { accessToken: token.access_token, expiresAt: toExpiry(token.expires_in) }
}
