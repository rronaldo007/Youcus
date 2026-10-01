import { Extension, type Editor } from '@tiptap/react'
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { formatTimestamp } from '@/lib/format'

/**
 * Timestamped markers (YC-56), Figma « Horodatage » (5:321) in the margin of 34:217.
 *
 * A marker is the `marker` attribute (seconds) of a paragraph or a heading: it belongs to the
 * line it timestamps and moves with it. The pill is a widget drawn before the line, never part of
 * the text; a click asks the player to jump there. Same bounds as server/src/lib/noteDoc.ts.
 */
export const MARKER_TYPES = ['paragraph', 'heading'] as const
export const MAX_MARKER_SECONDS = 360_000

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    noteMarker: {
      /** Timestamps the line holding the cursor; a marker already there is replaced. */
      setMarker: (seconds: number) => ReturnType
    }
  }
}

/** The line a marker would go on: the paragraph or heading holding the cursor, if any (none in a code block). */
export function markerLine(state: EditorState): { pos: number; type: string; marker: number | null } | null {
  const { $from } = state.selection
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth)
    if ((MARKER_TYPES as readonly string[]).includes(node.type.name)) {
      return { pos: $from.before(depth), type: node.type.name, marker: (node.attrs.marker as number | null) ?? null }
    }
  }
  return null
}

export const canSetMarker = (editor: Editor) => markerLine(editor.state) !== null

const markerKey = new PluginKey('noteMarker')

function pill(seconds: number, onSeek: (seconds: number) => void) {
  const time = formatTimestamp(seconds)
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'yc-marker'
  button.contentEditable = 'false'
  button.dataset.seconds = String(seconds)
  button.textContent = time
  button.setAttribute('aria-label', `Aller à ${time} dans la vidéo`)
  button.title = `Aller à ${time}`
  // The editor must not move its cursor here: the pill is a link to the video, not text.
  button.addEventListener('mousedown', (e) => e.preventDefault())
  button.addEventListener('click', (e) => {
    e.preventDefault()
    onSeek(seconds)
  })
  return button
}

export interface NoteMarkerOptions {
  /** Called with the marker's second when a pill is clicked; read at click time. */
  onSeek: { current: (seconds: number) => void }
}

export const NoteMarker = Extension.create<NoteMarkerOptions>({
  name: 'noteMarker',

  addOptions() {
    return { onSeek: { current: () => {} } }
  },

  addGlobalAttributes() {
    return [
      {
        types: [...MARKER_TYPES],
        attributes: {
          marker: {
            default: null,
            // Enter at the end of a timestamped line starts an untimestamped one.
            keepOnSplit: false,
            parseHTML: (el) => {
              const value = Number(el.getAttribute('data-marker'))
              return el.hasAttribute('data-marker') && Number.isInteger(value) && value >= 0 ? value : null
            },
            renderHTML: (attrs) => (typeof attrs.marker === 'number' ? { 'data-marker': attrs.marker } : {}),
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setMarker:
        (seconds) =>
        ({ state, tr, dispatch }) => {
          const line = markerLine(state)
          if (!line) return false
          const value = Math.min(MAX_MARKER_SECONDS, Math.max(0, Math.floor(seconds)))
          if (dispatch) tr.setNodeAttribute(line.pos, 'marker', value)
          return true
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      // Backspace at the very start of a timestamped line removes its marker first, as it
      // removes a list bullet: the only way to take a wrong marker back.
      Backspace: ({ editor }) => {
        const { selection } = editor.state
        if (!selection.empty || selection.$from.parentOffset !== 0) return false
        const line = markerLine(editor.state)
        if (!line || line.marker === null || line.pos !== selection.$from.before()) return false
        return editor.commands.command(({ tr }) => {
          tr.setNodeAttribute(line.pos, 'marker', null)
          return true
        })
      },
    }
  },

  addProseMirrorPlugins() {
    const { onSeek } = this.options
    return [
      new Plugin({
        key: markerKey,
        props: {
          decorations(state) {
            const widgets: Decoration[] = []
            state.doc.descendants((node, pos) => {
              const seconds = node.attrs.marker
              if ((MARKER_TYPES as readonly string[]).includes(node.type.name) && typeof seconds === 'number') {
                widgets.push(
                  Decoration.widget(pos + 1, () => pill(seconds, (s) => onSeek.current(s)), {
                    side: -1,
                    key: `marker-${seconds}`,
                    ignoreSelection: true,
                    stopEvent: () => true,
                  }),
                )
              }
              return true
            })
            return DecorationSet.create(state.doc, widgets)
          },
        },
      }),
    ]
  },
})
