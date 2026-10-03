/**
 * « Le créateur » (YC-72): every fact here was checked, never copied from the frame. The sources are
 * in the comments; a fact that changes changes here.
 */

/** The stack of the repository (client/package.json, server/package.json, .github/workflows). */
export const STACK = [
  'React',
  'TypeScript',
  'Vite',
  'TanStack Query',
  'Tailwind CSS',
  'Express',
  'Prisma',
  'MySQL · MariaDB',
  'Redis',
  'Docker',
  'GitHub Actions',
  'Sevalla',
  'Vitest',
  'OAuth 2.0',
]

export interface Milestone {
  date: string
  title: string
  text: string
}

/** Dated from the repository and the notes of the project (checked on 03/10/2026). */
export const MILESTONES: Milestone[] = [
  // The academic file: business plan, specifications, user stories, diagrams, wireframes (June 2026).
  { date: 'Juin 2026', title: 'La conception', text: 'Business plan, cahier des charges, user stories, diagrammes, maquettes.' },
  // CS-9 (Google OAuth) and CS-54 (one's own playlists, youtube.readonly, refresh token), 19/07.
  { date: '19 juillet 2026', title: 'Google et YouTube', text: 'Connexion OAuth, accès aux playlists privées, jetons rafraîchis automatiquement.' },
  // CS-72 and CS-73, 08/08 (the Redis cache came on 26/07, CS-67: not this day).
  { date: '8 août 2026', title: 'Solidifier', text: 'Validation Zod, garde-fou de configuration, couverture de tests mesurée.' },
  // The oral of the CDA title, 27/08 in Paris (the frame said 26).
  { date: '27 août 2026', title: 'La soutenance', text: 'Le projet présenté devant le jury du titre Concepteur Développeur d’Applications.' },
  // CS-74, 29/09.
  { date: '29 septembre 2026', title: 'Ouvert à tous', text: 'La connexion ne demande plus que l’identité ; YouTube se branche au premier import.' },
]

/** 556 client and 356 server tests on 03/10/2026 (the frame said 90): « 900+ » stays true as they grow. */
export const TESTS_LABEL = '900+'

export const LINKS = {
  github: { label: 'GitHub · rronaldo007', href: 'https://github.com/rronaldo007' },
  linkedin: { label: 'LinkedIn · rukundo-ronaldo', href: 'https://www.linkedin.com/in/rukundo-ronaldo-7a62b6168' },
  portfolio: { label: 'rukundo-ronaldo.fr', href: 'https://rukundo-ronaldo.fr' },
}
