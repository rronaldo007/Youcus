export const API_URL = import.meta.env.VITE_API_URL ?? '/api'

/** URL de démarrage du flux de connexion Google (navigation du navigateur). */
export const googleLoginUrl = `${API_URL}/auth/google`

/** URL pour connecter YouTube (scope lecture seule), réservée à l'utilisateur déjà connecté. */
export const googleYoutubeConnectUrl = `${API_URL}/auth/google/youtube`

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** Petit client fetch typé pour l'API Youcus. */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  if (!res.ok) {
    throw new ApiError(res.status, await errorMessage(res))
  }
  return (await res.json()) as T
}

/**
 * The message to show for a failed call (YC-12): the server's `{ error }` for a 4xx, which is
 * written for the user. A 5xx message can be an internal detail, so it is never shown.
 */
async function errorMessage(res: Response): Promise<string> {
  const fallback = `Requête échouée (${res.status})`
  if (res.status >= 500) return fallback
  try {
    const body = (await res.json()) as { error?: unknown }
    return typeof body.error === 'string' && body.error.trim() !== '' ? body.error : fallback
  } catch {
    return fallback
  }
}
