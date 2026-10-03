import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { localDay } from '@/features/player/studyLog'

export type StatsRange = 'week' | 'month'

export interface Stats {
  range: StatsRange
  from: string
  to: string
  today: string
  /** The day the study log started: before it, nothing was counted. */
  since: string
  /** Null: not counted (before the log, or still to come). */
  days: { day: string; seconds: number | null }[]
  totalSeconds: number
  streakDays: number
  completedCount: number
  goalMinutes: number | null
  playlists: { id: string; title: string; seen: number; total: number; advancedSeconds: number; totalSeconds: number }[]
}

/** Statistiques (YC-79): the week or the month of the user, on their own calendar and time zone. */
export function useStats(range: StatsRange) {
  const today = localDay()
  return useQuery({
    queryKey: ['stats', range, today],
    queryFn: () =>
      apiFetch<Stats>(`/stats?range=${range}&today=${today}&offset=${new Date().getTimezoneOffset()}`),
    // A study just done counts at once when the page is opened again.
    staleTime: 0,
  })
}

const GOAL_KEY = ['account', 'study-goal']

/** Réglages › Étude (YC-79): minutes of study aimed at each week, null for none. */
export function useStudyGoal() {
  return useQuery({
    queryKey: GOAL_KEY,
    queryFn: () => apiFetch<{ minutes: number | null }>('/account/study-goal'),
    retry: false,
  })
}

export function useSaveStudyGoal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (minutes: number | null) =>
      apiFetch<{ minutes: number | null }>('/account/study-goal', { method: 'PUT', body: JSON.stringify({ minutes }) }),
    onSuccess: (goal) => {
      queryClient.setQueryData(GOAL_KEY, goal)
      void queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}
