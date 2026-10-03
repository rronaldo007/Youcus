export interface Friction {
  title: string
  problem: string
  fix: string
  how: string
  /** In the app today, checked against the code (YC-71); otherwise it says « Bientôt ». */
  shipped: boolean
}

/** Figma « Ce qu'on corrige » 20:191: six frictions, each with what changes and the mechanism behind it. */
export const FRICTIONS: Friction[] = [
  {
    title: 'La colonne de suggestions',
    problem: 'Vingt vidéos choisies pour te garder, juste à côté de celle que tu dois finir.',
    fix: 'Autour du lecteur, seulement ta playlist.',
    how: 'Comment : le lecteur officiel intégré seul, sans la page YouTube autour ; à la fin, ses suggestions sont couvertes.',
    shipped: true,
  },
  {
    title: 'La lecture automatique',
    problem: 'Cinq secondes, puis une vidéo que tu n’as pas choisie.',
    fix: '« Suivant » reste dans ton cours.',
    how: 'Comment : la vidéo suivante est celle de ta playlist, dans son ordre ; rien ne démarre sans toi.',
    shipped: true,
  },
  {
    title: 'Les notes dans un autre onglet',
    problem: 'Tu écris « vers la minute 8 », et tu ne retrouves jamais le passage.',
    fix: 'Chaque repère garde l’heure exacte.',
    how: 'Comment : le repère lit le temps du lecteur ; un clic relance la vidéo à cet instant.',
    shipped: true,
  },
  {
    title: 'Le fil perdu',
    problem: 'Quarante vidéos, et plus aucune idée de celles que tu as vues.',
    fix: 'Progression vidéo par vidéo, reprise à la seconde près.',
    how: 'Comment : chaque vidéo marquée vue est enregistrée ; une vidéo rouverte repart là où tu t’étais arrêté.',
    shipped: true,
  },
  {
    title: 'Les vidéos de quatre heures',
    problem: 'Les chapitres existent, perdus en bas d’une description que personne n’ouvre.',
    fix: 'Une table des matières cliquable.',
    how: 'Comment : les horodatages de la description sont lus à l’import, marqués sur la barre sous la vidéo et listés en dessous ; un clic y saute.',
    shipped: true,
  },
  {
    title: 'Regarder n’est pas retenir',
    problem: 'Une vidéo finie, et deux jours plus tard presque tout est parti.',
    fix: 'Une phrase à retenir, à la fin de chaque vidéo.',
    how: 'Comment : quand la vidéo s’arrête, tu résumes en une phrase ; ta réponse rejoint tes notes.',
    shipped: true,
  },
]

export const SHIPPED_LABEL = '✓ En place'
export const SOON_LABEL = '○ Bientôt'
