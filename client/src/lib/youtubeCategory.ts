/**
 * YouTube's video categories as YouTube names them in French: read from videoCategories.list
 * (regionCode=FR, hl=fr) on 02/10/2026. An id outside it shows nothing rather than a guess.
 */
const CATEGORIES: Record<string, string> = {
  '1': 'Films et animations',
  '2': 'Auto/Moto',
  '10': 'Musique',
  '15': 'Animaux',
  '17': 'Sport',
  '19': 'Voyages et événements',
  '20': 'Jeux vidéo',
  '22': 'People et blogs',
  '23': 'Humour',
  '24': 'Divertissement',
  '25': 'Actualités et politique',
  '26': 'Vie pratique et style',
  '27': 'Éducation',
  '28': 'Science et technologie',
}

export function youtubeCategory(id: string | null): string | null {
  return id ? (CATEGORIES[id] ?? null) : null
}
