import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

/** A timestamped line of a note (YC-56). */
export interface NoteMarkerLine {
  seconds: number
  text: string
}

interface NoteCardBase {
  id: string
  updatedAt: string
  excerpt: string
}

/** A note of a video in « Mes notes » (GET /notes, YC-78): three markers at most, and their count. */
export interface VideoNoteCard extends NoteCardBase {
  kind: 'video'
  markers: NoteMarkerLine[]
  markerCount: number
  video: { id: string; youtubeId: string; title: string }
  /** None for a video kept on its own (YC-61). */
  playlists: { id: string; title: string; position: number }[]
}

/** The note of a whole playlist. */
export interface PlaylistNoteCard extends NoteCardBase {
  kind: 'playlist'
  playlist: { id: string; title: string; videoCount: number }
}

export type NoteCard = VideoNoteCard | PlaylistNoteCard

export interface NoteList {
  notes: NoteCard[]
  totals: { notes: number; markers: number; playlists: number }
}

export const NOTES_KEY = ['notes', 'list'] as const

/** Every note of the user, the most recent first. Read again each time the page opens. */
export function useNotes() {
  return useQuery({ queryKey: NOTES_KEY, queryFn: () => apiFetch<NoteList>('/notes'), staleTime: 0 })
}
