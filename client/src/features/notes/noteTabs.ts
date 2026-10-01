import { Node, ReactNodeViewRenderer } from '@tiptap/react'
import type { Node as PMNode } from '@tiptap/pm/model'
import { TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state'
import { NoteTabsView } from '@/features/notes/NoteTabsView'

/** Same limits as the server (server/src/lib/noteDoc.ts). */
export const MAX_TABS = 8
export const MAX_TAB_TITLE = 40
/** The tabs a new block opens with: the study pages of the mockup (Figma 65:2126). */
export const DEFAULT_TABS = ['Théorie', 'Exemple', 'Exercices']

/** What a tab may hold: every block of a note but tabs. Same list as the server's `tabBlock`. */
const TAB_CONTENT = '(paragraph | heading | blockquote | bulletList | orderedList | taskList | codeBlock | horizontalRule | noteImage | table | noteDiagram)+'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    noteTabs: {
      /** A tabs block with these titles, the cursor in the first tab. */
      insertNoteTabs: (titles?: string[]) => ReturnType
    }
  }
}

/** The tabs blocks around the cursor, the innermost first: there is only one (no tabs in tabs). */
export function tabsAt(state: EditorState): { node: PMNode; pos: number } | null {
  const { $from } = state.selection
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === 'noteTabs') return { node: $from.node(depth), pos: $from.before(depth) }
  }
  return null
}

/** Where each tab starts, inside the tabs block at `pos`. */
export function tabPositions(tabs: PMNode, pos: number): number[] {
  const out: number[] = []
  let at = pos + 1
  tabs.forEach((tab) => {
    out.push(at)
    at += tab.nodeSize
  })
  return out
}

/** The tab holding position `at`, or -1. */
export function tabIndexAt(tabs: PMNode, pos: number, at: number): number {
  const starts = tabPositions(tabs, pos)
  return starts.findIndex((start, i) => at > start && at < start + tabs.child(i).nodeSize)
}

/** Puts the cursor at the start of the text of tab `index`. */
export function cursorIntoTab(tr: Transaction, tabsPos: number, index: number) {
  const tabs = tr.doc.nodeAt(tabsPos)
  if (!tabs || index < 0 || index >= tabs.childCount) return tr
  const start = tabPositions(tabs, tabsPos)[index]
  return tr.setSelection(TextSelection.near(tr.doc.resolve(start + 1)))
}

/** One tab: a title, and blocks. Drawn by the tabs block, which shows one tab at a time. */
export const NoteTab = Node.create({
  name: 'noteTab',
  content: TAB_CONTENT,
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      title: {
        default: 'Onglet',
        parseHTML: (el) => el.getAttribute('data-title') ?? 'Onglet',
        renderHTML: (a) => ({ 'data-title': a.title }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'section[data-note-tab]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['section', { ...HTMLAttributes, 'data-note-tab': '', role: 'tabpanel' }, 0]
  },
})

/**
 * Tabs (YC-52), Figma « Bloc de note › Onglets » (65:2126): several pages in the note. Every tab
 * is in the document; the block shows the one picked, a state of the screen that is never saved
 * (switching tabs changes nothing in the note).
 */
export const NoteTabs = Node.create({
  name: 'noteTabs',
  group: 'block',
  content: 'noteTab+',
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: 'div[data-note-tabs]' }]
  },

  renderHTML() {
    return ['div', { 'data-note-tabs': '' }, 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(NoteTabsView)
  },

  addCommands() {
    return {
      insertNoteTabs:
        (titles = DEFAULT_TABS) =>
        ({ state, tr, dispatch }) => {
          const { schema } = state
          const tabs = this.type.create(
            null,
            titles.map((title) => schema.nodes.noteTab.create({ title }, schema.nodes.paragraph.create())),
          )
          if (!dispatch) return true
          const at = tr.selection.from
          tr.replaceSelectionWith(tabs)
          // Where the block landed: the first tabs block at or after the cursor.
          let found = -1
          tr.doc.nodesBetween(Math.max(0, at - 1), tr.doc.content.size, (node, pos) => {
            if (found < 0 && node.type === this.type) found = pos
            return found < 0
          })
          if (found >= 0) cursorIntoTab(tr, found, 0)
          return true
        },
    }
  },
})
