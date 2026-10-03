import type { IconName } from '@/components/ui/Icon'

export interface NavItem {
  label: string
  icon: IconName
  /** No page yet: shown greyed with « Bientôt » (decision of 01/10, YC-68), its ticket links it. */
  to?: string
  /** The paths that light this tab up. */
  match?: (path: string) => boolean
}

/** « Onglets dans l'ordre de priorité d'usage (jamais alphabétique) » (Figma 5:433). */
export const APP_TABS: NavItem[] = [
  {
    label: 'Tableau de bord',
    icon: 'grid',
    to: '/',
    // The library and what opens from it: a playlist, a video, the import.
    match: (p) => p === '/' || p.startsWith('/playlists') || p.startsWith('/videos') || p === '/import',
  },
  { label: 'Catalogue', icon: 'star' },
  // Every note, and the note pages opened from it (YC-77, YC-78).
  { label: 'Mes notes', icon: 'bookmark', to: '/notes', match: (p) => p.startsWith('/notes') },
  // The study log, the week and the month (YC-79).
  { label: 'Statistiques', icon: 'gauge', to: '/statistiques', match: (p) => p.startsWith('/statistiques') },
]

/** The public site's links (Figma « Navigation publique » 87:59). */
export const PUBLIC_LINKS: { label: string; to?: string }[] = [
  { label: 'Accueil', to: '/' },
  { label: 'Catalogue' },
  { label: 'À propos', to: '/a-propos' },
  { label: 'Ce qu’on corrige', to: '/ce-qu-on-corrige' },
  { label: 'Le créateur' },
]

export const SOON = 'Bientôt disponible'

/** A playlist's player or a video kept on its own (YC-61): the player hides the bar (YC-76). */
export function isPlayerPath(pathname: string): boolean {
  return /^\/playlists\/[^/]+\/watch\/[^/]+/.test(pathname) || /^\/videos\/[^/]+/.test(pathname)
}
