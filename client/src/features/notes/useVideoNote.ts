import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import type { NoteData, NoteSave } from '@/features/notes/noteDoc'


/** Note de l'utilisateur pour une vidéo (null si aucune). */
export function useVideoNote(videoId: string) {
  return useQuery({
    queryKey: ['notes', 'video', videoId],
    queryFn: () => apiFetch<NoteData | null>(`/videos/${videoId}/note`),
    // Le brouillon local fait autorité pendant l'édition : pas de refetch intempestif.
    staleTime: Infinity,
    retry: false,
  })
}

/** Sauvegarde (upsert) la note d'une vidéo, sans refetch (met à jour le cache). */
export function useSaveVideoNote(videoId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: NoteSave) =>
      apiFetch<NoteData>(`/videos/${videoId}/note`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: (note) => {
      queryClient.setQueryData(['notes', 'video', videoId], note)
    },
  })
}
