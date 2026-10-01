import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { Node, ReactRenderer, mergeAttributes } from '@tiptap/react'
import { PluginKey } from '@tiptap/pm/state'
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from '@tiptap/suggestion'
import { NOTE_ICONS, iconLabel, searchIcons, type NoteIconId } from '@/features/notes/noteIcons'

/**
 * An icon in the text (YC-46), Figma « Menu de l'éditeur › Icônes » (33:2705): « Taille et couleur
 * suivent le texte. Tape « : » pour chercher. » An atom stored by name, drawn by CSS in the colour
 * and size of the text around it, whose marks it takes when inserted.
 *
 * « : » opens the list only once a letter follows (« :amp »): French puts a space before a colon
 * (« Pièges : »), and a list opening at every colon would be noise. A colon after a letter or a
 * digit (« 12:30 », « https: ») never starts one.
 */
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    noteIcon: {
      /** Inserts an icon at the selection, in the marks of the text there. */
      insertNoteIcon: (name: NoteIconId) => ReturnType
    }
  }
}

type Item = (typeof NOTE_ICONS)[number]
interface ListHandle {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean
}

/** The list under « :amp »: arrows to move, Entrée or Tab to insert, Échap to close. */
const IconSuggestions = forwardRef<ListHandle, SuggestionProps<Item, Item>>(function IconSuggestions({ items, command }, ref) {
  const [selected, setSelected] = useState(0)
  useEffect(() => setSelected(0), [items])
  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (!items.length) return false
      if (event.key === 'ArrowDown') setSelected((i) => (i + 1) % items.length)
      else if (event.key === 'ArrowUp') setSelected((i) => (i - 1 + items.length) % items.length)
      else if (event.key === 'Enter' || event.key === 'Tab') command(items[selected])
      else return false
      return true
    },
  }))
  if (!items.length) return null
  return (
    <div role="listbox" aria-label="Icônes" className="yc-menu yc-icon-suggest">
      {items.map((item, i) => (
        <div
          key={item.id}
          role="option"
          aria-selected={i === selected}
          className="yc-menu-item yc-icon-suggest-item"
          onMouseDown={(e) => {
            e.preventDefault()
            command(item)
          }}
        >
          <span aria-hidden="true" className="yc-icon" data-icon={item.id} />
          <span className="yc-menu-item-label yc-menu-item-medium">{item.label}</span>
        </div>
      ))}
    </div>
  )
})

export const NoteIcon = Node.create({
  name: 'noteIcon',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      name: {
        default: 'ampoule',
        parseHTML: (el) => el.getAttribute('data-icon'),
        renderHTML: (attrs) => ({ 'data-icon': attrs.name }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-icon]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'yc-icon', role: 'img', 'aria-label': iconLabel(node.attrs.name) })]
  },

  renderText() {
    return ''
  },

  addCommands() {
    return {
      insertNoteIcon:
        (name) =>
        ({ tr, dispatch }) => {
          if (dispatch) tr.replaceSelectionWith(this.type.create({ name }), true).scrollIntoView()
          return true
        },
    }
  },

  addProseMirrorPlugins() {
    const editor = this.editor
    return [
      Suggestion<Item, Item>({
        editor,
        pluginKey: new PluginKey('noteIconSuggestion'),
        char: ':',
        allowSpaces: false,
        allowedPrefixes: [' ', '\u00a0', '\u202f'],
        minQueryLength: 1,
        items: ({ query }) => searchIcons(query).slice(0, 6),
        command: ({ editor: e, range, props }) => {
          e.chain().focus().deleteRange(range).insertNoteIcon(props.id).run()
        },
        render: () => {
          let renderer: ReactRenderer<ListHandle, SuggestionProps<Item, Item>> | null = null
          let unmount: (() => void) | undefined
          return {
            onStart: (props) => {
              renderer = new ReactRenderer(IconSuggestions, { props, editor: props.editor })
              // Outside the note in the DOM, so it carries the note's colours itself.
              renderer.element.classList.add('yc-note')
              unmount = props.mount(renderer.element as HTMLElement)
            },
            onUpdate: (props) => renderer?.updateProps(props),
            onKeyDown: (props) => {
              if (props.event.key === 'Escape') return false
              return renderer?.ref?.onKeyDown(props) ?? false
            },
            onExit: () => {
              unmount?.()
              renderer?.destroy()
              renderer = null
            },
          }
        },
      }),
    ]
  },
})
