import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

export interface VideoNote {
  content: string
  updatedAt: string
}

/** Note Markdown de l'utilisateur pour une vidéo (null si aucune). */
export function useVideoNote(videoId: string) {
  return useQuery({
    queryKey: ['notes', 'video', videoId],
    queryFn: () => apiFetch<VideoNote | null>(`/videos/${videoId}/note`),
    // Le brouillon local fait autorité pendant l'édition : pas de refetch intempestif.
    staleTime: Infinity,
    retry: false,
  })
}

/** Sauvegarde (upsert) la note d'une vidéo, sans refetch (met à jour le cache). */
export function useSaveVideoNote(videoId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (content: string) =>
      apiFetch<VideoNote>(`/videos/${videoId}/note`, {
        method: 'PUT',
        body: JSON.stringify({ content }),
      }),
    onSuccess: (note) => {
      queryClient.setQueryData(['notes', 'video', videoId], note)
    },
  })
}
