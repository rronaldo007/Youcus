import { useQuery } from '@tanstack/react-query'
import { ApiError, apiFetch } from '@/lib/api'
import type { User } from '@/types'

/** Récupère l'utilisateur connecté, ou null si la session est absente (401). */
export async function fetchCurrentUser(): Promise<User | null> {
  try {
    return await apiFetch<User>('/auth/me')
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null
    throw err
  }
}

/** Hook React Query exposant l'utilisateur courant. */
export function useCurrentUser() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchCurrentUser,
    retry: false,
  })
}
