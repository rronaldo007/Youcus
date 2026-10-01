import type { CatalogItem } from '@/components/ui/CatalogCard'

/**
 * Real public YouTube items, shown on the home page until the catalogue exists (YC-65). Read on
 * 01/10/2026 from the YouTube Data API v3 (playlists.list, playlistItems.list, videos.list): titles
 * as the channels wrote them, counts and durations summed from the real videos, never mock-up figures.
 */
export const CATALOG_SAMPLES: CatalogItem[] = [
  {
    kind: 'playlist',
    title: 'Apprendre React',
    channel: 'Grafikart.fr',
    detail: '27 vidéos · français',
    duration: '6 h 07',
    thumbnailUrl: 'https://i.ytimg.com/vi/hhe6Xb4Em5U/maxresdefault.jpg',
  },
  {
    kind: 'playlist',
    title: "Cours d'algorithmique: Apprendre à écrire les algorithmes",
    channel: 'Mohamed Chiny',
    detail: '14 vidéos · français',
    duration: '1 h 27',
    thumbnailUrl: 'https://i.ytimg.com/vi/kk6YbA5I-Iw/maxresdefault.jpg',
  },
  {
    kind: 'video',
    title: 'useEffect React expliqué simplement : comment bien utiliser le hook useEffect ?',
    channel: 'La minute de code',
    detail: 'Vidéo · français',
    duration: '11:43',
    thumbnailUrl: 'https://i.ytimg.com/vi/NzYaK_L1Iro/maxresdefault.jpg',
  },
]
