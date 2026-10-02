import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import type { ResumeItem } from '@/types'

/** The video to resume on the dashboard, or null when nothing is started (YC-74). */
export function useResume() {
  return useQuery({
    queryKey: ['resume'],
    queryFn: () => apiFetch<ResumeItem | null>('/resume'),
    // The player saves the position silently while playing: coming back must show where it stopped.
    staleTime: 0,
  })
}
