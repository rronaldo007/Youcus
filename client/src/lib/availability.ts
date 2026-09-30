import type { Availability, UnavailableSummary, Video } from '@/types'

/** Short label shown in place of the duration (YC-13, Figma « Détail de playlist », row 6). */
export const AVAILABILITY_LABEL: Record<Exclude<Availability, 'AVAILABLE'>, string> = {
  PRIVATE: 'Privée',
  DELETED: 'Supprimée',
  NOT_EMBEDDABLE: 'Sur YouTube seulement',
  BLOCKED: 'Bloquée en France',
  UPCOMING: 'À venir',
}

export function isPlayable(video: Video): boolean {
  return (video.availability ?? 'AVAILABLE') === 'AVAILABLE'
}

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`

/**
 * "2 vidéos indisponibles : 1 privée, 1 supprimée." (Figma « Fiche YouTube », alert).
 * null when everything can be played.
 */
export function unavailableSentence(s: UnavailableSummary | undefined): string | null {
  if (!s || s.total === 0) return null
  const parts = [
    s.private && plural(s.private, 'privée', 'privées'),
    s.deleted && plural(s.deleted, 'supprimée', 'supprimées'),
    s.notEmbeddable && plural(s.notEmbeddable, 'non lisible hors YouTube', 'non lisibles hors YouTube'),
    s.blocked && plural(s.blocked, 'bloquée en France', 'bloquées en France'),
    s.upcoming && plural(s.upcoming, 'à venir', 'à venir'),
  ].filter(Boolean)
  return `${plural(s.total, 'vidéo indisponible', 'vidéos indisponibles')} : ${parts.join(', ')}.`
}
