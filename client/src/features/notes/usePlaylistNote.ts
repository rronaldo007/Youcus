import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import type { NoteData } from '@/features/notes/NoteEditor'

/** Note Markdown de l'utilisateur pour une playlist (null si aucune). */
export function usePlaylistNote(playlistId: string) {
  return useQuery({
    queryKey: ['notes', 'playlist', playlistId],
    queryFn: () => apiFetch<NoteData | null>(`/playlists/${playlistId}/note`),
    staleTime: Infinity,
    retry: false,
  })
}

/** Sauvegarde (upsert) la note d'une playlist, sans refetch (met à jour le cache). */
export function useSavePlaylistNote(playlistId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (content: string) =>
      apiFetch<NoteData>(`/playlists/${playlistId}/note`, {
        method: 'PUT',
        body: JSON.stringify({ content }),
      }),
    onSuccess: (note) => {
      queryClient.setQueryData(['notes', 'playlist', playlistId], note)
    },
  })
}
