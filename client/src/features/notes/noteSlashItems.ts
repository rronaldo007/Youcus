import type { Editor, Range } from '@tiptap/react'
import imageIcon from './icons/image.svg'
import tableIcon from './icons/table.svg'
import tabsIcon from './icons/tabs.svg'
import diagramIcon from './icons/diagram.svg'
import chartIcon from './icons/chart.svg'
import linkIcon from './icons/link.svg'
import codeBlockIcon from './icons/code-block.svg'
import quoteIcon from './icons/quote.svg'
import insertIconIcon from './icons/insert-icon.svg'
import dividerIcon from './icons/divider.svg'

/**
 * « / » at the start of a line (YC-64, rest of YC-20): the blocks of « + Insérer » (Figma 63:2013),
 * filtered by what follows the slash. Arrows to move, Entrée or Tab to insert, Échap to close
 * without closing the expanded note around (YC-63).
 */

/** What the list needs from the editor screen: the file chooser and the link field live there. */
export interface SlashActions {
  image: () => void
  link: () => void
}

export interface SlashItem {
  id: string
  label: string
  hint?: string
  icon: string
  group: 'blocks' | 'bar'
  /** Other words that find it, French and English. */
  keywords: string[]
  /** A block that cannot sit where the cursor is (a table in a table) is left out. */
  fits?: (editor: Editor) => boolean
  run: (editor: Editor, range: Range, actions: SlashActions) => void
}

const notInTable = (e: Editor) => !e.isActive('table')
const drop = (e: Editor, range: Range) => e.chain().focus().deleteRange(range)

export const SLASH_ITEMS: SlashItem[] = [
  {
    id: 'image',
    label: 'Image',
    hint: 'Téléverser, coller ou glisser · 10 Mo max',
    icon: imageIcon,
    group: 'blocks',
    keywords: ['photo', 'picture'],
    run: (e, r, a) => {
      drop(e, r).run()
      a.image()
    },
  },
  {
    id: 'table',
    label: 'Tableau',
    hint: '3 × 3, ligne d’en-tête comprise',
    icon: tableIcon,
    group: 'blocks',
    keywords: ['table', 'grille'],
    fits: notInTable,
    run: (e, r) => drop(e, r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    id: 'tabs',
    label: 'Onglets',
    hint: 'Plusieurs pages dans la note',
    icon: tabsIcon,
    group: 'blocks',
    keywords: ['tabs', 'pages'],
    fits: (e) => !e.isActive('noteTabs') && !e.isActive('table'),
    run: (e, r) => drop(e, r).insertNoteTabs().run(),
  },
  {
    id: 'diagram',
    label: 'Schéma',
    hint: 'Formes, flèches et texte',
    icon: diagramIcon,
    group: 'blocks',
    keywords: ['diagram', 'dessin', 'formes'],
    fits: notInTable,
    run: (e, r) => drop(e, r).insertNoteDiagram().run(),
  },
  {
    id: 'chart',
    label: 'Graphique',
    hint: 'Barres, courbe ou secteurs',
    icon: chartIcon,
    group: 'blocks',
    keywords: ['chart', 'courbe', 'barres', 'secteurs'],
    fits: notInTable,
    run: (e, r) => drop(e, r).insertNoteChart().run(),
  },
  {
    id: 'link',
    label: 'Lien',
    icon: linkIcon,
    group: 'bar',
    keywords: ['link', 'url'],
    run: (e, r, a) => {
      drop(e, r).run()
      a.link()
    },
  },
  {
    id: 'code',
    label: 'Bloc de code',
    icon: codeBlockIcon,
    group: 'bar',
    keywords: ['code'],
    run: (e, r) => drop(e, r).setCodeBlock().run(),
  },
  {
    id: 'quote',
    label: 'Citation',
    icon: quoteIcon,
    group: 'bar',
    keywords: ['quote', 'blockquote'],
    run: (e, r) => drop(e, r).setBlockquote().run(),
  },
  {
    id: 'icon',
    label: 'Icône',
    hint: 'Puis son nom : « :ampoule »',
    icon: insertIconIcon,
    group: 'bar',
    keywords: ['icon', 'emoji'],
    // The « : » list takes over once a letter follows (noteIcon.tsx).
    run: (e, r) => drop(e, r).insertContent(':').run(),
  },
  {
    id: 'divider',
    label: 'Séparateur',
    icon: dividerIcon,
    group: 'bar',
    keywords: ['divider', 'ligne', 'hr'],
    run: (e, r) => drop(e, r).setHorizontalRule().run(),
  },
]

const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/** The items that fit at the cursor and whose name, or a word of it, starts with the query. */
export function searchSlashItems(query: string, editor: Editor): SlashItem[] {
  const q = fold(query.trim())
  return SLASH_ITEMS.filter((item) => {
    if (item.fits && !item.fits(editor)) return false
    if (!q) return true
    return [item.label, ...item.keywords].some((word) => fold(word).split(/\s+/).some((w) => w.startsWith(q)) || fold(word).startsWith(q))
  })
}
