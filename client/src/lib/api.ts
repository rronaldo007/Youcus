export const API_URL = import.meta.env.VITE_API_URL ?? '/api'

/** URL de démarrage du flux de connexion Google (navigation du navigateur). */
export const googleLoginUrl = `${API_URL}/auth/google`

/** URL pour connecter YouTube (scope lecture seule), réservée à l'utilisateur déjà connecté. */
export const googleYoutubeConnectUrl = `${API_URL}/auth/google/youtube`

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** The server's `{ code }` when it sends one (YC-81: « youtube_quota »). */
    public code?: string,
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
    const { message, code } = await errorOf(res)
    throw new ApiError(res.status, message, code)
  }
  return (await res.json()) as T
}

/**
 * The message to show for a failed call (YC-12): the server's `{ error }`, 5xx included (YC-36).
 * Since YC-34 the server never sends an unexpected error's detail ("Erreur interne" only), so
 * every message it sends is written for the user. A body that is not JSON (a proxy's error
 * page) falls back to the status.
 */
async function errorOf(res: Response): Promise<{ message: string; code?: string }> {
  const fallback = `Requête échouée (${res.status})`
  try {
    const body = (await res.json()) as { error?: unknown; code?: unknown }
    const message = typeof body.error === 'string' && body.error.trim() !== '' ? body.error : fallback
    return { message, code: typeof body.code === 'string' ? body.code : undefined }
  } catch {
    return { message: fallback }
  }
}
