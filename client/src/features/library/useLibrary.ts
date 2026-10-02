import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import type { LibraryVideo } from '@/types'

/** The videos kept on their own in the library (YC-61), the last added first. */
export function useLibraryVideos() {
  return useQuery({ queryKey: ['library'], queryFn: () => apiFetch<LibraryVideo[]>('/library/videos') })
}

/** One video of the library, by its YouTube id: the player's address. */
export function useLibraryVideo(youtubeId: string) {
  return useQuery({
    queryKey: ['library', youtubeId],
    queryFn: () => apiFetch<LibraryVideo>(`/library/videos/${encodeURIComponent(youtubeId)}`),
  })
}

/** Adds a video by its link; the dashboard shows it at once. */
export function useAddLibraryVideo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (url: string) =>
      apiFetch<LibraryVideo>('/library/videos', { method: 'POST', body: JSON.stringify({ url }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['library'] }),
  })
}

/** Takes a video out of the library; its note and progress stay for a later return. */
export function useRemoveLibraryVideo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (videoId: string) => apiFetch<{ ok: true }>(`/library/videos/${encodeURIComponent(videoId)}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library'] })
      queryClient.invalidateQueries({ queryKey: ['resume'] })
    },
  })
}

/**
 * Seen / position of a video of the library: no playlist is named, the server checks the
 * library. The dashboard and the player read it again.
 */
export function useSetLibraryProgress() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { videoId: string; completed?: boolean; watchedSeconds?: number }) =>
      apiFetch<{ videoId: string; completed: boolean; watchedSeconds: number }>('/progress', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library'] })
      queryClient.invalidateQueries({ queryKey: ['resume'] })
    },
  })
}

/** The position while playing, without reloading anything (the player would restart). */
export function reportLibrarySeconds(videoId: string, watchedSeconds: number): void {
  apiFetch('/progress', { method: 'POST', body: JSON.stringify({ videoId, watchedSeconds }) }).catch(() => {
    /* fire-and-forget */
  })
}
