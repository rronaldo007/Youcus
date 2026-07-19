import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import type { Playlist, PlaylistDetail } from '@/types'

/** Rafraîchit une playlist depuis YouTube (ajouts / retraits de vidéos). */
export function useRefreshPlaylist(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<Playlist>(`/playlists/${id}/refresh`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists', id] })
      queryClient.invalidateQueries({ queryKey: ['playlists'] })
    },
  })
}

/** Liste des playlists importées de l'utilisateur. */
export function usePlaylists() {
  return useQuery({
    queryKey: ['playlists'],
    queryFn: () => apiFetch<Playlist[]>('/playlists'),
  })
}

/** Détail d'une playlist (avec ses vidéos). */
export function usePlaylist(id: string) {
  return useQuery({
    queryKey: ['playlists', id],
    queryFn: () => apiFetch<PlaylistDetail>(`/playlists/${id}`),
  })
}

/** Supprime une playlist puis rafraîchit la bibliothèque. */
export function useDeletePlaylist() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: boolean }>(`/playlists/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] })
    },
  })
}
