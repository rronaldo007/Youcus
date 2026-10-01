import { useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { DEFAULT_PREFERENCES, type NotePreferences } from '@/features/notes/notePage'

const KEY = ['account', 'note-preferences']

/** The starting settings of every new note (YC-48), Réglages › Notes. */
export function useNotePreferences() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => apiFetch<NotePreferences>('/account/note-preferences'),
    staleTime: Infinity,
    retry: false,
  })
}

/**
 * Saves a change: shown at once, built on the latest settings (two quick changes must not lose
 * the first one, caught by the tests), sent one after the other, and put back to what the
 * server last confirmed if it refuses.
 */
export function useSaveNotePreferences() {
  const queryClient = useQueryClient()
  const confirmed = useRef<NotePreferences | undefined>(undefined)
  const mutation = useMutation({
    scope: { id: 'note-preferences' },
    mutationFn: (prefs: NotePreferences) =>
      apiFetch<NotePreferences>('/account/note-preferences', { method: 'PUT', body: JSON.stringify(prefs) }),
    onSuccess: (prefs) => {
      confirmed.current = prefs
    },
    onError: () => {
      if (confirmed.current) queryClient.setQueryData(KEY, confirmed.current)
    },
  })
  const save = (change: Partial<NotePreferences>) => {
    const current = queryClient.getQueryData<NotePreferences>(KEY) ?? DEFAULT_PREFERENCES
    if (confirmed.current === undefined) confirmed.current = current
    const next = { ...current, ...change }
    queryClient.setQueryData(KEY, next)
    mutation.mutate(next)
  }
  return { save, isPending: mutation.isPending, isError: mutation.isError, isSuccess: mutation.isSuccess }
}
