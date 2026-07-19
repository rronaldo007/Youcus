import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import type { Playlist, PlaylistDetail } from '@/types'

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
