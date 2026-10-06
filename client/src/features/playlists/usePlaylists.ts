import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import type { Playlist, PlaylistDetail } from '@/types'

export interface MyPlaylistItem {
  youtubeId: string
  title: string
  thumbnailUrl: string | null
  videoCount: number
  alreadyImported: boolean
}

/** Playlists du compte YouTube de l'utilisateur (nécessite le scope youtube.readonly). */
export function useMyPlaylists() {
  return useQuery({
    queryKey: ['youtube', 'my-playlists'],
    queryFn: () => apiFetch<MyPlaylistItem[]>('/youtube/my-playlists'),
    retry: false,
    staleTime: 60_000,
  })
}

/** Importe en lot les playlists sélectionnées depuis le compte. */
export function useImportBatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (playlistIds: string[]) =>
      apiFetch<{ imported: number }>('/playlists/import-batch', {
        method: 'POST',
        body: JSON.stringify({ playlistIds }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] })
      queryClient.invalidateQueries({ queryKey: ['youtube', 'my-playlists'] })
    },
  })
}

/**
 * Sauvegarde silencieuse de la position de lecture (sans invalider le cache),
 * pour les remontées périodiques pendant la lecture (évite de recharger / relancer le player).
 */
export function reportWatchedSeconds(playlistId: string, videoId: string, watchedSeconds: number): void {
  apiFetch('/progress', {
    method: 'POST',
    body: JSON.stringify({ playlistId, videoId, watchedSeconds }),
  }).catch(() => {
    /* fire-and-forget */
  })
}

/** Enregistre la progression d'une vidéo (vu / position). Rafraîchit le détail de la playlist. */
export function useSetProgress(playlistId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { videoId: string; completed?: boolean; watchedSeconds?: number }) =>
      apiFetch<{ videoId: string; completed: boolean; watchedSeconds: number }>('/progress', {
        method: 'POST',
        body: JSON.stringify({ ...input, playlistId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists', playlistId] })
      queryClient.invalidateQueries({ queryKey: ['playlists'] })
      queryClient.invalidateQueries({ queryKey: ['resume'] })
    },
  })
}

/** Fusionne plusieurs playlists en une nouvelle. */
export function useMergePlaylists() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { sourceIds: string[]; title: string }) =>
      apiFetch<Playlist>('/playlists/merge', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] })
    },
  })
}

/** A refresh; for a merge, the sources it could not refresh, each with why (YC-100). */
export type RefreshResult = Playlist & { failedSources?: { id: string; title: string; message: string }[] }

/** Rafraîchit une playlist depuis YouTube (ajouts / retraits de vidéos) ; une fusion, chacune de ses sources. */
export function useRefreshPlaylist(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<RefreshResult>(`/playlists/${id}/refresh`, { method: 'POST' }),
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

/** Détail d'une playlist (avec ses vidéos). `enabled: false` when there is none to read (YC-77). */
export function usePlaylist(id: string, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['playlists', id],
    queryFn: () => apiFetch<PlaylistDetail>(`/playlists/${id}`),
    enabled,
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
      // Its videos are no longer offered to resume (YC-74).
      queryClient.invalidateQueries({ queryKey: ['resume'] })
    },
  })
}
