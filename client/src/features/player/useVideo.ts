import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import type { VideoDetail } from '@/types'

/** One video with its metadata and chapters (GET /api/videos/:id, YC-4). */
export function useVideo(videoId: string) {
  return useQuery({
    queryKey: ['videos', videoId],
    queryFn: () => apiFetch<VideoDetail>(`/videos/${videoId}`),
    // Metadata changes at most once per sync: no refetch on every focus.
    staleTime: 5 * 60 * 1000,
  })
}
