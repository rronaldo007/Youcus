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
  { label: 'Mes notes', icon: 'bookmark' },
  { label: 'Statistiques', icon: 'gauge' },
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
