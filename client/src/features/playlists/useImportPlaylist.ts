import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

export interface ImportedPlaylist {
  id: string
  youtubeId: string
  title: string
  thumbnailUrl: string | null
  videoCount: number
}

/** Importe une playlist YouTube par URL ou identifiant. */
export function useImportPlaylist() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (url: string) =>
      apiFetch<ImportedPlaylist>('/playlists/import', {
        method: 'POST',
        body: JSON.stringify({ url }),
      }),
    onSuccess: () => {
      // La bibliothèque (CS-12) se rafraîchira quand elle sera branchée.
      queryClient.invalidateQueries({ queryKey: ['playlists'] })
    },
  })
}
