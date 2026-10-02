import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

/** A video of the playlist that has a note, and its markers (GET /playlists/:id/video-notes, YC-77). */
export interface VideoNoteMarkers {
  videoId: string
  markers: number
}

/** The notes of the videos of a playlist, for « Vidéos et leurs notes » of its note page. */
export function usePlaylistVideoNotes(playlistId: string) {
  return useQuery({
    queryKey: ['notes', 'playlist-videos', playlistId],
    queryFn: () => apiFetch<VideoNoteMarkers[]>(`/playlists/${playlistId}/video-notes`),
  })
}

/** « 5 repères », « Note sans repère », « aucune note » (Figma 23:1588). */
export function videoNoteLabel(note: VideoNoteMarkers | undefined): string {
  if (!note) return 'aucune note'
  if (note.markers === 0) return 'Note sans repère'
  return `${note.markers} repère${note.markers > 1 ? 's' : ''}`
}
