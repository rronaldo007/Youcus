import { Extension } from '@tiptap/core'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey, TextSelection, type EditorState } from '@tiptap/pm/state'
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    noteTable: {
      /** Sorts the rows under the header by the column of the cursor; again, the other way. */
      sortTableByColumn: () => ReturnType
      /** Adds an empty row at the end of the table, whatever cell holds the cursor. */
      appendTableRow: () => ReturnType
    }
  }
}

/**
 * What a cell may hold (YC-51): the blocks of a note, never a table nor an image. Same list as
 * the server (server/src/lib/noteDoc.ts, `cellBlock`): a cell the server would refuse would
 * make the whole note fail to save.
 */
const CELL_CONTENT = '(paragraph | heading | bulletList | orderedList | taskList | blockquote | codeBlock)+'

/** The table holding the cursor, where it starts, and the column of the cursor; null outside. */
export function tableAt(state: EditorState): { node: PMNode; pos: number; column: number } | null {
  const { $from } = state.selection
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth)
    if (node.type.name === 'table') {
      const column = $from.depth > depth + 1 ? $from.index(depth + 1) : 0
      return { node, pos: $from.before(depth), column }
    }
  }
  return null
}

const hasHeaderRow = (table: PMNode) => table.firstChild?.firstChild?.type.name === 'tableHeader'

/** The first row of the table is its header (« En-tête » on). */
export const tableHasHeader = (state: EditorState) => {
  const found = tableAt(state)
  return !!found && hasHeaderRow(found.node)
}

const collator = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' })

const activeTableKey = new PluginKey('noteTableActive')

/**
 * Each table ends on the ruling (YC-51), as the code block does: its height is rounded up to the
 * 32 px step, so the text after it falls on the lines. The wrapper's style is a mutation the
 * table view ignores, so ProseMirror does not redraw for it.
 */
function padToRuling(view: EditorView) {
  for (const wrapper of view.dom.querySelectorAll<HTMLElement>('.tableWrapper')) {
    const step = parseFloat(getComputedStyle(wrapper).getPropertyValue('--note-step')) || 32
    const table = wrapper.querySelector('table')
    if (!table) continue
    const height = table.getBoundingClientRect().height
    const padding = `${Math.ceil(height / step) * step - height}px`
    if (wrapper.style.paddingBottom !== padding) wrapper.style.paddingBottom = padding
  }
}

/**
 * Sort, a row at the end, and the class that makes room for the table's bar while the cursor is
 * in it (Figma « Bloc de note › Tableau » 65:2071).
 */
const NoteTableTools = Extension.create({
  name: 'noteTable',

  addCommands() {
    return {
      sortTableByColumn:
        () =>
        ({ state, tr, dispatch }) => {
          const found = tableAt(state)
          if (!found) return false
          const rows: PMNode[] = []
          found.node.forEach((row) => rows.push(row))
          const head = hasHeaderRow(found.node) ? rows.slice(0, 1) : []
          const body = rows.slice(head.length)
          if (body.length < 2) return false
          const key = (row: PMNode) => (found.column < row.childCount ? row.child(found.column).textContent.trim() : '')
          const ascending = [...body].sort((a, b) => collator.compare(key(a), key(b)))
          // Already in order: the second click sorts the other way.
          const sorted = ascending.every((row, i) => row === body[i]) ? ascending.reverse() : ascending
          if (dispatch) {
            // The cursor follows its row: replacing the table would otherwise drop it after it, and
            // a second « Trier » would find no table.
            const { $from } = state.selection
            let depth = $from.depth
            while (depth > 0 && $from.node(depth) !== found.node) depth -= 1
            const cursorRow = $from.node(depth + 1)
            const offsetInRow = $from.pos - $from.before(depth + 1)
            const rowsAfter = [...head, ...sorted]
            tr.replaceWith(found.pos, found.pos + found.node.nodeSize, found.node.type.create(found.node.attrs, rowsAfter))
            let rowStart = found.pos + 1
            for (const r of rowsAfter) {
              if (r === cursorRow) break
              rowStart += r.nodeSize
            }
            tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(rowStart + offsetInRow, tr.doc.content.size))))
          }
          return true
        },
      appendTableRow:
        () =>
        ({ state, tr, dispatch }) => {
          const found = tableAt(state)
          const last = found?.node.lastChild
          if (!found || !last) return false
          const cell = state.schema.nodes.tableCell
          const cells: PMNode[] = []
          last.forEach(() => {
            const empty = cell.createAndFill()
            if (empty) cells.push(empty)
          })
          if (dispatch) tr.insert(found.pos + found.node.nodeSize - 1, last.type.create(null, cells))
          return true
        },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: activeTableKey,
        view: (view) => {
          padToRuling(view)
          return { update: padToRuling }
        },
        props: {
          decorations(state) {
            const found = tableAt(state)
            if (!found) return null
            return DecorationSet.create(state.doc, [Decoration.node(found.pos, found.pos + found.node.nodeSize, { class: 'yc-table-active' })])
          },
        },
      }),
    ]
  },
})

/**
 * The table of a note (YC-51): no column resizing (the mockup has none), Tab goes to the next
 * cell and adds a row after the last one, before the paragraph indent of YC-55 sees the key.
 */
export const noteTableExtensions = [
  Table.extend({ priority: 150 }).configure({ resizable: false, allowTableNodeSelection: false }),
  TableRow,
  TableHeader.extend({ content: CELL_CONTENT }),
  TableCell.extend({ content: CELL_CONTENT }),
  NoteTableTools,
]
