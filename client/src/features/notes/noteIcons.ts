/**
 * The icons of a note (YC-46), Figma « Menu de l'éditeur › Icônes » (33:2705), in its order.
 * Stored by id; each is drawn from icons/note/<id>.svg in the colour and size of the text. Same
 * list as server/src/lib/noteDoc.ts. The keywords let « :idée » find the bulb.
 */
export const NOTE_ICONS = [
  { id: 'ampoule', label: 'Ampoule', keywords: ['idée', 'astuce'] },
  { id: 'etoile', label: 'Étoile', keywords: ['important', 'favori'] },
  { id: 'question', label: 'Question', keywords: ['doute', 'aide'] },
  { id: 'drapeau', label: 'Drapeau', keywords: ['objectif', 'à revoir'] },
  { id: 'alerte', label: 'Alerte', keywords: ['attention', 'piège', 'danger'] },
  { id: 'coche', label: 'Coche', keywords: ['fait', 'ok', 'validé'] },
  { id: 'repere', label: 'Repère', keywords: ['signet', 'marque-page'] },
  { id: 'horloge', label: 'Horloge', keywords: ['temps', 'durée'] },
  { id: 'crayon', label: 'Crayon', keywords: ['écrire', 'modifier'] },
  { id: 'lien', label: 'Lien', keywords: ['url', 'adresse'] },
  { id: 'code', label: 'Code', keywords: ['programme'] },
  { id: 'lecture', label: 'Lecture', keywords: ['vidéo', 'play'] },
  { id: 'plus', label: 'Plus', keywords: ['ajouter'] },
  { id: 'citation', label: 'Citation', keywords: ['guillemets'] },
  { id: 'fermer', label: 'Fermer', keywords: ['croix', 'non', 'faux'] },
] as const

export type NoteIconId = (typeof NOTE_ICONS)[number]['id']

export const iconLabel = (id: string) => NOTE_ICONS.find((i) => i.id === id)?.label ?? 'Icône'

/** Lower case, no accents: « Étoile » and « etoile » are the same search. */
const plain = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/** The icons whose name or a keyword starts with the query, names first; all of them for an empty query. */
export function searchIcons(query: string) {
  const q = plain(query.trim())
  if (!q) return [...NOTE_ICONS]
  const byName = NOTE_ICONS.filter((i) => plain(i.label).startsWith(q))
  const byKeyword = NOTE_ICONS.filter((i) => !byName.includes(i) && i.keywords.some((k) => plain(k).startsWith(q)))
  return [...byName, ...byKeyword]
}
